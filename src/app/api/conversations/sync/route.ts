import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;
    const accessToken = cookieStore.get('fb-access-token')?.value;

    if (!userId || !accessToken) {
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
      .select('access_token')
      .eq('id', pageId)
      .single();

    if (pageError || !page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    let syncedCount = 0;
    let totalConversations = 0;
    let nextUrl = `https://graph.facebook.com/v18.0/${facebookPageId}/conversations?fields=participants,updated_time&limit=100&access_token=${page.access_token}`;

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
          if (participant.id === facebookPageId) continue;

          try {
            const { error: upsertError } = await supabase
              .from('messenger_conversations')
              .upsert({
                user_id: userId,
                page_id: facebookPageId,
                sender_id: participant.id,
                sender_name: participant.name || 'Facebook User',
                last_message_time: lastTime,
                conversation_status: 'active',
                message_count: 1
              }, {
                onConflict: 'user_id,page_id,sender_id'
              });

            if (upsertError) {
              console.error('[Sync Conversations] Error upserting conversation:', upsertError);
            } else {
              syncedCount++;
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

    console.log('[Sync Conversations] Completed! Total conversations from Facebook:', totalConversations);
    console.log('[Sync Conversations] Successfully synced:', syncedCount, 'conversations');

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: totalConversations,
      message: `Synced ${syncedCount} conversations from Facebook`
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
