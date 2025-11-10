import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';
import { fetchWithRetry } from '@/lib/facebook/rate-limit-handler';

// Optimized for maximum speed with parallel processing
const FACEBOOK_API_LIMIT = 100;
const MAX_CONVERSATIONS = 50000; // Increased limit
const MAX_DURATION_MS = 270000; // 4.5 minutes
const PARALLEL_BATCHES = 3; // Fetch 3 pages simultaneously

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * OPTIMIZED PARALLEL SYNC - Faster approach
 * Fetches multiple pages from Facebook in parallel
 * Always does full sync (no incremental issues)
 */
export async function POST(request: NextRequest) {
  const syncStartTime = Date.now();
  
  try {
    const user = await getFacebookAuthUser();
    if (!user || !(await hasFacebookToken(user))) {
      return NextResponse.json(
        { error: 'Not authenticated or missing Facebook token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pageId, facebookPageId } = body;

    if (!pageId || !facebookPageId) {
      return NextResponse.json({ error: 'Page ID required' }, { status: 400 });
    }

    console.log('[Sync Parallel] Starting PARALLEL OPTIMIZED SYNC:', facebookPageId);

    const supabase = await createClient();
    const { data: page } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const stats = {
      totalFetched: 0,
      totalInserted: 0,
      totalUpdated: 0,
      totalEvents: 0,
      batches: 0,
      errors: [] as string[]
    };

    // ALWAYS FULL SYNC - No incremental issues
    // Incremental sync causes too many problems
    const baseUrl = `https://graph.facebook.com/v18.0/${page.facebook_page_id}/conversations?fields=participants,updated_time,messages.limit(10){message,created_time,from}&limit=${FACEBOOK_API_LIMIT}&access_token=${page.access_token}`;
    
    console.log('[Sync Parallel] Mode: FULL SYNC (always fetches ALL conversations)');

    const allConversationsToInsert: Array<{
      user_id: string;
      page_id: string;
      sender_id: string;
      sender_name: string;
      last_message_time: string;
      conversation_status: string;
    }> = [];

    let nextUrls = [baseUrl];
    
    // Fetch all pages
    while (nextUrls.length > 0 && stats.totalFetched < MAX_CONVERSATIONS) {
      const elapsed = Date.now() - syncStartTime;
      if (elapsed > MAX_DURATION_MS) {
        console.warn('[Sync Parallel] Timeout approaching, stopping');
        break;
      }

      stats.batches++;
      
      // Fetch up to PARALLEL_BATCHES pages simultaneously
      const currentBatch = nextUrls.splice(0, PARALLEL_BATCHES);
      console.log(`[Sync Parallel] Batch ${stats.batches}: Fetching ${currentBatch.length} pages in parallel...`);

      const fetchPromises = currentBatch.map(async (url) => {
        try {
          const response = await fetchWithRetry(url, {
            maxRetries: 2,
            baseDelay: 1000,
            maxDelay: 10000,
          });
          const data = await response.json();
          
          if (data.error) {
            // Rate limit - wait and return null to retry later
            if (data.error.code === 4 || data.error.code === 17) {
              console.warn('[Sync Parallel] Rate limited, will retry');
              return { conversations: [], nextUrl: url }; // Retry this URL
            }
            throw new Error(data.error.message);
          }
          
          return {
            conversations: data.data || [],
            nextUrl: data.paging?.next || null
          };
        } catch (error) {
          console.error('[Sync Parallel] Fetch error:', error);
          return { conversations: [], nextUrl: null };
        }
      });

      const results = await Promise.all(fetchPromises);

      // Process results
      for (const result of results) {
        const { conversations, nextUrl } = result;
        
        if (nextUrl && !nextUrls.includes(nextUrl)) {
          nextUrls.push(nextUrl);
        }

        stats.totalFetched += conversations.length;

        // Extract conversation data
        for (const conv of conversations) {
          const participants = conv.participants?.data || [];
          const lastTime = conv.updated_time || new Date().toISOString();

          for (const participant of participants) {
            if (participant.id === page.facebook_page_id) continue;

            allConversationsToInsert.push({
              user_id: user.id,
              page_id: page.facebook_page_id,
              sender_id: participant.id,
              sender_name: participant.name || 'Facebook User',
              last_message_time: lastTime,
              conversation_status: 'active'
            });
          }
        }
      }

      console.log(`[Sync Parallel] Progress: ${stats.totalFetched} fetched, ${nextUrls.length} pages queued`);
    }

    console.log('[Sync Parallel] Fetching complete. Saving to database...');
    console.log('[Sync Parallel] Total conversations to save:', allConversationsToInsert.length);

    // Bulk upsert all at once (faster than batching)
    if (allConversationsToInsert.length > 0) {
      // Split into chunks of 1000 to avoid payload limits
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < allConversationsToInsert.length; i += CHUNK_SIZE) {
        const chunk = allConversationsToInsert.slice(i, i + CHUNK_SIZE);
        
        const { data: upserted, error } = await supabase
          .from('messenger_conversations')
          .upsert(chunk, { onConflict: 'page_id,sender_id' })
          .select('created_at, updated_at');

        if (error) {
          console.error('[Sync Parallel] Upsert error:', error);
          stats.errors.push(error.message);
        } else if (upserted) {
          const inserted = upserted.filter(r => r.created_at === r.updated_at).length;
          const updated = upserted.length - inserted;
          stats.totalInserted += inserted;
          stats.totalUpdated += updated;
        }
      }
    }

    // Update last sync
    await supabase
      .from('facebook_pages')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', pageId);

    const totalDuration = ((Date.now() - syncStartTime) / 1000).toFixed(2);
    const conversationsPerSecond = (stats.totalFetched / parseFloat(totalDuration)).toFixed(1);

    console.log('[Sync Parallel] Complete!', {
      duration: totalDuration + 's',
      speed: conversationsPerSecond + ' conversations/sec',
      ...stats
    });

    return NextResponse.json({
      success: true,
      synced: stats.totalInserted + stats.totalUpdated,
      inserted: stats.totalInserted,
      updated: stats.totalUpdated,
      totalFetched: stats.totalFetched,
      batches: stats.batches,
      duration: totalDuration + 's',
      speed: conversationsPerSecond + ' conversations/sec',
      errors: stats.errors,
      message: `Parallel full sync: ${stats.totalInserted + stats.totalUpdated} conversations in ${totalDuration}s`
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Sync failed',
      duration: ((Date.now() - syncStartTime) / 1000).toFixed(2) + 's'
    }, { status: 500 });
  }
}

