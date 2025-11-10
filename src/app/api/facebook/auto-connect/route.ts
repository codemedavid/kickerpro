/**
 * Facebook Auto-Connect Service
 * Automatically connects Facebook pages and syncs conversations on login
 * 
 * This endpoint:
 * 1. Fetches all Facebook pages user has access to
 * 2. Automatically connects them to the database
 * 3. Syncs conversations for each page
 * 4. Returns comprehensive status
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';
import { getUserPages, debugToken } from '@/lib/facebook/token-manager';
import { fetchWithRetry } from '@/lib/facebook/rate-limit-handler';

export const maxDuration = 300; // 5 minutes for initial sync
export const dynamic = 'force-dynamic';

interface PageSyncResult {
  pageId: string;
  pageName: string;
  connected: boolean;
  conversationsSynced: number;
  error?: string;
}

export async function POST() {
  const startTime = Date.now();
  
  try {
    console.log('[Auto-Connect] Starting auto-connect process...');
    
    // Use unified authentication
    const user = await getFacebookAuthUser();
    
    if (!user || !(await hasFacebookToken(user))) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Please log in with Facebook' 
        },
        { status: 401 }
      );
    }

    console.log('[Auto-Connect] User authenticated:', user.id);

    const supabase = await createClient();
    const results: PageSyncResult[] = [];

    // Step 1: Fetch Facebook pages
    console.log('[Auto-Connect] Fetching Facebook pages...');
    const pagesData = await getUserPages(user.facebook_access_token!);

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No Facebook Pages found for this account',
        pages: [],
        results: []
      });
    }

    console.log(`[Auto-Connect] Found ${pagesData.data.length} Facebook pages`);

    // Step 2: Connect each page and sync conversations
    for (const page of pagesData.data) {
      const pageResult: PageSyncResult = {
        pageId: page.id,
        pageName: page.name,
        connected: false,
        conversationsSynced: 0
      };

      try {
        console.log(`[Auto-Connect] Processing page: ${page.name} (${page.id})`);

        // Get token expiration info
        let tokenExpiresAt: string | null = null;
        
        try {
          const tokenInfo = await debugToken(page.access_token);
          
          if (tokenInfo.data && tokenInfo.data.expires_at && tokenInfo.data.expires_at !== 0) {
            tokenExpiresAt = new Date(tokenInfo.data.expires_at * 1000).toISOString();
            console.log(`[Auto-Connect] Page token expires at: ${tokenExpiresAt}`);
          } else {
            tokenExpiresAt = user.facebook_token_expires_at;
            console.log(`[Auto-Connect] Page token has no expiration (tied to user token)`);
          }
        } catch (error) {
          console.warn(`[Auto-Connect] Could not get token expiration:`, error);
          tokenExpiresAt = user.facebook_token_expires_at;
        }

        // Upsert page to database
        const pageData = {
          user_id: user.id,
          facebook_page_id: page.id,
          name: page.name,
          category: page.category || null,
          profile_picture: page.picture?.data?.url || null,
          follower_count: page.followers_count || 0,
          access_token: page.access_token,
          access_token_expires_at: tokenExpiresAt,
          is_active: true,
          updated_at: new Date().toISOString()
        };

        const { data: upsertedPage, error: upsertError } = await supabase
          .from('facebook_pages')
          .upsert(pageData, {
            onConflict: 'user_id,facebook_page_id',
          })
          .select()
          .single();

        if (upsertError) {
          console.error(`[Auto-Connect] Error upserting page ${page.name}:`, upsertError);
          pageResult.error = upsertError.message;
          results.push(pageResult);
          continue;
        }

        pageResult.connected = true;
        console.log(`[Auto-Connect] ✅ Page connected: ${page.name}`);

        // Step 3: Auto-sync conversations for this page
        try {
          console.log(`[Auto-Connect] Syncing conversations for ${page.name}...`);
          const syncResult = await syncPageConversations(
            user.id,
            upsertedPage.id,
            page.id,
            page.access_token
          );
          
          pageResult.conversationsSynced = syncResult.synced;
          console.log(`[Auto-Connect] ✅ Synced ${syncResult.synced} conversations for ${page.name}`);
        } catch (syncError) {
          console.error(`[Auto-Connect] Error syncing conversations for ${page.name}:`, syncError);
          pageResult.error = syncError instanceof Error ? syncError.message : 'Sync failed';
        }

      } catch (error) {
        console.error(`[Auto-Connect] Error processing page ${page.name}:`, error);
        pageResult.error = error instanceof Error ? error.message : 'Unknown error';
      }

      results.push(pageResult);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const connectedCount = results.filter(r => r.connected).length;
    const totalConversations = results.reduce((sum, r) => sum + r.conversationsSynced, 0);

    console.log(`[Auto-Connect] ✅ Complete! Connected ${connectedCount}/${results.length} pages, synced ${totalConversations} conversations in ${duration}s`);

    return NextResponse.json({
      success: true,
      message: `Auto-connected ${connectedCount} page(s) and synced ${totalConversations} conversation(s)`,
      pages: results.length,
      connected: connectedCount,
      totalConversations,
      duration: `${duration}s`,
      results
    });

  } catch (error) {
    console.error('[Auto-Connect] Fatal error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to auto-connect pages';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage 
      },
      { status: 500 }
    );
  }
}

/**
 * Sync conversations for a specific page
 */
