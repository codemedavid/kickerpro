import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';
import { fetchWithRetry } from '@/lib/facebook/rate-limit-handler';

// Facebook API settings
const FACEBOOK_API_LIMIT = 100;
const MAX_CONVERSATIONS_PER_SYNC = 10000; // Hard limit
const MAX_SYNC_DURATION_MS = 270000; // 4.5 minutes

// Enable extended timeout for large syncs
export const maxDuration = 300; // 5 minutes (Vercel max)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const syncStartTime = Date.now();
  try {
    // Use unified authentication
    const user = await getFacebookAuthUser();

    if (!user || !(await hasFacebookToken(user))) {
      return NextResponse.json(
        { error: 'Not authenticated or missing Facebook token' },
        { status: 401 }
      );
    }

    const userId = user.id;

    const body = await request.json();
    const { pageId, facebookPageId, forceFull = false } = body;

    if (!pageId || !facebookPageId) {
      return NextResponse.json(
        { error: 'Page ID required' },
        { status: 400 }
      );
    }

    console.log('[Sync Conversations] Syncing for page:', facebookPageId, forceFull ? '(FORCE FULL SYNC)' : '');

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

      const syncedConversationIds = new Set<string>();
      let insertedCount = 0;
      let updatedCount = 0;
      const skippedCount = 0;
    let totalConversations = 0;
    let totalEventsCreated = 0;
    
    // IMPROVED APPROACH: Smart sync detection
    // - Default to FULL sync (always get everything)
    // - Only use incremental if synced within last 15 minutes
    // - This prevents missing conversations while still being efficient
    
    const now = new Date();
    const lastSyncTime = page.last_synced_at ? new Date(page.last_synced_at) : null;
    const minutesSinceSync = lastSyncTime 
      ? (now.getTime() - lastSyncTime.getTime()) / (1000 * 60) 
      : Infinity;
    
    // Only use incremental if synced very recently (< 15 minutes)
    // This prevents missing conversations from incremental mode issues
    const useIncremental = !forceFull && lastSyncTime && minutesSinceSync < 15;
    const sinceParam = useIncremental 
      ? `&since=${Math.floor(lastSyncTime.getTime() / 1000)}` 
      : '';
    
    let nextUrl = `https://graph.facebook.com/v18.0/${effectiveFacebookPageId}/conversations?fields=participants,updated_time,messages{message,created_time,from}&limit=${FACEBOOK_API_LIMIT}${sinceParam}&access_token=${page.access_token}`;

    const syncMode = useIncremental ? 'incremental' : 'full';
    console.log(`[Sync Conversations] Starting ${syncMode} sync for page:`, facebookPageId);
    console.log('[Sync Conversations] Sync decision:', {
      forceFull,
      lastSyncedAt: page.last_synced_at,
      minutesSinceSync: minutesSinceSync.toFixed(1),
      useIncremental,
      reason: useIncremental 
        ? 'Recent sync (<15 min) - using incremental'
        : forceFull 
          ? 'Forced full sync'
          : !lastSyncTime 
            ? 'Never synced - using full'
            : 'Old sync (>15 min) - using full for safety'
    });

        // Fetch all pages of conversations from Facebook
    while (nextUrl && totalConversations < MAX_CONVERSATIONS_PER_SYNC) {
      // Check timeout
      const elapsed = Date.now() - syncStartTime;
      if (elapsed > MAX_SYNC_DURATION_MS) {
        console.warn('[Sync Conversations] Approaching timeout limit, stopping gracefully');
        console.log('[Sync Conversations] Partial sync completed:', {
          totalConversations,
          insertedCount,
          updatedCount,
          elapsed: `${(elapsed / 1000).toFixed(1)}s`
        });
        break;
      }

      console.log('[Sync Conversations] Fetching batch...');
      
      let response: Response;
      try {
        // Use rate limit aware fetch with automatic retry
        response = await fetchWithRetry(nextUrl, {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 32000,
        });
      } catch (error) {
        console.error('[Sync Conversations] Facebook API error (retrying):', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Failed to fetch conversations';
        
        // DON'T throw - continue with what we have
        console.warn('[Sync Conversations] Batch failed, but continuing with partial results');
        console.log('[Sync Conversations] Synced so far:', totalConversations, 'conversations');
        
        // Wait a bit and try to continue
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to get next URL from paging if available
        // If this was a temporary error, we can continue
        // For now, stop gracefully and save what we have
        break;
      }

      const data = await response.json();
      
      // Check for Facebook API errors in response
      if (data.error) {
        console.error('[Sync Conversations] Facebook API returned error:', data.error);
        
        // If it's a rate limit, wait and continue
        if (data.error.code === 4 || data.error.code === 17 || data.error.message?.includes('rate limit')) {
          console.warn('[Sync Conversations] Rate limited! Waiting 60 seconds before continuing...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          // Continue to next iteration - don't break
          continue;
        }
        
        // For other errors, log but continue with what we have
        console.warn('[Sync Conversations] API error, stopping gracefully:', data.error.message);
        break;
      }
      
      const conversations = data.data || [];
      totalConversations += conversations.length;
      
      console.log('[Sync Conversations] Processing batch of', conversations.length, 'conversations (total:', totalConversations, ')');

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
          // Skip the page itself
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
          console.warn('[Sync Conversations] Missing unique constraint for new key. Retrying with legacy key.');
          ({ data: upsertedRows, error: upsertError } = await attemptUpsert('user_id,page_id,sender_id'));
        }

        if (upsertError) {
          console.error('[Sync Conversations] Error bulk upserting conversations:', upsertError);
          console.warn('[Sync Conversations] Database error, but continuing with next batch');
          // Continue with next batch instead of failing completely
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
                console.error('[Sync Conversations] Error inserting events chunk:', eventsError);
                console.warn('[Sync Conversations] Events insert failed, but conversations were saved');
                // Continue - events are optional, conversations are what matters
              } else {
                totalEventsCreated += chunk.length;
              }
            }
          }
        }
      }

      // Check if there's a next page
      nextUrl = data.paging?.next || null;
      
      if (nextUrl) {
        console.log('[Sync Conversations] More conversations available, fetching next batch...');
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Log final stats
    const totalDuration = ((Date.now() - syncStartTime) / 1000).toFixed(2);
    const conversationsPerSecond = (totalConversations / parseFloat(totalDuration)).toFixed(1);
    console.log('[Sync Conversations] Final stats:', {
      totalConversations,
      insertedCount,
      updatedCount,
      totalEventsCreated,
      duration: `${totalDuration}s`,
      speed: `${conversationsPerSecond} conversations/sec`
    });

    // Update last sync timestamp
    await supabase
      .from('facebook_pages')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', pageId);

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
      duration: totalDuration + 's',
      speed: conversationsPerSecond + ' conversations/sec',
      message: `${syncMode === 'incremental' ? 'Incremental' : 'Full'} sync: ${uniqueSynced} conversation(s) with ${totalEventsCreated} events in ${totalDuration}s`
    });
  } catch (error) {
    console.error('[Sync Conversations] Error:', error);
    
    // Try to parse Facebook error for user-friendly message
    let errorMessage = 'Failed to sync conversations';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check if it's a rate limit error
      if (errorMessage.includes('Rate limit')) {
        statusCode = 429;
      } else if (errorMessage.includes('expired') || errorMessage.includes('Invalid token')) {
        statusCode = 401;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
