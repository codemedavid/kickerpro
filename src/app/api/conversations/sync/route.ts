import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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

type SyncResult = {
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  totalConversations: number;
  totalEventsCreated: number;
  syncedConversationIds: Set<string>;
};

type FacebookConversationResponse = {
  data?: FacebookConversation[];
  paging?: {
    next?: string | null;
  };
};

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pageId, facebookPageId } = body;

    if (!pageId || !facebookPageId) {
      return NextResponse.json(
        { error: 'Page ID required' },
        { status: 400 }
      );
    }

    console.log('[Sync Conversations] Syncing for page:', facebookPageId);

    // Get page access token and last sync time from database
    const supabase = await createClient();
    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('id, facebook_page_id, access_token, last_synced_at')
      .eq('id', pageId)
      .single();

    if (pageError || !page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const effectiveFacebookPageId = page.facebook_page_id;
    if (effectiveFacebookPageId !== facebookPageId) {
      console.warn('[Sync Conversations] Provided Facebook page ID does not match stored value. Using stored value instead.', {
        provided: facebookPageId,
        stored: effectiveFacebookPageId
      });
    }

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

    // Incremental sync: only fetch conversations updated since last sync,
    // but include a small buffer to avoid missing updates that share the same second.
    const lastSyncTime = page.last_synced_at;
    const sinceSeconds = lastSyncTime
      ? Math.max(0, Math.floor(new Date(lastSyncTime).getTime() / 1000) - INCREMENTAL_BUFFER_SECONDS)
      : null;

    let syncMode: 'incremental' | 'full' = sinceSeconds ? 'incremental' : 'full';
    const initialUrl = buildConversationsUrl(sinceSeconds ?? undefined);

    console.log(`[Sync Conversations] Starting ${syncMode} sync for page:`, facebookPageId);
    if (syncMode === 'incremental' && sinceSeconds) {
      console.log('[Sync Conversations] Fetching conversations updated since (buffer applied):', new Date(sinceSeconds * 1000).toISOString());
    }

    const executeSync = async (initialUrl: string, mode: 'incremental' | 'full'): Promise<SyncResult> => {
      const syncedConversationIds = new Set<string>();
      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let totalConversations = 0;
      let totalEventsCreated = 0;

      let nextUrl: string | null = initialUrl;

      while (nextUrl) {
        console.log('[Sync Conversations] Fetching batch...', { mode });
        const response = await fetch(nextUrl);

        if (!response.ok) {
          const error = (await response.json()) as { error?: { message?: string } };
          console.error('[Sync Conversations] Facebook API error:', error);
          throw new Error(error.error?.message || 'Failed to fetch conversations');
        }

        const data = (await response.json()) as FacebookConversationResponse;
        const conversations: FacebookConversation[] = data.data ?? [];
        totalConversations += conversations.length;

        console.log('[Sync Conversations] Processing batch of', conversations.length, 'conversations');

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
              console.error('[Sync Conversations] Error loading existing conversations:', existingError);
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
            console.warn('[Sync Conversations] Missing unique constraint for new key. Retrying with legacy key.');
            ({ data: upsertedRows, error: upsertError } = await attemptUpsert('user_id,page_id,sender_id'));
          }

          if (upsertError) {
            console.error('[Sync Conversations] Error bulk upserting conversations:', upsertError);
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
                  console.error('[Sync Conversations] Error inserting events chunk:', eventsError);
                } else {
                  totalEventsCreated += chunk.length;
                }
              }
            }
          }
        }

        nextUrl = data.paging?.next || null;

        if (nextUrl) {
          console.log('[Sync Conversations] More conversations available, fetching next batch...');
        }
      }

      return {
        insertedCount,
        updatedCount,
        skippedCount,
        totalConversations,
        totalEventsCreated,
        syncedConversationIds,
      };
    };

    let result = await executeSync(initialUrl, syncMode);

    if (result.totalConversations === 0 && syncMode === 'incremental') {
      console.warn('[Sync Conversations] Incremental sync returned zero conversations. Retrying with full sync...');
      const fallbackResult = await executeSync(buildConversationsUrl(), 'full');
      if (fallbackResult.totalConversations > 0) {
        result = fallbackResult;
        syncMode = 'full';
      } else {
        // Even if fallback returns zero, report as full sync for clarity.
        result = fallbackResult;
        syncMode = 'full';
      }
    }

    // Update last sync timestamp
    await supabase
      .from('facebook_pages')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', pageId);

    const { insertedCount, updatedCount, skippedCount, totalConversations, totalEventsCreated, syncedConversationIds } = result;
    const uniqueSynced = syncedConversationIds.size;
    console.log(`[Sync Conversations] ${syncMode.toUpperCase()} sync completed! Total conversations from Facebook:`, totalConversations);
    console.log('[Sync Conversations] Successfully synced:', uniqueSynced, 'conversations', {
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
      eventsCreated: totalEventsCreated,
      mode: syncMode
    });

    return NextResponse.json({
      success: true,
      synced: uniqueSynced,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: totalConversations,
      eventsCreated: totalEventsCreated,
      syncMode: syncMode,
      computeContactTiming: insertedCount > 0,
      message: `${syncMode === 'incremental' ? 'Incremental' : 'Full'} sync: ${uniqueSynced} conversation(s) with ${totalEventsCreated} events`
    });
  } catch (error) {
    console.error('[Sync Conversations] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to sync conversations'
      },
      { status: 500 }
    );
  }
}
