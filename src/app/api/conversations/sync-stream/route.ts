import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';
import { fetchWithRetry } from '@/lib/facebook/rate-limit-handler';

// Enable streaming
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const syncStartTime = Date.now();
      
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Use unified authentication
        const user = await getFacebookAuthUser();

        if (!user || !(await hasFacebookToken(user))) {
          send({ error: 'Not authenticated or missing Facebook token', status: 'error' });
          controller.close();
          return;
        }

        const userId = user.id;

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

        // Incremental sync: only fetch conversations updated since last sync
        const lastSyncTime = page.last_synced_at;
        const syncMode = lastSyncTime ? 'incremental' : 'full';
        const sinceParam = lastSyncTime ? `&since=${Math.floor(new Date(lastSyncTime).getTime() / 1000)}` : '';

        send({ 
          status: 'fetching', 
          message: `${syncMode === 'incremental' ? 'Incremental' : 'Full'} sync from ${page.name}...`,
          pageName: page.name,
          syncMode: syncMode,
          lastSyncTime: lastSyncTime
        });

        const effectiveFacebookPageId = page.facebook_page_id;
        const syncedConversationIds = new Set<string>();
        let insertedCount = 0;
        let updatedCount = 0;
        const skippedCount = 0;
        let totalConversations = 0;
        let totalEventsCreated = 0;
        let batchNumber = 0;
        
        let nextUrl = `https://graph.facebook.com/v18.0/${effectiveFacebookPageId}/conversations?fields=participants,updated_time,messages{message,created_time,from}&limit=100${sinceParam}&access_token=${page.access_token}`;

        // Fetch and process conversations with real-time updates
        while (nextUrl) {
          batchNumber++;
          send({ 
            status: 'processing', 
            message: `Fetching batch ${batchNumber}...`,
            batch: batchNumber
          });

          let response: Response;
          try {
            // Use rate limit aware fetch with automatic retry
            response = await fetchWithRetry(nextUrl, {
              maxRetries: 3,
              baseDelay: 1000,
              maxDelay: 32000,
            });
          } catch (error) {
            send({ 
              error: error instanceof Error ? error.message : 'Failed to fetch conversations',
              status: 'error'
            });
            controller.close();
            return;
          }

          const data = await response.json();
          const conversations = data.data || [];
          totalConversations += conversations.length;
          
          send({ 
            status: 'processing', 
            message: `Processing ${conversations.length} conversations from batch ${batchNumber}...`,
            batch: batchNumber,
            conversationsInBatch: conversations.length,
            totalFetched: totalConversations
          });

          // Prepare all conversation payloads and events in bulk
          const conversationPayloads: Array<{
            user_id: string;
            page_id: string;
            sender_id: string;
            sender_name: string;
            last_message_time: string;
            conversation_status: string;
          }> = [];
          
          const conversationToMessages = new Map<string, {
            messages: Array<{ message?: string; created_time?: string; from?: { id?: string } }>;
            lastTime: string;
            participantId: string;
          }>();

          // Extract all valid participants and their messages
          for (const conv of conversations) {
            const participants = conv.participants?.data || [];
            const lastTime = conv.updated_time || new Date().toISOString();
            const messages = conv.messages?.data || [];

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

              // Store messages for later event creation
              conversationToMessages.set(`${effectiveFacebookPageId}-${participant.id}`, {
                messages,
                lastTime,
                participantId: participant.id
              });
            }
          }

          // Bulk upsert all conversations
          if (conversationPayloads.length > 0) {
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
              // Collect all events for bulk insert
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
                const isNewConversation = row.created_at === row.updated_at;
                
                if (isNewConversation) {
                  insertedCount++;
                  
                  // Get messages for this conversation
                  const key = `${row.page_id}-${row.sender_id}`;
                  const messageData = conversationToMessages.get(key);
                  
                  if (messageData) {
                    const { messages, lastTime, participantId } = messageData;
                    
                    // Process up to 25 most recent messages to establish activity patterns
                    const recentMessages = messages.slice(0, 25);
                    
                    for (const msg of recentMessages) {
                      if (!msg.created_time) continue;
                      
                      const isFromPage = msg.from?.id === effectiveFacebookPageId;
                      const isFromContact = msg.from?.id === participantId;
                      
                      // Skip messages from unknown participants
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
                        message_id: (msg as { id?: string }).id,
                        synced_at: new Date().toISOString()
                      }
                    });
                    }
                    
                    // If no messages, create one default event
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
                  }
                } else {
                  updatedCount++;
                }
              }

              // Bulk insert all events at once
              if (allEventsToInsert.length > 0) {
                // Insert in chunks to avoid payload size limits
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

              // Send real-time update after processing batch
              send({
                status: 'syncing',
                message: `Synced ${insertedCount + updatedCount} conversations...`,
                inserted: insertedCount,
                updated: updatedCount,
                total: insertedCount + updatedCount
              });
            }
          }

          // Update after each batch
          send({
            status: 'batch_complete',
            message: `Batch ${batchNumber} complete`,
            batch: batchNumber,
            inserted: insertedCount,
            updated: updatedCount,
            total: insertedCount + updatedCount
          });

          nextUrl = data.paging?.next || null;
        }

        // Update last sync timestamp
        await supabase
          .from('facebook_pages')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', pageId);

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
          batches: batchNumber,
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





