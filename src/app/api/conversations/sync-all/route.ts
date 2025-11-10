import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Sync all pages in parallel for maximum speed
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

    console.log('[Sync All] Starting parallel sync for all pages...');

    // Get all pages for this user
    const supabase = await createClient();
    const { data: pages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('id, facebook_page_id, name')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (pagesError || !pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'No active pages found' },
        { status: 404 }
      );
    }

    console.log(`[Sync All] Found ${pages.length} pages to sync`);

    // Sync all pages in parallel
    const syncPromises = pages.map(async (page) => {
      try {
        const response = await fetch(`${request.nextUrl.origin}/api/conversations/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify({
            pageId: page.id,
            facebookPageId: page.facebook_page_id
          })
        });

        const result = await response.json();
        
        return {
          pageId: page.facebook_page_id,
          pageName: page.name,
          success: result.success,
          synced: result.synced || 0,
          inserted: result.inserted || 0,
          updated: result.updated || 0,
          syncMode: result.syncMode || 'full',
          error: result.error
        };
      } catch (error) {
        console.error(`[Sync All] Error syncing page ${page.name}:`, error);
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
    });

    // Wait for all syncs to complete
    const results = await Promise.all(syncPromises);

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

    console.log('[Sync All] Parallel sync completed:', totals);

    return NextResponse.json({
      success: true,
      totalPages: pages.length,
      results: results,
      totals: totals,
      message: `Synced ${totals.totalSynced} conversations across ${totals.successCount} page(s) in parallel`
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

