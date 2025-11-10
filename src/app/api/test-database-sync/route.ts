import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser } from '@/lib/facebook/auth-helper';

/**
 * Test if database inserts are working
 * POST /api/test-database-sync
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getFacebookAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { pageId, facebookPageId } = body;

    const supabase = await createClient();
    
    // Get page data
    const { data: page } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Test 1: Try to insert a test conversation
    const testPayload = {
      user_id: user.id,
      page_id: facebookPageId,
      sender_id: 'test_sender_' + Date.now(),
      sender_name: 'Test Contact',
      last_message_time: new Date().toISOString(),
      conversation_status: 'active'
    };

    const { data: inserted, error: insertError } = await supabase
      .from('messenger_conversations')
      .insert(testPayload)
      .select();

    const test1 = {
      test: 'Direct Insert',
      status: !insertError ? '✅' : '❌',
      error: insertError?.message,
      inserted: inserted ? 'YES' : 'NO'
    };

    // Test 2: Try upsert (like sync does)
    const upsertPayload = {
      user_id: user.id,
      page_id: facebookPageId,
      sender_id: 'test_upsert_' + Date.now(),
      sender_name: 'Test Upsert Contact',
      last_message_time: new Date().toISOString(),
      conversation_status: 'active'
    };

    const { data: upserted, error: upsertError } = await supabase
      .from('messenger_conversations')
      .upsert(upsertPayload, { onConflict: 'page_id,sender_id' })
      .select();

    const test2 = {
      test: 'Upsert (like sync)',
      status: !upsertError ? '✅' : '❌',
      error: upsertError?.message,
      upserted: upserted ? 'YES' : 'NO'
    };

    // Test 3: Check current count
    const { count } = await supabase
      .from('messenger_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('page_id', facebookPageId);

    // Test 4: Skip constraint check (not needed for this test)
    const constraints = null;

    // Cleanup test data
    if (inserted) {
      await supabase
        .from('messenger_conversations')
        .delete()
        .eq('sender_id', testPayload.sender_id);
    }
    if (upserted) {
      await supabase
        .from('messenger_conversations')
        .delete()
        .eq('sender_id', upsertPayload.sender_id);
    }

    // Test 5: Check if incremental sync is the issue
    const syncMode = page.last_synced_at ? 'incremental' : 'full';
    const test5 = {
      test: 'Sync Mode',
      status: syncMode === 'incremental' ? '⚠️' : '✅',
      mode: syncMode,
      lastSynced: page.last_synced_at,
      recommendation: syncMode === 'incremental' 
        ? 'Use forceFull=true to get ALL conversations'
        : 'Full sync mode active'
    };

    return NextResponse.json({
      summary: {
        currentCount: count || 0,
        canInsert: !insertError,
        canUpsert: !upsertError,
        syncMode,
        lastSynced: page.last_synced_at
      },
      tests: [test1, test2, test5],
      issues: [
        ...(insertError ? ['Cannot insert: ' + insertError.message] : []),
        ...(upsertError ? ['Cannot upsert: ' + upsertError.message] : []),
        ...(syncMode === 'incremental' ? ['Using incremental sync - use forceFull=true'] : [])
      ],
      recommendations: syncMode === 'incremental'
        ? ['Clear last_synced_at OR use forceFull=true parameter']
        : ['Database inserts working - check Facebook API response']
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Test failed'
    }, { status: 500 });
  }
}

