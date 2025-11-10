import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { batchFetchConversations } from '@/lib/facebook/batch-api';
import { withPooledClient } from '@/lib/supabase/pool';

// Sync all pages using Facebook Batch API for maximum speed
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

    console.log('[Sync All⚡] Starting ultra-fast batch sync...');
    const startTime = Date.now();

    // Get all pages for this user with access tokens
    const supabase = await createClient();
    const { data: pages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('id, facebook_page_id, name, access_token, last_synced_at')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (pagesError || !pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'No active pages found' },
        { status: 404 }
      );
    }

    console.log(`[Sync All⚡] Batch fetching ${pages.length} pages...`);

    // Use Facebook Batch API to fetch all conversations in parallel
    const conversationsByPage = await batchFetchConversations(
      pages.map(p => ({
        facebookPageId: p.facebook_page_id,
        accessToken: p.access_token,
        lastSyncTime: p.last_synced_at
      }))
    );

    console.log(`[Sync All⚡] Fetched conversations in ${Date.now() - startTime}ms`);

    // Process all conversations with connection pooling
    const results = await Promise.all(pages.map(async (page) => {
      const conversations = conversationsByPage.get(page.facebook_page_id) || [];
      
      try {
        let insertedCount = 0;
        let updatedCount = 0;

        if (conversations.length > 0) {
          await withPooledClient(async (supabase) => {
            // Prepare bulk payload
            const conversationPayloads = [];
            
            for (const conv of conversations) {
              const participants = conv.participants?.data || [];
              const lastTime = conv.updated_time || new Date().toISOString();

              for (const participant of participants) {
                if (participant.id === page.facebook_page_id) continue;

                conversationPayloads.push({
                  user_id: userId,
                  page_id: page.facebook_page_id,
                  sender_id: participant.id,
                  sender_name: participant.name || 'Facebook User',
                  last_message_time: lastTime,
                  conversation_status: 'active'
                });
              }
            }

            // Bulk upsert
            if (conversationPayloads.length > 0) {
              const { data: upsertedRows } = await supabase
                .from('messenger_conversations')
                .upsert(conversationPayloads, { 
                  onConflict: 'page_id,sender_id',
                  ignoreDuplicates: false 
                })
                .select('id, created_at, updated_at');

              if (upsertedRows) {
                for (const row of upsertedRows) {
                  if (row.created_at === row.updated_at) {
                    insertedCount++;
                  } else {
                    updatedCount++;
                  }
                }
              }
            }

            // Update last sync time
            await supabase
              .from('facebook_pages')
              .update({ last_synced_at: new Date().toISOString() })
              .eq('id', page.id);
          });
        }

        return {
          pageId: page.facebook_page_id,
          pageName: page.name,
          success: true,
          synced: insertedCount + updatedCount,
          inserted: insertedCount,
          updated: updatedCount,
          syncMode: page.last_synced_at ? 'incremental' : 'full'
        };
      } catch (error) {
        console.error(`[Sync All⚡] Error processing ${page.name}:`, error);
        return {
          pageId: page.facebook_page_id,
          pageName: page.name,
          success: false,
          synced: 0,
          inserted: 0,
          updated: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }));

    // Calculate totals
    const totals = results.reduce((acc, result) => ({
      totalSynced: acc.totalSynced + result.synced,
      totalInserted: acc.totalInserted + result.inserted,
      totalUpdated: acc.totalUpdated + result.updated,
      successCount: acc.successCount + (result.success ? 1 : 0),
      failureCount: acc.failureCount + (result.success ? 0 : 1)
    }), {
      totalSynced: 0,
      totalInserted: 0,
      totalUpdated: 0,
      successCount: 0,
      failureCount: 0
    });

    const duration = Date.now() - startTime;
    console.log(`[Sync All⚡] Completed in ${duration}ms:`, totals);

    return NextResponse.json({
      success: true,
      totalPages: pages.length,
      results: results,
      totals: totals,
      duration: duration,
      message: `Ultra-fast sync: ${totals.totalSynced} conversations across ${totals.successCount} page(s) in ${duration}ms`
    });
  } catch (error) {
    console.error('[Sync All] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to sync all pages'
      },
      { status: 500 }
    );
  }
}