async function syncPageConversations(
  userId: string,
  pageDbId: string,
  facebookPageId: string,
  pageAccessToken: string
): Promise<{ synced: number }> {
  const supabase = await createClient();
  const FACEBOOK_API_LIMIT = 50; // Lower limit for initial sync
  const MAX_CONVERSATIONS = 500; // Cap initial sync to avoid timeout
  
  let totalSynced = 0;
  let nextUrl = `https://graph.facebook.com/v18.0/${facebookPageId}/conversations?fields=participants,updated_time,messages{message,created_time,from}&limit=${FACEBOOK_API_LIMIT}&access_token=${pageAccessToken}`;

  while (nextUrl && totalSynced < MAX_CONVERSATIONS) {
    try {
      const response = await fetchWithRetry(nextUrl, {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 5000,
      });

      const data = await response.json();

      if (data.error) {
        console.error('[Auto-Connect Sync] Facebook API error:', data.error);
        break;
      }

      const conversations = data.data || [];
      
      if (conversations.length === 0) break;

      // Prepare conversation payloads
      const conversationPayloads = [];

      for (const conv of conversations) {
        const participants = conv.participants?.data || [];
        const lastTime = conv.updated_time || new Date().toISOString();

        for (const participant of participants) {
          // Skip the page itself
          if (participant.id === facebookPageId) continue;

          conversationPayloads.push({
            user_id: userId,
            page_id: facebookPageId,
            sender_id: participant.id,
            sender_name: participant.name || 'Facebook User',
            last_message_time: lastTime,
            conversation_status: 'active'
          });
        }
      }

      // Bulk upsert conversations
      if (conversationPayloads.length > 0) {
        const { error: upsertError } = await supabase
          .from('messenger_conversations')
          .upsert(conversationPayloads, { 
            onConflict: 'page_id,sender_id',
            ignoreDuplicates: false 
          });

        if (upsertError && upsertError.code === '42P10') {
          // Retry with legacy key
          await supabase
            .from('messenger_conversations')
            .upsert(conversationPayloads, { 
              onConflict: 'user_id,page_id,sender_id',
              ignoreDuplicates: false 
            });
        }

        totalSynced += conversationPayloads.length;
      }

      // Check for next page
      nextUrl = data.paging?.next || null;
      
      // Small delay to avoid rate limiting
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error('[Auto-Connect Sync] Error fetching conversations:', error);
      break;
    }
  }

  // Update last synced timestamp
  await supabase
    .from('facebook_pages')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', pageDbId);

  return { synced: totalSynced };
}

