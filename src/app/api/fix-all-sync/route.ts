import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser } from '@/lib/facebook/auth-helper';

/**
 * AUTOMATED FIX: Clear all last_synced_at timestamps
 * This forces full sync for ALL pages for ALL users
 * POST /api/fix-all-sync
 */
export async function POST(_request: NextRequest) {
  try {
    const user = await getFacebookAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get current state before clearing
    const { data: beforePages } = await supabase
      .from('facebook_pages')
      .select('id, name, facebook_page_id, last_synced_at')
      .eq('user_id', user.id);

    const pagesWithTimestamp = (beforePages || []).filter(p => p.last_synced_at !== null);

    // Clear last_synced_at for ALL pages for this user
    const { error } = await supabase
      .from('facebook_pages')
      .update({ last_synced_at: null })
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({
        error: 'Failed to clear timestamps: ' + error.message
      }, { status: 500 });
    }

    // Get state after clearing
    const { data: afterPages } = await supabase
      .from('facebook_pages')
      .select('id, name, last_synced_at')
      .eq('user_id', user.id);

    const clearedCount = (afterPages || []).filter(p => p.last_synced_at === null).length;

    console.log('[Fix All Sync] Cleared last_synced_at for', clearedCount, 'pages');

    return NextResponse.json({
      success: true,
      message: `Cleared sync timestamps for ${clearedCount} page(s)`,
      details: {
        totalPages: (afterPages || []).length,
        pagesCleared: clearedCount,
        pagesAffected: pagesWithTimestamp.map(p => ({
          name: p.name,
          previousLastSync: p.last_synced_at
        }))
      },
      nextStep: 'Go to /admin/sync-all and click "Force Full Sync ALL Pages"',
      expected: 'Will now fetch ALL conversations from ALL pages (full sync mode)'
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fix sync'
    }, { status: 500 });
  }
}

