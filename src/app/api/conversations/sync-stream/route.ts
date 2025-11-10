import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Enable streaming
export const runtime = 'nodejs';
const FACEBOOK_API_LIMIT = 100;
const INCREMENTAL_BUFFER_SECONDS = 300;

type FacebookParticipant = {
  id: string;
  name?: string;
};

type FacebookMessage = {
  id?: string;
  created_time?: string;
  from?: {
    id?: string | null;
  } | null;
  message?: string;
};

type FacebookConversation = {
  id?: string;
  updated_time?: string;
  participants?: {
    data?: FacebookParticipant[];
  };
  messages?: {
    data?: FacebookMessage[];
  };
};

type ConversationMessageBundle = {
  messages: FacebookMessage[];
  lastTime: string;
  participantId: string;
};

type FacebookConversationResponse = {
  data?: FacebookConversation[];
  paging?: {
    next?: string | null;
  };
};

type StreamSyncResult = {
  syncedConversationIds: Set<string>;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  totalConversations: number;
  totalEventsCreated: number;
  batches: number;
};

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('fb-auth-user')?.value;

        if (!userId) {
          send({ error: 'Not authenticated', status: 'error' });
          controller.close();
          return;
        }

        const body = await request.json();
        const { pageId, facebookPageId } = body;

        if (!pageId || !facebookPageId) {
          send({ error: 'Page ID required', status: 'error' });
          controller.close();
          return;
        }

        send({ status: 'starting', message: 'Initializing sync...' });

        const supabase = await createClient();
        const { data: page, error: pageError } = await supabase
          .from('facebook_pages')
          .select('id, facebook_page_id, access_token, name, last_synced_at')
          .eq('id', pageId)
          .single();

        if (pageError || !page) {
          send({ error: 'Page not found', status: 'error' });
          controller.close();
          return;
        }

        const effectiveFacebookPageId = page.facebook_page_id;

        const buildConversationsUrl = (sinceSeconds?: number) => {
          const params = [
            'fields=participants,updated_time,messages{message,created_time,from}',
            `limit=${FACEBOOK_API_LIMIT}`,
            `access_token=${page.access_token}`,
          ];

          if (typeof sinceSeconds === 'number') {
            params.push(`since=${sinceSeconds}`);
          }

          return `https://graph.facebook.com/v18.0/${effectiveFacebookPageId}/conversations?${params.join('&')}`;
        };

        const lastSyncTime = page.last_synced_at;
        const sinceSeconds = lastSyncTime
          ? Math.max(0, Math.floor(new Date(lastSyncTime).getTime() / 1000) - INCREMENTAL_BUFFER_SECONDS)
          : null;

        let syncMode: 'incremental' | 'full' = sinceSeconds ? 'incremental' : 'full';
        const initialUrl = buildConversationsUrl(sinceSeconds ?? undefined);

        send({
          status: 'fetching',
          message: `${syncMode === 'incremental' ? 'Incremental' : 'Full'} sync from ${page.name}...`,
          pageName: page.name,
          syncMode: syncMode,
          lastSyncTime: lastSyncTime,
          effectiveSince: sinceSeconds ? new Date(sinceSeconds * 1000).toISOString() : undefined,
        });

        if (syncMode === 'incremental' && sinceSeconds) {
          console.log('[Sync Stream] Fetching conversations updated since (buffer applied):', new Date(sinceSeconds * 1000).toISOString());
        }

        const processSync = async (initialUrl: string, mode: 'incremental' | 'full'): Promise<StreamSyncResult | null> => {
          const syncedConversationIds = new Set<string>();
          let insertedCount = 0;
          let updatedCount = 0;
          let skippedCount = 0;
          let totalConversations = 0;
          let totalEventsCreated = 0;
          let batchNumber = 0;

          let nextUrl: string | null = initialUrl;

          while (nextUrl) {
            batchNumber++;
            send({
              status: 'processing',
              message: `Fetching batch ${batchNumber}...`,
              batch: batchNumber,
              mode,
            });

            const response = await fetch(nextUrl);

            if (!response.ok) {
              const error = (await response.json()) as { error?: { message?: string } };
              send({
                error: error.error?.message || 'Failed to fetch conversations',
                status: 'error'
              });
              controller.close();
              return null;
            }

            const data = (await response.json()) as FacebookConversationResponse;
            const conversations: FacebookConversation[] = data.data ?? [];
            totalConversations += conversations.length;

            send({
              status: 'processing',
              message: `Processing ${conversations.length} conversations from batch ${batchNumber}...`,
              batch: batchNumber,
              conversationsInBatch: conversations.length,
              totalFetched: totalConversations,
              mode,
            });

            const conversationPayloads: Array<{
              user_id: string;
              page_id: string;
              sender_id: string;
              sender_name: string;
              last_message_time: string;
              conversation_status: string;
            }> = [];

            const conversationToMessages = new Map<string, ConversationMessageBundle>();

            const existingSenderIds = new Set<string>();

            for (const conv of conversations) {
              const participants: FacebookParticipant[] = conv.participants?.data ?? [];
              const lastTime = conv.updated_time || new Date().toISOString();
              const messages: FacebookMessage[] = conv.messages?.data ?? [];

              for (const participant of participants) {
                if (participant.id === effectiveFacebookPageId) continue;

                conversationPayloads.push({
                  user_id: userId,
                  page_id: effectiveFacebookPageId,
                  sender_id: participant.id,
                  sender_name: participant.name || 'Facebook User',
                  last_message_time: lastTime,
                  conversation_status: 'active'
                });

                existingSenderIds.add(participant.id);

                conversationToMessages.set(`${effectiveFacebookPageId}-${participant.id}`, {
                  messages,
                  lastTime,
                  participantId: participant.id
                });
              }
            }

            if (conversationPayloads.length > 0) {
              const existingConversations = new Map<string, { last_message_time: string }>();

              if (existingSenderIds.size > 0) {
                const senderIdList = Array.from(existingSenderIds);
                const { data: existingRows, error: existingError } = await supabase
                  .from('messenger_conversations')
                  .select('sender_id, last_message_time')
                  .eq('page_id', effectiveFacebookPageId)
                  .in('sender_id', senderIdList);

                if (existingError) {
                  console.error('[Sync Stream] Error loading existing conversations:', existingError);
                } else {
                  for (const existing of existingRows || []) {
                    existingConversations.set(`${effectiveFacebookPageId}-${existing.sender_id}`, {
                      last_message_time: existing.last_message_time,
                    });
                  }
                }
              }

              const attemptUpsert = async (onConflict: string) =>
                supabase
                  .from('messenger_conversations')
                  .upsert(conversationPayloads, { onConflict, ignoreDuplicates: false })
                  .select('id, sender_id, page_id, created_at, updated_at');

              let { data: upsertedRows, error: upsertError } = await attemptUpsert('page_id,sender_id');

              if (upsertError && upsertError.code === '42P10') {
                console.warn('[Sync Stream] Missing unique constraint for new key. Retrying with legacy key.');
                ({ data: upsertedRows, error: upsertError } = await attemptUpsert('user_id,page_id,sender_id'));
              }

              if (upsertError) {
                console.error('[Sync Stream] Error bulk upserting conversations:', upsertError);
              } else if (upsertedRows) {
                const allEventsToInsert: Array<{
                  user_id: string;
                  conversation_id: string;
                  sender_id: string;
                  event_type: string;
                  event_timestamp: string;
                  channel: string;
                  is_outbound: boolean;
                  is_success: boolean;
                  success_weight: number;
                  metadata: Record<string, unknown>;
                }> = [];

                for (const row of upsertedRows) {
                  syncedConversationIds.add(row.id);
                  const key = `${row.page_id}-${row.sender_id}`;
                  const messageData = conversationToMessages.get(key);

                  if (!messageData) {
                    skippedCount++;
                    continue;
                  }

                  const { messages, lastTime, participantId } = messageData;
                  const isNewConversation = row.created_at === row.updated_at && !existingConversations.has(key);

                  if (isNewConversation) {
                    insertedCount++;

                    const recentMessages = messages.slice(0, 25);

                    for (const msg of recentMessages) {
                      if (!msg.created_time) continue;

                      const isFromPage = msg.from?.id === effectiveFacebookPageId;
                      const isFromContact = msg.from?.id === participantId;

                      if (!isFromPage && !isFromContact) continue;

                      allEventsToInsert.push({
                        user_id: userId,
                        conversation_id: row.id,
                        sender_id: participantId,
                        event_type: isFromContact ? 'message_replied' : 'message_sent',
                        event_timestamp: msg.created_time,
                        channel: 'messenger',
                        is_outbound: isFromPage,
                        is_success: isFromContact,
                        success_weight: isFromContact ? 1.0 : 0.0,
                        metadata: {
                          source: 'initial_sync',
                          message_id: msg.id,
                          synced_at: new Date().toISOString()
                        }
                      });
                    }

                    if (recentMessages.length === 0) {
                      allEventsToInsert.push({
                        user_id: userId,
                        conversation_id: row.id,
                        sender_id: participantId,
                        event_type: 'message_replied',
                        event_timestamp: lastTime,
                        channel: 'messenger',
                        is_outbound: false,
                        is_success: true,
                        success_weight: 1.0,
                        metadata: {
                          source: 'initial_sync_fallback',
                          synced_at: new Date().toISOString()
                        }
                      });
                    }
                  } else {
                    const previous = existingConversations.get(key);

                    if (!previous) {
                      skippedCount++;
                      continue;
                    }

                    const previousTimestamp = new Date(previous.last_message_time).getTime();
                    const newMessages = messages.filter((msg) => {
                      if (!msg.created_time) return false;
                      const messageTimestamp = new Date(msg.created_time).getTime();
                      return messageTimestamp > previousTimestamp;
                    });

                    if (newMessages.length > 0) {
                      updatedCount++;

                      const limitedMessages = newMessages.slice(0, 25);
                      for (const msg of limitedMessages) {
                        const isFromPage = msg.from?.id === effectiveFacebookPageId;
                        const isFromContact = msg.from?.id === participantId;

                        if (!isFromPage && !isFromContact) continue;

                        allEventsToInsert.push({
                          user_id: userId,
                          conversation_id: row.id,
                          sender_id: participantId,
                          event_type: isFromContact ? 'message_replied' : 'message_sent',
                          event_timestamp: msg.created_time,
                          channel: 'messenger',
                          is_outbound: isFromPage,
                          is_success: isFromContact,
                          success_weight: isFromContact ? 1.0 : 0.0,
                          metadata: {
                            source: 'incremental_sync',
                            message_id: msg.id,
                            synced_at: new Date().toISOString()
                          }
                        });
                      }
                    } else {
                      const lastTimestamp = new Date(lastTime).getTime();

                      if (lastTimestamp > previousTimestamp) {
                        updatedCount++;
                        allEventsToInsert.push({
                          user_id: userId,
                          conversation_id: row.id,
                          sender_id: participantId,
                          event_type: 'message_replied',
                          event_timestamp: lastTime,
                          channel: 'messenger',
                          is_outbound: false,
                          is_success: true,
                          success_weight: 1.0,
                          metadata: {
                            source: 'incremental_sync_fallback',
                            synced_at: new Date().toISOString()
                          }
                        });
                      } else {
                        skippedCount++;
                      }
                    }
                  }
                }

                if (allEventsToInsert.length > 0) {
                  const EVENTS_CHUNK_SIZE = 500;
                  for (let i = 0; i < allEventsToInsert.length; i += EVENTS_CHUNK_SIZE) {
                    const chunk = allEventsToInsert.slice(i, i + EVENTS_CHUNK_SIZE);
                    const { error: eventsError } = await supabase
                      .from('contact_interaction_events')
                      .insert(chunk);

                    if (eventsError) {
                      console.error('[Sync Stream] Error inserting events chunk:', eventsError);
                    } else {
                      totalEventsCreated += chunk.length;
                    }
                  }
                }

                send({
                  status: 'syncing',
                  message: `Synced ${insertedCount + updatedCount} conversations...`,
                  inserted: insertedCount,
                  updated: updatedCount,
                  skipped: skippedCount,
                  total: insertedCount + updatedCount,
                  mode,
                });
              }
            }

            send({
              status: 'batch_complete',
              message: `Batch ${batchNumber} complete`,
              batch: batchNumber,
              inserted: insertedCount,
              updated: updatedCount,
              skipped: skippedCount,
              total: insertedCount + updatedCount,
              mode,
            });

            nextUrl = data.paging?.next || null;
          }

          return {
            syncedConversationIds,
            insertedCount,
            updatedCount,
            skippedCount,
            totalConversations,
            totalEventsCreated,
            batches: batchNumber,
          };
        };

        let result = await processSync(initialUrl, syncMode);

        if (!result) {
          return;
        }

        if (result.totalConversations === 0 && syncMode === 'incremental') {
          send({
            status: 'info',
            message: 'No conversations returned during incremental sync. Retrying with a full sync...'
          });
          console.warn('[Sync Stream] Incremental sync returned zero conversations. Retrying with full sync...');

          const fallbackResult = await processSync(buildConversationsUrl(), 'full');

          if (fallbackResult) {
            result = fallbackResult;
            syncMode = 'full';
          } else {
            return;
          }
        }

        // Update last sync timestamp
        await supabase
          .from('facebook_pages')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', pageId);

        const { insertedCount, updatedCount, skippedCount, totalConversations, totalEventsCreated, batches } = result;

        // Final summary
        send({
          status: 'complete',
          message: `${syncMode === 'incremental' ? 'Incremental' : 'Full'} sync completed!`,
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount,
          total: insertedCount + updatedCount,
          totalConversationsFetched: totalConversations,
          eventsCreated: totalEventsCreated,
          computeContactTiming: insertedCount > 0,
          batches: batches,
          syncMode: syncMode
        });

        controller.close();
      } catch (error) {
        send({
          error: error instanceof Error ? error.message : 'Sync failed',
          status: 'error'
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}





