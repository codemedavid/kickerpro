import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';
import { fetchWithRetry } from '@/lib/facebook/rate-limit-handler';

// Enable streaming for real-time updates
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes (Vercel max)
export const dynamic = 'force-dynamic';

interface SyncProgress {
  status: 'processing' | 'complete' | 'error' | 'resuming';
  message: string;
  current: number;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  eventsCreated: number;
  conversationId?: string;
  conversationName?: string;
  lastSyncedId?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const syncStartTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: SyncProgress) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (error) {
          console.error('[Sync Realtime] Error sending data:', error);
        }
      };

      try {
        // Authentication
        const user = await getFacebookAuthUser();
        if (!user || !(await hasFacebookToken(user))) {
          send({
            status: 'error',
            message: 'Not authenticated',
            current: 0,
            total: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            eventsCreated: 0,
            error: 'Not authenticated or missing Facebook token'
          });
          controller.close();
          return;
        }

        const userId = user.id;
        const body = await request.json();
        const { pageId, facebookPageId, resume = false } = body;

        if (!pageId || !facebookPageId) {
          send({
            status: 'error',
            message: 'Page ID required',
            current: 0,
            total: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            eventsCreated: 0,
            error: 'Page ID required'
          });
          controller.close();
          return;
        }

        const supabase = await createClient();
        
        // Get page details
        const { data: page, error: pageError } = await supabase
          .from('facebook_pages')
          .select('id, facebook_page_id, access_token, name, sync_checkpoint')
          .eq('id', pageId)
          .single();

        if (pageError || !page) {
          send({
            status: 'error',
            message: 'Page not found',
            current: 0,
            total: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            eventsCreated: 0,
            error: 'Page not found'
          });
          controller.close();
          return;
        }

        // Get already synced conversation IDs to skip duplicates
        const { data: existingConvos } = await supabase
          .from('messenger_conversations')
          .select('sender_id, page_id')
          .eq('page_id', page.facebook_page_id);

        const syncedSenderIds = new Set<string>(
          (existingConvos || []).map((c: { sender_id: string }) => c.sender_id)
        );

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let totalEventsCreated = 0;
        let currentCount = 0;
        let totalConversations = 0;

        // Checkpoint for resume capability
        let checkpoint = resume && page.sync_checkpoint ? JSON.parse(page.sync_checkpoint) : null;
        const startAfter = checkpoint?.lastSyncedId || null;

        send({
          status: resume ? 'resuming' : 'processing',
          message: resume ? `Resuming from conversation ${checkpoint?.current || 0}...` : 'Starting sync from Facebook...',
          current: checkpoint?.current || 0,
          total: checkpoint?.total || 0,
          inserted: checkpoint?.inserted || 0,
          updated: checkpoint?.updated || 0,
          skipped: checkpoint?.skipped || 0,
          eventsCreated: checkpoint?.eventsCreated || 0,
        });

        // Fetch conversations in batches from Facebook (then display one by one)
        // Using limit=100 (Facebook's max) for optimal performance on large pages
        // For 50,000+ conversations: Can sync ~40,000-60,000 per session with resume
        const BATCH_SIZE = 100; // Facebook API max for conversations endpoint
        let nextUrl = `https://graph.facebook.com/v18.0/${page.facebook_page_id}/conversations?fields=id,participants,updated_time,messages.limit(25){message,created_time,from},senders&limit=${BATCH_SIZE}&access_token=${page.access_token}`;
        
        if (startAfter) {
          nextUrl += `&after=${startAfter}`;
        }

        const MAX_SYNC_DURATION = 270000; // 4.5 minutes (can sync ~40,000-60,000 conversations)
        let conversationsFetched = 0;
        let batchNumber = 0;

        while (nextUrl) {
          // Check timeout
          const elapsed = Date.now() - syncStartTime;
          if (elapsed > MAX_SYNC_DURATION) {
            // Save checkpoint for resume
            await supabase
              .from('facebook_pages')
              .update({
                sync_checkpoint: JSON.stringify({
                  current: currentCount,
                  total: totalConversations,
                  inserted: insertedCount,
                  updated: updatedCount,
                  skipped: skippedCount,
                  eventsCreated: totalEventsCreated,
                  lastSyncedId: nextUrl.split('after=')[1]?.split('&')[0] || null,
                  timestamp: new Date().toISOString()
                })
              })
              .eq('id', pageId);

            send({
              status: 'error',
              message: 'Sync timeout - Progress saved. Click sync again to resume.',
              current: currentCount,
              total: totalConversations,
              inserted: insertedCount,
              updated: updatedCount,
              skipped: skippedCount,
              eventsCreated: totalEventsCreated,
              error: 'timeout'
            });
            break;
          }

          // Fetch one conversation
          let response: Response;
          try {
            response = await fetchWithRetry(nextUrl, {
              maxRetries: 3,
              baseDelay: 1000,
              maxDelay: 10000,
            });
          } catch (error) {
            console.error('[Sync Realtime] Facebook API error:', error);
            
            // Save checkpoint
            await supabase
              .from('facebook_pages')
              .update({
                sync_checkpoint: JSON.stringify({
                  current: currentCount,
                  total: totalConversations,
                  inserted: insertedCount,
                  updated: updatedCount,
                  skipped: skippedCount,
                  eventsCreated: totalEventsCreated,
                  lastSyncedId: nextUrl.split('after=')[1]?.split('&')[0] || null,
                  timestamp: new Date().toISOString()
                })
              })
              .eq('id', pageId);

            send({
              status: 'error',
              message: 'Facebook API error - Progress saved. Click sync again to resume.',
              current: currentCount,
              total: totalConversations,
              inserted: insertedCount,
              updated: updatedCount,
              skipped: skippedCount,
              eventsCreated: totalEventsCreated,
              error: error instanceof Error ? error.message : 'API error'
            });
            break;
          }

          const data = await response.json();

          if (data.error) {
            console.error('[Sync Realtime] Facebook API error:', data.error);
            
            // Save checkpoint
            await supabase
              .from('facebook_pages')
              .update({
                sync_checkpoint: JSON.stringify({
                  current: currentCount,
                  total: totalConversations,
                  inserted: insertedCount,
                  updated: updatedCount,
                  skipped: skippedCount,
                  eventsCreated: totalEventsCreated,
                  lastSyncedId: nextUrl.split('after=')[1]?.split('&')[0] || null,
                  timestamp: new Date().toISOString()
                })
              })
              .eq('id', pageId);

            send({
              status: 'error',
              message: `Facebook error: ${data.error.message}`,
              current: currentCount,
              total: totalConversations,
              inserted: insertedCount,
              updated: updatedCount,
              skipped: skippedCount,
              eventsCreated: totalEventsCreated,
              error: data.error.message
            });
            break;
          }

          const conversations = data.data || [];
          batchNumber++;
          
          // Estimate total conversations from paging info
          // Facebook doesn't give exact count, so we estimate based on batches
          if (!totalConversations && conversations.length === BATCH_SIZE) {
            // Still more to fetch - estimate conservatively
            totalConversations = currentCount + (BATCH_SIZE * 10); // Estimate 10 more batches
          } else if (conversations.length < BATCH_SIZE) {
            // Last batch - we know the total now
            totalConversations = currentCount + conversations.length;
          }

          console.log(`[Sync Realtime] Batch #${batchNumber}: ${conversations.length} conversations`);

          // Process each conversation individually (for UI display)
          for (const conv of conversations) {
            conversationsFetched++;
            currentCount++;

            const participants = conv.participants?.data || [];
            const lastTime = conv.updated_time || new Date().toISOString();
            const messages = conv.messages?.data || [];

            for (const participant of participants) {
              // Skip the page itself
              if (participant.id === page.facebook_page_id) continue;

              const senderId = participant.id;
              const senderName = participant.name || 'Facebook User';

              // Check if already synced (skip duplicates)
              const alreadySynced = syncedSenderIds.has(senderId);

              if (alreadySynced) {
                // Update existing conversation
                const { error: updateError, data: updatedRow } = await supabase
                  .from('messenger_conversations')
                  .update({
                    sender_name: senderName,
                    last_message_time: lastTime,
                    conversation_status: 'active',
                    updated_at: new Date().toISOString()
                  })
                  .eq('page_id', page.facebook_page_id)
                  .eq('sender_id', senderId)
                  .select('id')
                  .single();

                if (!updateError && updatedRow) {
                  updatedCount++;
                  
                  send({
                    status: 'processing',
                    message: `Updated: ${senderName}`,
                    current: currentCount,
                    total: totalConversations || currentCount,
                    inserted: insertedCount,
                    updated: updatedCount,
                    skipped: skippedCount,
                    eventsCreated: totalEventsCreated,
                    conversationId: senderId,
                    conversationName: senderName
                  });
                } else {
                  skippedCount++;
                }
              } else {
                // Insert new conversation
                const { error: insertError, data: insertedRow } = await supabase
                  .from('messenger_conversations')
                  .insert({
                    user_id: userId,
                    page_id: page.facebook_page_id,
                    sender_id: senderId,
                    sender_name: senderName,
                    last_message_time: lastTime,
                    conversation_status: 'active'
                  })
                  .select('id')
                  .single();

                if (!insertError && insertedRow) {
                  insertedCount++;
                  syncedSenderIds.add(senderId);

                  // Create interaction events for new conversations
                  const recentMessages = messages.slice(0, 25);
                  const eventsToInsert = [];

                  for (const msg of recentMessages) {
                    if (!msg.created_time) continue;

                    const isFromPage = msg.from?.id === page.facebook_page_id;
                    const isFromContact = msg.from?.id === senderId;

                    if (!isFromPage && !isFromContact) continue;

                    eventsToInsert.push({
                      user_id: userId,
                      conversation_id: insertedRow.id,
                      sender_id: senderId,
                      event_type: isFromContact ? 'message_replied' : 'message_sent',
                      event_timestamp: msg.created_time,
                      channel: 'messenger',
                      is_outbound: isFromPage,
                      is_success: isFromContact,
                      success_weight: isFromContact ? 1.0 : 0.0,
                      metadata: {
                        source: 'realtime_sync',
                        synced_at: new Date().toISOString()
                      }
                    });
                  }

                  if (eventsToInsert.length > 0) {
                    const { error: eventsError } = await supabase
                      .from('contact_interaction_events')
                      .insert(eventsToInsert);

                    if (!eventsError) {
                      totalEventsCreated += eventsToInsert.length;
                    }
                  }

                  send({
                    status: 'processing',
                    message: `New: ${senderName}`,
                    current: currentCount,
                    total: totalConversations || currentCount,
                    inserted: insertedCount,
                    updated: updatedCount,
                    skipped: skippedCount,
                    eventsCreated: totalEventsCreated,
                    conversationId: senderId,
                    conversationName: senderName
                  });
                } else {
                  skippedCount++;
                  console.error('[Sync Realtime] Insert error:', insertError);
                }
              }
            }
          }

          // Get next URL for pagination
          nextUrl = data.paging?.next || null;

          // Minimal delay between batches for maximum throughput on large pages
          // 50ms allows ~20 batches/second = ~2000 conversations/second display rate
          if (nextUrl && batchNumber % 5 === 0) {
            // Only delay every 5 batches to avoid overwhelming the client
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        // If we completed without timeout, update total to actual count
        if (!nextUrl) {
          totalConversations = currentCount;
        }

        // Sync complete - clear checkpoint
        const duration = ((Date.now() - syncStartTime) / 1000).toFixed(2);
        
        await supabase
          .from('facebook_pages')
          .update({
            last_synced_at: new Date().toISOString(),
            sync_checkpoint: null // Clear checkpoint on successful completion
          })
          .eq('id', pageId);

        send({
          status: 'complete',
          message: `Sync complete! ${insertedCount} new, ${updatedCount} updated`,
          current: currentCount,
          total: currentCount,
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount,
          eventsCreated: totalEventsCreated
        });

        console.log('[Sync Realtime] Complete:', {
          duration: `${duration}s`,
          total: currentCount,
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount,
          events: totalEventsCreated
        });

        controller.close();
      } catch (error) {
        console.error('[Sync Realtime] Unexpected error:', error);
        send({
          status: 'error',
          message: 'Unexpected error occurred',
          current: 0,
          total: 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          eventsCreated: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
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

