import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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

    const body = await request.json();
    const { pageId, facebookPageId } = body;

    if (!pageId || !facebookPageId) {
      return NextResponse.json(
        { error: 'Page ID required' },
        { status: 400 }
      );
    }

    console.log('[Sync Conversations] Syncing for page:', facebookPageId);

    // Get page access token from database
    const supabase = await createClient();
    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('id, facebook_page_id, access_token')
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
    let totalConversations = 0;
    const apiUrl = 'https://graph.facebook.com/v18.0/' + effectiveFacebookPageId + '/conversations?fields=participants,updated_time&limit=100&access_token=' + page.access_token;
    let nextUrl = apiUrl;

    console.log('[Sync Conversations] Starting to fetch ALL conversations from Facebook...');

    // Fetch all pages of conversations from Facebook
    while (nextUrl) {
      console.log('[Sync Conversations] Fetching batch...');
      const response = await fetch(nextUrl);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[Sync Conversations] Facebook API error:', error);
        throw new Error(error.error?.message || 'Failed to fetch conversations');
      }

      const data = await response.json();
      const conversations = data.data || [];
      totalConversations += conversations.length;
      
      console.log('[Sync Conversations] Processing batch of', conversations.length, 'conversations');

      // Process each conversation
      for (const conv of conversations) {
        const participants = conv.participants?.data || [];
        const lastTime = conv.updated_time || new Date().toISOString();

        for (const participant of participants) {
          // Skip the page itself
          if (participant.id === effectiveFacebookPageId) continue;

          try {
            const payload = {
              user_id: userId,
              page_id: effectiveFacebookPageId,
              sender_id: participant.id,
              sender_name: participant.name || 'Facebook User',
              last_message_time: lastTime,
              conversation_status: 'active'
            };

            const attemptUpsert = async (onConflict: string) =>
              supabase
                .from('messenger_conversations')
                .upsert(payload, { onConflict })
                .select('id, created_at, updated_at');

            let { data: upsertedRows, error: upsertError } = await attemptUpsert('page_id,sender_id');

            if (upsertError && upsertError.code === '42P10') {
              console.warn('[Sync Conversations] Missing unique constraint for new key. Retrying with legacy key.');
              ({ data: upsertedRows, error: upsertError } = await attemptUpsert('user_id,page_id,sender_id'));
            }

            if (upsertError) {
              console.error('[Sync Conversations] Error upserting conversation:', upsertError);
              continue;
            }

            if (upsertedRows) {
              for (const row of upsertedRows) {
                syncedConversationIds.add(row.id);
                if (row.created_at === row.updated_at) {
                  insertedCount++;
                } else {
                  updatedCount++;
                }
              }
            }
          } catch (error) {
            console.error('[Sync Conversations] Error processing participant:', error);
          }
        }
      }

      // Check if there's a next page
      nextUrl = data.paging?.next || null;
      
      if (nextUrl) {
        console.log('[Sync Conversations] More conversations available, fetching next batch...');
      }
    }

    const uniqueSynced = syncedConversationIds.size;
    console.log('[Sync Conversations] Completed! Total conversations from Facebook:', totalConversations);
    console.log('[Sync Conversations] Successfully synced:', uniqueSynced, 'conversations', {
      inserted: insertedCount,
      updated: updatedCount
    });

    // Auto-score if enabled in settings (for new/updated conversations only)
    try {
      const { data: scoringSettings } = await supabase
        .from('lead_scoring_settings')
        .select('auto_score_on_sync')
        .eq('user_id', userId)
        .single();

      if (scoringSettings?.auto_score_on_sync && syncedConversationIds.size > 0) {
        console.log('[Sync Conversations] Auto-scoring conversations...');
        
        // Trigger scoring asynchronously (don't wait for completion)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const analyzeUrl = baseUrl + '/api/leads/analyze';
        fetch(analyzeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationIds: Array.from(syncedConversationIds),
            pageId: page.id,
            autoTag: true
          })
        }).catch(err => {
          console.warn('[Sync Conversations] Auto-scoring failed:', err);
        });
      }
    } catch (settingsError) {
      console.warn('[Sync Conversations] Could not check scoring settings:', settingsError);
    }

    return NextResponse.json({
      success: true,
      synced: uniqueSynced,
      inserted: insertedCount,
      updated: updatedCount,
      total: totalConversations,
      message: 'Synced ' + uniqueSynced + ' conversation(s) from Facebook'
    });
  } catch (error) {
    console.error('[Sync Conversations] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to sync conversations'
      },
      { status: 500 }
    );
  }
}
