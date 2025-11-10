import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';
import { fetchWithRetry } from '@/lib/facebook/rate-limit-handler';

// Optimized settings for 10K+ contacts
const FACEBOOK_API_LIMIT = 100; // Max per Facebook
const MAX_CONVERSATIONS_PER_SYNC = 10000; // Hard limit to prevent infinite loops
const DATABASE_BATCH_SIZE = 100; // Insert in parallel batches
const MAX_SYNC_DURATION_MS = 270000; // 4.5 minutes (leave buffer for Vercel 5min limit)

// Enable extended timeout for large syncs
export const maxDuration = 300; // 5 minutes (Vercel max)
export const dynamic = 'force-dynamic';

interface SyncStats {
  totalFetched: number;
  totalInserted: number;
  totalUpdated: number;
  totalEvents: number;
  batches: number;
  startTime: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authentication
    const user = await getFacebookAuthUser();
    if (!user || !(await hasFacebookToken(user))) {
      return NextResponse.json(
        { error: 'Not authenticated or missing Facebook token' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const body = await request.json();
    const { pageId, facebookPageId, maxConversations = MAX_CONVERSATIONS_PER_SYNC } = body;

    if (!pageId || !facebookPageId) {
      return NextResponse.json(
        { error: 'Page ID required' },
        { status: 400 }
      );
    }

    console.log('[Sync Optimized] Starting optimized sync:', {
      pageId,
      facebookPageId,
      maxConversations,
      maxDuration: MAX_SYNC_DURATION_MS
    });

    // Get page access token
    const supabase = await createClient();
    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('id, facebook_page_id, access_token, last_synced_at, name')
      .eq('id', pageId)
      .single();

    if (pageError || !page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const stats: SyncStats = {
      totalFetched: 0,
      totalInserted: 0,
      totalUpdated: 0,
      totalEvents: 0,
      batches: 0,
      startTime,
      errors: []
    };

    // Incremental sync
    const lastSyncTime = page.last_synced_at;
    const sinceParam = lastSyncTime 
      ? `&since=${Math.floor(new Date(lastSyncTime).getTime() / 1000)}` 
      : '';
    
    let nextUrl = `https://graph.facebook.com/v18.0/${page.facebook_page_id}/conversations?fields=participants,updated_time,messages.limit(25){message,created_time,from}&limit=${FACEBOOK_API_LIMIT}${sinceParam}&access_token=${page.access_token}`;

    console.log('[Sync Optimized] Sync mode:', lastSyncTime ? 'incremental' : 'full');

    // Fetch and process in batches
    while (nextUrl && stats.totalFetched < maxConversations) {
      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_SYNC_DURATION_MS) {
        console.warn('[Sync Optimized] Approaching timeout limit, stopping gracefully');
        stats.errors.push('Timeout approaching - partial sync completed');
        break;
      }

      stats.batches++;
      console.log(`[Sync Optimized] Batch ${stats.batches}: Fetching...`);

      // Fetch from Facebook with retry
      let response: Response;
      try {
        response = await fetchWithRetry(nextUrl, {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Facebook API error';
        console.error('[Sync Optimized] Fetch error:', errorMsg);
        stats.errors.push(`Batch ${stats.batches}: ${errorMsg}`);
        break; // Stop on fetch error
      }

      const data = await response.json();
      if (data.error) {
        console.error('[Sync Optimized] Facebook API error:', data.error);
        stats.errors.push(`Facebook: ${data.error.message}`);
        break;
      }

      const conversations = data.data || [];
      stats.totalFetched += conversations.length;

      console.log(`[Sync Optimized] Batch ${stats.batches}: Processing ${conversations.length} conversations (total: ${stats.totalFetched})`);

      // Process conversations in parallel batches
      const conversationBatches = [];
      for (let i = 0; i < conversations.length; i += DATABASE_BATCH_SIZE) {
        conversationBatches.push(conversations.slice(i, i + DATABASE_BATCH_SIZE));
      }

      for (const batch of conversationBatches) {
        try {
          const result = await processBatch(
            supabase,
            batch,
            userId,
            page.facebook_page_id
          );
          
          stats.totalInserted += result.inserted;
          stats.totalUpdated += result.updated;
          stats.totalEvents += result.events;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Batch processing error';
          console.error('[Sync Optimized] Batch processing error:', errorMsg);
          stats.errors.push(`Processing: ${errorMsg}`);
          // Continue with next batch
        }
      }

      // Get next page
      nextUrl = data.paging?.next || null;

      // Log progress
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Sync Optimized] Progress: ${stats.totalFetched} fetched, ${stats.totalInserted} inserted, ${stats.totalUpdated} updated, ${stats.totalEvents} events (${duration}s)`);
    }

    // Update last sync timestamp
    await supabase
      .from('facebook_pages')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', pageId);

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    const conversationsPerSecond = (stats.totalFetched / parseFloat(totalDuration)).toFixed(1);

    console.log('[Sync Optimized] Completed!', {
      ...stats,
      duration: `${totalDuration}s`,
      speed: `${conversationsPerSecond} conversations/sec`
    });

    return NextResponse.json({
      success: true,
      stats: {
        fetched: stats.totalFetched,
        inserted: stats.totalInserted,
        updated: stats.totalUpdated,
        events: stats.totalEvents,
        batches: stats.batches,
        duration: `${totalDuration}s`,
        speed: `${conversationsPerSecond} conversations/sec`,
        errors: stats.errors
      },
      message: stats.errors.length > 0
        ? `Partial sync: ${stats.totalFetched} conversations (${stats.errors.length} errors)`
        : `Successfully synced ${stats.totalFetched} conversations in ${totalDuration}s`
    });

  } catch (error) {
    console.error('[Sync Optimized] Fatal error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Sync failed',
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      },
      { status: 500 }
    );
  }
}

/**
 * Process a batch of conversations in parallel
 */
async function processBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversations: Array<{
    id?: string;
    participants?: { data?: Array<{ id: string; name?: string }> };
    updated_time?: string;
    messages?: { data?: Array<{ message?: string; created_time?: string; from?: { id?: string }; id?: string }> };
  }>,
  userId: string,
  pageId: string
): Promise<{ inserted: number; updated: number; events: number }> {
  
  const conversationPayloads: Array<{
    user_id: string;
    page_id: string;
    sender_id: string;
    sender_name: string;
    last_message_time: string;
    conversation_status: string;
  }> = [];

  const conversationMessages = new Map<string, {
    messages: Array<{ message?: string; created_time?: string; from?: { id?: string }; id?: string }>;
    participantId: string;
  }>();

  // Extract conversation data
  for (const conv of conversations) {
    const participants = conv.participants?.data || [];
    const messages = conv.messages?.data || [];
    const lastTime = conv.updated_time || new Date().toISOString();

    for (const participant of participants) {
      if (participant.id === pageId) continue; // Skip page itself

      conversationPayloads.push({
        user_id: userId,
        page_id: pageId,
        sender_id: participant.id,
        sender_name: participant.name || 'Facebook User',
        last_message_time: lastTime,
        conversation_status: 'active'
      });

      conversationMessages.set(
        `${pageId}-${participant.id}`,
        { messages, participantId: participant.id }
      );
    }
  }

  if (conversationPayloads.length === 0) {
    return { inserted: 0, updated: 0, events: 0 };
  }

  // Bulk upsert conversations
  const { data: upsertedRows, error: upsertError } = await supabase
    .from('messenger_conversations')
    .upsert(conversationPayloads, { 
      onConflict: 'page_id,sender_id',
      ignoreDuplicates: false 
    })
    .select('id, sender_id, page_id, created_at, updated_at');

  if (upsertError) {
    console.error('[Sync Optimized] Upsert error:', upsertError);
    throw new Error(`Database upsert failed: ${upsertError.message}`);
  }

  if (!upsertedRows || upsertedRows.length === 0) {
    return { inserted: 0, updated: 0, events: 0 };
  }

  // Count inserts vs updates
  let inserted = 0;
  let updated = 0;
  const allEvents: Array<{
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
    const isNew = row.created_at === row.updated_at;
    if (isNew) {
      inserted++;

      // Create events for new conversations only
      const key = `${row.page_id}-${row.sender_id}`;
      const messageData = conversationMessages.get(key);

      if (messageData) {
        const { messages, participantId } = messageData;
        const recentMessages = messages.slice(0, 10); // Limit to 10 most recent

        for (const msg of recentMessages) {
          if (!msg.created_time) continue;

          const isFromPage = msg.from?.id === pageId;
          const isFromContact = msg.from?.id === participantId;

          if (!isFromPage && !isFromContact) continue;

          allEvents.push({
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
              source: 'optimized_sync',
              message_id: msg.id || '',
              synced_at: new Date().toISOString()
            }
          });
        }
      }
    } else {
      updated++;
    }
  }

  // Bulk insert events
  let eventsCreated = 0;
  if (allEvents.length > 0) {
    const { error: eventsError } = await supabase
      .from('contact_interaction_events')
      .insert(allEvents);

    if (eventsError) {
      console.error('[Sync Optimized] Events insert error:', eventsError);
      // Don't throw - continue with sync
    } else {
      eventsCreated = allEvents.length;
    }
  }

  return { inserted, updated, events: eventsCreated };
}

