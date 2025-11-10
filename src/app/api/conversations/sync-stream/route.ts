import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';
import { fetchWithRetry } from '@/lib/facebook/rate-limit-handler';

// Enable streaming
export const runtime = 'nodejs';

// Configuration constants
const MAX_SYNC_DURATION_MS = 4.5 * 60 * 1000; // 4.5 minutes to stay under Vercel's 5min limit
const MAX_BATCHES = 500; // Safety limit to prevent infinite loops
const BATCH_RETRY_ATTEMPTS = 3;
const BATCH_RETRY_DELAY_MS = 2000;
const EVENTS_CHUNK_SIZE = 500;

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const syncStartTime = Date.now();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (error) {
          console.error('[Sync Stream] Error sending data:', error);
        }
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

        // PERMANENT FIX: ALWAYS FULL SYNC
        // Incremental sync disabled permanently to prevent missing conversations
        const syncMode = 'full';
        const sinceParam = '';  // Always fetch ALL conversations

        send({ 
          status: 'fetching', 
          message: `Full sync from ${page.name} (fetching ALL conversations)...`,
          pageName: page.name,
          syncMode: syncMode
        });

        const effectiveFacebookPageId = page.facebook_page_id;
        const syncedConversationIds = new Set<string>();
        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let totalConversations = 0;
        let totalEventsCreated = 0;
        let batchNumber = 0;
        let failedBatches = 0;
        
        let nextUrl = `https://graph.facebook.com/v18.0/${effectiveFacebookPageId}/conversations?fields=participants,updated_time,messages{message,created_time,from}&limit=100${sinceParam}&access_token=${page.access_token}`;

        // Fetch and process conversations with real-time updates
        while (nextUrl) {
          // Check timeout protection
          const elapsed = Date.now() - syncStartTime;
          if (elapsed > MAX_SYNC_DURATION_MS) {
            console.warn('[Sync Stream] Approaching timeout limit, stopping gracefully');
            send({
              status: 'timeout_warning',
              message: 'Sync approaching time limit, saving progress...',
              inserted: insertedCount,
              updated: updatedCount,
              total: insertedCount + updatedCount,
              batches: batchNumber
            });
            break;
          }

          // Check batch limit
          if (batchNumber >= MAX_BATCHES) {
            console.warn('[Sync Stream] Reached maximum batch limit');
            send({
              status: 'batch_limit_warning',
              message: 'Reached maximum batch limit, saving progress...',
              inserted: insertedCount,
              updated: updatedCount,
              total: insertedCount + updatedCount,
              batches: batchNumber
            });
            break;
          }

          batchNumber++;
          send({ 
            status: 'processing', 
            message: `Fetching batch ${batchNumber}...`,
            batch: batchNumber
          });

          // Fetch conversations with retry
          let response: Response | null = null;
          let fetchError: Error | null = null;
          
          for (let attempt = 1; attempt <= BATCH_RETRY_ATTEMPTS; attempt++) {
            try {
              response = await fetchWithRetry(nextUrl, {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 32000,
              });
              fetchError = null;
              break;
            } catch (error) {
              fetchError = error instanceof Error ? error : new Error('Unknown fetch error');
              console.error(`[Sync Stream] Fetch attempt ${attempt}/${BATCH_RETRY_ATTEMPTS} failed:`, fetchError.message);
              
              if (attempt < BATCH_RETRY_ATTEMPTS) {
                send({
                  status: 'retrying',
                  message: `Batch ${batchNumber} failed, retrying (${attempt}/${BATCH_RETRY_ATTEMPTS})...`,
                  batch: batchNumber,
                  attempt
                });
                await delay(BATCH_RETRY_DELAY_MS * attempt);
              }
            }
          }

          if (!response || fetchError) {
            failedBatches++;
            send({ 
              status: 'batch_failed',
              error: fetchError?.message || 'Failed to fetch conversations',
              message: `Batch ${batchNumber} failed after ${BATCH_RETRY_ATTEMPTS} attempts, continuing with next batch...`,
              batch: batchNumber,
              failedBatches
            });
            // Try to continue with remaining batches instead of stopping completely
            continue;
          }

          let data;
          try {
            data = await response.json();
          } catch (error) {
            console.error('[Sync Stream] Failed to parse response:', error);
            failedBatches++;
            send({
              status: 'batch_failed',
              error: 'Invalid response format',
              message: `Batch ${batchNumber} returned invalid data, continuing...`,
              batch: batchNumber,
              failedBatches
            });
            continue;
          }

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

          // Process batch with retry logic
          if (conversationPayloads.length > 0) {
            let batchProcessed = false;
            let upsertedRows = null;

            // Retry database upsert
            for (let dbAttempt = 1; dbAttempt <= BATCH_RETRY_ATTEMPTS; dbAttempt++) {
              try {
                const attemptUpsert = async (onConflict: string) =>
                  supabase
                    .from('messenger_conversations')
                    .upsert(conversationPayloads, { onConflict, ignoreDuplicates: false })
                    .select('id, sender_id, page_id, created_at, updated_at');

                let { data, error: upsertError } = await attemptUpsert('page_id,sender_id');

                if (upsertError && upsertError.code === '42P10') {
                  console.warn('[Sync Stream] Missing unique constraint for new key. Retrying with legacy key.');
                  ({ data, error: upsertError } = await attemptUpsert('user_id,page_id,sender_id'));
                }

                if (upsertError) {
                  throw new Error(`Database upsert failed: ${upsertError.message}`);
                }

                upsertedRows = data;
                batchProcessed = true;
                break;
              } catch (error) {
                console.error(`[Sync Stream] DB attempt ${dbAttempt}/${BATCH_RETRY_ATTEMPTS} failed:`, error);
                
                if (dbAttempt < BATCH_RETRY_ATTEMPTS) {
                  send({
                    status: 'db_retrying',
                    message: `Database error on batch ${batchNumber}, retrying (${dbAttempt}/${BATCH_RETRY_ATTEMPTS})...`,
                    batch: batchNumber,
                    attempt: dbAttempt
                  });
                  await delay(BATCH_RETRY_DELAY_MS * dbAttempt);
                } else {
                  // Final attempt failed
                  failedBatches++;
                  skippedCount += conversationPayloads.length;
                  send({
                    status: 'batch_db_failed',
                    error: error instanceof Error ? error.message : 'Database error',
                    message: `Failed to save batch ${batchNumber} after ${BATCH_RETRY_ATTEMPTS} attempts, skipping ${conversationPayloads.length} conversations...`,
                    batch: batchNumber,
                    failedBatches,
                    skippedCount
                  });
                }
              }
            }

            if (batchProcessed && upsertedRows) {
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

              // Bulk insert all events with retry logic
              if (allEventsToInsert.length > 0) {
                // Insert in chunks to avoid payload size limits
                for (let i = 0; i < allEventsToInsert.length; i += EVENTS_CHUNK_SIZE) {
                  const chunk = allEventsToInsert.slice(i, i + EVENTS_CHUNK_SIZE);
                  let eventInserted = false;
                  
                  // Retry event insertion
                  for (let eventAttempt = 1; eventAttempt <= BATCH_RETRY_ATTEMPTS; eventAttempt++) {
                    const { error: eventsError } = await supabase
                      .from('contact_interaction_events')
                      .insert(chunk);
                    
                    if (eventsError) {
                      console.error(`[Sync Stream] Error inserting events chunk (attempt ${eventAttempt}/${BATCH_RETRY_ATTEMPTS}):`, eventsError);
                      
                      if (eventAttempt < BATCH_RETRY_ATTEMPTS) {
                        await delay(BATCH_RETRY_DELAY_MS);
                      }
                    } else {
                      totalEventsCreated += chunk.length;
                      eventInserted = true;
                      break;
                    }
                  }
                  
                  if (!eventInserted) {
                    console.error('[Sync Stream] Failed to insert event chunk after all retries');
                    // Continue with next chunk instead of failing entire batch
                  }
                }
              }

              // Send real-time update after processing batch
              send({
                status: 'syncing',
                message: `Synced ${insertedCount + updatedCount} conversations...`,
                inserted: insertedCount,
                updated: updatedCount,
                total: insertedCount + updatedCount,
                failedBatches: failedBatches,
                skipped: skippedCount
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
            total: insertedCount + updatedCount,
            failedBatches: failedBatches,
            skipped: skippedCount
          });

          // Move to next page
          nextUrl = data.paging?.next || null;
          
          // If there's no next page, we're done
          if (!nextUrl) {
            console.log('[Sync Stream] No more pages to fetch, sync complete');
            break;
          }
        }

        // Update last sync timestamp
        try {
          await supabase
            .from('facebook_pages')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', pageId);
        } catch (error) {
          console.error('[Sync Stream] Failed to update last sync timestamp:', error);
          // Don't fail the entire sync for this
        }

        const syncDuration = ((Date.now() - syncStartTime) / 1000).toFixed(1);
        const successRate = batchNumber > 0 ? (((batchNumber - failedBatches) / batchNumber) * 100).toFixed(1) : '100';

        // Final summary with comprehensive stats
        send({
          status: failedBatches > 0 ? 'complete_with_errors' : 'complete',
          message: failedBatches > 0 
            ? `Sync completed with ${failedBatches} failed batch${failedBatches !== 1 ? 'es' : ''}. Successfully processed ${batchNumber - failedBatches}/${batchNumber} batches.`
            : `Full sync completed! Fetched ALL conversations successfully.`,
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount,
          total: insertedCount + updatedCount,
          totalConversationsFetched: totalConversations,
          eventsCreated: totalEventsCreated,
          computeContactTiming: insertedCount > 0,
          batches: batchNumber,
          failedBatches: failedBatches,
          successRate: `${successRate}%`,
          duration: `${syncDuration}s`,
          syncMode: syncMode
        });

        controller.close();
      } catch (error) {
        console.error('[Sync Stream] Critical error during sync:', error);
        send({ 
          error: error instanceof Error ? error.message : 'Sync failed',
          status: 'error',
          message: 'Critical error occurred during sync. Please try again.'
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





