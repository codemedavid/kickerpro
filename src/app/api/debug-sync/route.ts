import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';

/**
 * Debug sync - Shows exactly what would be synced without saving
 * GET /api/debug-sync?pageId=xxx&facebookPageId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getFacebookAuthUser();
    if (!user || !(await hasFacebookToken(user))) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const facebookPageId = searchParams.get('facebookPageId');
    const forceFull = searchParams.get('forceFull') === 'true';

    if (!pageId || !facebookPageId) {
      return NextResponse.json({ 
        error: 'Required: pageId and facebookPageId query parameters' 
      }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: page } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Check what mode we're in
    const lastSyncTime = forceFull ? null : page.last_synced_at;
    const sinceParam = lastSyncTime 
      ? `&since=${Math.floor(new Date(lastSyncTime).getTime() / 1000)}` 
      : '';
    const syncMode = forceFull ? 'full (forced)' : (lastSyncTime ? 'incremental' : 'full');

    // Fetch FIRST batch from Facebook (don't save, just check)
    const testUrl = `https://graph.facebook.com/v18.0/${page.facebook_page_id}/conversations?fields=participants,updated_time&limit=100${sinceParam}&access_token=${page.access_token}`;
    
    const response = await fetch(testUrl);
    const data = await response.json();

    if (data.error) {
      return NextResponse.json({
        error: 'Facebook API error',
        facebookError: data.error,
        details: {
          code: data.error.code,
          message: data.error.message,
          type: data.error.type
        }
      }, { status: 400 });
    }

    const conversations = data.data || [];
    
    // Analyze what would be saved
    const conversationPayloads = [];
    for (const conv of conversations) {
      const participants = conv.participants?.data || [];
      for (const participant of participants) {
        if (participant.id === page.facebook_page_id) continue;
        
        conversationPayloads.push({
          sender_id: participant.id,
          sender_name: participant.name || 'Facebook User',
          page_id: page.facebook_page_id
        });
      }
    }

    // Check which ones already exist in database
    const senderIds = conversationPayloads.map(c => c.sender_id);
    const { data: existing } = await supabase
      .from('messenger_conversations')
      .select('sender_id')
      .eq('page_id', page.facebook_page_id)
      .in('sender_id', senderIds);

    const existingIds = new Set((existing || []).map(e => e.sender_id));
    const newConversations = conversationPayloads.filter(c => !existingIds.has(c.sender_id));
    const existingConversations = conversationPayloads.filter(c => existingIds.has(c.sender_id));

    // Check database count
    const { count: currentCount } = await supabase
      .from('messenger_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('page_id', page.facebook_page_id);

    return NextResponse.json({
      summary: {
        syncMode,
        lastSyncedAt: page.last_synced_at,
        currentDatabaseCount: currentCount || 0,
        facebookReturnedInFirstBatch: conversations.length,
        validConversationsInBatch: conversationPayloads.length,
        alreadyInDatabase: existingConversations.length,
        wouldBeInserted: newConversations.length,
        hasMorePages: !!data.paging?.next
      },
      diagnosis: {
        issue: newConversations.length === 0 && conversations.length > 0
          ? '❌ ALL conversations in first batch already exist in database'
          : newConversations.length === 0 && conversations.length === 0
            ? '❌ Facebook returned 0 conversations'
            : `✅ Would insert ${newConversations.length} new conversations`,
        syncModeWarning: syncMode === 'incremental' 
          ? '⚠️ Using INCREMENTAL mode - only gets recently updated conversations'
          : null,
        recommendation: newConversations.length === 0
          ? syncMode === 'incremental'
            ? 'Use forceFull=true or clear last_synced_at to fetch ALL conversations'
            : 'Facebook is not returning any conversations - check token and permissions'
          : `Ready to sync ${newConversations.length} new conversations`
      },
      details: {
        sampleNewConversations: newConversations.slice(0, 5),
        sampleExistingConversations: existingConversations.slice(0, 5),
        facebookUrl: testUrl.replace(page.access_token, '***TOKEN***'),
        nextPageUrl: data.paging?.next ? 'YES (more data available)' : 'NO (end of data)'
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Test failed',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

