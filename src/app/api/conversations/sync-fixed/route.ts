import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';
import { fetchWithRetry } from '@/lib/facebook/rate-limit-handler';
import { v4 as uuidv4 } from 'uuid';

// Facebook API settings
const FACEBOOK_API_LIMIT = 100;
const MAX_CONVERSATIONS_PER_SYNC = 10000;
const MAX_SYNC_DURATION_MS = 270000; // 4.5 minutes
const LOCK_DURATION_SECONDS = 300; // 5 minutes

// Enable extended timeout for large syncs
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface SyncResult {
  success: boolean;
  synced: number;
  inserted: number;
  updated: number;
  skipped: number;
  eventsCreated: number;
  hasMore: boolean;
  nextCursor?: string;
  message: string;
  duration: string;
}

export async function POST(request: NextRequest) {
  const syncStartTime = Date.now();
  const sessionId = uuidv4();
  
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
    const { pageId, facebookPageId, resumeSession = null } = body;

    if (!pageId || !facebookPageId) {
      return NextResponse.json(
        { error: 'Page ID required' },
        { status: 400 }
      );
    }

    console.log('[Sync Fixed] Starting sync for page:', facebookPageId, { sessionId, resumeSession });

    const supabase = await createClient();

    // ============================================================================
    // FIX #12: ACQUIRE SYNC LOCK - Prevent concurrent operations
    // ============================================================================
    const { data: lockAcquired, error: lockError } = await supabase.rpc(
      'acquire_sync_lock',
      {
        p_page_id: facebookPageId,
        p_locked_by: sessionId,
        p_duration_seconds: LOCK_DURATION_SECONDS
      }
    );

    if (lockError) {
      console.error('[Sync Fixed] Lock error:', lockError);
      return NextResponse.json(
        { error: 'Failed to acquire sync lock' },
        { status: 500 }
      );
    }

    if (!lockAcquired) {
      console.warn('[Sync Fixed] Sync already in progress for page:', facebookPageId);
      return NextResponse.json(
        { error: 'Sync already in progress for this page. Please wait for it to complete.' },
        { status: 409 } // Conflict
      );
    }

    console.log('[Sync Fixed] ✓ Lock acquired for page:', facebookPageId);

    try {
      // Get page access token
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

      // ============================================================================
      // FIX #11: CURSOR-BASED RESUMPTION - Resume from last position
      // ============================================================================
      let startCursor: string | null = null;
      let syncSessionId = resumeSession || uuidv4();

      if (resumeSession) {
        // Try to resume from existing session
        const { data: existingState } = await supabase
          .from('sync_state')
          .select('last_cursor, total_synced, is_complete')
          .eq('sync_session_id', resumeSession)
          .eq('page_id', effectiveFacebookPageId)
          .single();

        if (existingState && !existingState.is_complete && existingState.last_cursor) {
          startCursor = existingState.last_cursor;
          console.log('[Sync Fixed] ↻ Resuming from cursor:', startCursor, 'Already synced:', existingState.total_synced);
        }
      }

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let totalConversations = 0;
      let totalEventsCreated = 0;
      let batchNumber = 0;

      // Build initial URL with optional cursor
      let nextUrl = startCursor 
        ? startCursor // Resume from exact cursor URL
        : `https://graph.facebook.com/v18.0/${effectiveFacebookPageId}/conversations?fields=participants,updated_time,messages{message,created_time,from,id}&limit=${FACEBOOK_API_LIMIT}&access_token=${page.access_token}`;

      console.log('[Sync Fixed] Starting from:', startCursor ? 'RESUME' : 'BEGINNING');

      // ============================================================================
      // FETCH AND PROCESS CONVERSATIONS
      // ============================================================================
      while (nextUrl && totalConversations < MAX_CONVERSATIONS_PER_SYNC) {
        // Check timeout
        const elapsed = Date.now() - syncStartTime;
        if (elapsed > MAX_SYNC_DURATION_MS) {
          console.warn('[Sync Fixed] Approaching timeout, saving progress...');
          
          // Save state for resumption
          await supabase
            .from('sync_state')
            .upsert({
              page_id: effectiveFacebookPageId,
              user_id: userId,
              last_cursor: nextUrl,
              total_synced: totalConversations,
              is_complete: false,
              sync_session_id: syncSessionId,
              last_synced_at: new Date().toISOString()
            }, {
              onConflict: 'page_id,sync_session_id'
            });

          // Release lock
          await supabase.rpc('release_sync_lock', {
            p_page_id: facebookPageId,
            p_locked_by: sessionId
          });

          return NextResponse.json({
            success: true,
            synced: totalConversations,
            inserted: insertedCount,
            updated: updatedCount,
            skipped: skippedCount,
            eventsCreated: totalEventsCreated,
            hasMore: true,
            nextCursor: nextUrl,
            resumeSession: syncSessionId,
            message: `Partial sync completed. Resume with session ID: ${syncSessionId}`,
            duration: `${(elapsed / 1000).toFixed(1)}s`
          } as SyncResult);
        }

        // Extend lock periodically
        if (batchNumber % 10 === 0 && batchNumber > 0) {
          await supabase.rpc('extend_sync_lock', {
            p_page_id: facebookPageId,
            p_locked_by: sessionId,
            p_duration_seconds: LOCK_DURATION_SECONDS
          });
        }

        batchNumber++;
        console.log('[Sync Fixed] Fetching batch', batchNumber, '...');

        // Fetch with retry
        let response: Response;
        try {
          response = await fetchWithRetry(nextUrl, {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 32000,
          });
        } catch (error) {
          console.error('[Sync Fixed] Fetch error:', error);
          throw error;
        }

        const data = await response.json();

        if (data.error) {
          console.error('[Sync Fixed] Facebook API error:', data.error);
          throw new Error(data.error.message || 'Facebook API error');
        }

        const conversations = data.data || [];
        totalConversations += conversations.length;

        console.log('[Sync Fixed] Processing', conversations.length, 'conversations from batch', batchNumber);

        // ============================================================================
        // FIX #3 & #7: VALIDATE AND PREPARE DATA WITH TRANSACTIONS
        // ============================================================================
        const conversationsPayload: Array<{
          user_id: string;
          page_id: string;
          sender_id: string;
          sender_name: string;
          last_message: string;
          last_message_time: string;
          conversation_status: string;
          events: Array<{
            event_type: string;
            event_timestamp: string;
            channel: string;
            is_outbound: boolean;
            is_success: boolean;
            success_weight: number;
            metadata: Record<string, unknown>;
          }>;
        }> = [];

        for (const conv of conversations) {
          const participants = conv.participants?.data || [];
          const lastTime = conv.updated_time || new Date().toISOString();
          const messages = conv.messages?.data || [];

          for (const participant of participants) {
            // FIX #7: Validate participant data
            if (!participant || !participant.id || typeof participant.id !== 'string') {
              console.warn('[Sync Fixed] Invalid participant, skipping:', participant);
              skippedCount++;
              continue;
            }

            // Skip the page itself
            if (participant.id === effectiveFacebookPageId) continue;

            // Prepare events for this conversation (FIX #8: Process ALL messages, not just 25)
            const events = [];
            for (const msg of messages) {
              if (!msg.created_time) continue;

              const isFromPage = msg.from?.id === effectiveFacebookPageId;
              const isFromContact = msg.from?.id === participant.id;

              if (!isFromPage && !isFromContact) continue;

              events.push({
                event_type: isFromContact ? 'message_replied' : 'message_sent',
                event_timestamp: msg.created_time,
                channel: 'messenger',
                is_outbound: isFromPage,
                is_success: isFromContact,
                success_weight: isFromContact ? 1.0 : 0.0,
                metadata: {
                  source: 'sync',
                  message_id: msg.id || null,
                  synced_at: new Date().toISOString(),
                  batch_number: batchNumber
                }
              });
            }

            // If no messages, create default event
            if (events.length === 0) {
              events.push({
                event_type: 'message_replied',
                event_timestamp: lastTime,
                channel: 'messenger',
                is_outbound: false,
                is_success: true,
                success_weight: 1.0,
                metadata: {
                  source: 'sync_fallback',
                  synced_at: new Date().toISOString()
                }
              });
            }

            conversationsPayload.push({
              user_id: userId,
              page_id: effectiveFacebookPageId,
              sender_id: participant.id,
              sender_name: participant.name || 'Facebook User',
              last_message: messages[0]?.message || '',
              last_message_time: lastTime,
              conversation_status: 'active',
              events
            });
          }
        }

        // ============================================================================
        // FIX #3: USE ATOMIC RPC FUNCTION - Transaction boundary
        // ============================================================================
        if (conversationsPayload.length > 0) {
          console.log('[Sync Fixed] Upserting', conversationsPayload.length, 'conversations with events...');

          const { data: results, error: upsertError } = await supabase.rpc(
            'bulk_upsert_conversations_with_events',
            { p_conversations: conversationsPayload as unknown as Record<string, unknown> }
          );

          if (upsertError) {
            console.error('[Sync Fixed] Bulk upsert error:', upsertError);
            throw new Error(`Failed to upsert conversations: ${upsertError.message}`);
          }

          if (results) {
            for (const result of results as Array<{ is_new: boolean; events_created: number }>) {
              if (result.is_new) {
                insertedCount++;
              } else {
                updatedCount++;
              }
              totalEventsCreated += result.events_created;
            }
          }

          console.log('[Sync Fixed] ✓ Batch', batchNumber, 'complete:', {
            inserted: insertedCount,
            updated: updatedCount,
            eventsCreated: totalEventsCreated
          });
        }

        // Get next page URL
        nextUrl = data.paging?.next || null;

        if (nextUrl) {
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // ============================================================================
      // MARK SYNC AS COMPLETE
      // ============================================================================
      await supabase
        .from('sync_state')
        .upsert({
          page_id: effectiveFacebookPageId,
          user_id: userId,
          last_cursor: null,
          total_synced: totalConversations,
          is_complete: true,
          sync_session_id: syncSessionId,
          last_synced_at: new Date().toISOString()
        }, {
          onConflict: 'page_id,sync_session_id'
        });

      // Update last sync timestamp on page
      await supabase
        .from('facebook_pages')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', pageId);

      const duration = ((Date.now() - syncStartTime) / 1000).toFixed(1);

      console.log('[Sync Fixed] ✅ Sync complete!', {
        totalConversations,
        inserted: insertedCount,
        updated: updatedCount,
        eventsCreated: totalEventsCreated,
        duration: `${duration}s`
      });

      return NextResponse.json({
        success: true,
        synced: totalConversations,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        eventsCreated: totalEventsCreated,
        hasMore: false,
        message: `Sync completed successfully! ${totalConversations} conversations with ${totalEventsCreated} events`,
        duration: `${duration}s`
      } as SyncResult);

    } finally {
      // ============================================================================
      // ALWAYS RELEASE LOCK - Even on error
      // ============================================================================
      const { data: lockReleased } = await supabase.rpc('release_sync_lock', {
        p_page_id: facebookPageId,
        p_locked_by: sessionId
      });

      if (lockReleased) {
        console.log('[Sync Fixed] ✓ Lock released for page:', facebookPageId);
      } else {
        console.warn('[Sync Fixed] ⚠ Failed to release lock (may have expired)');
      }
    }

  } catch (error) {
    console.error('[Sync Fixed] Error:', error);

    let errorMessage = 'Failed to sync conversations';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

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

