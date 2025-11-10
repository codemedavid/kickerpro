/**
 * Background Sync Service
 * Automatically syncs all connected Facebook pages to keep data up-to-date
 * 
 * This endpoint:
 * 1. Finds all active Facebook pages
 * 2. Syncs conversations for each page
 * 3. Updates last_synced_at timestamp
 * 4. Runs on a schedule via cron
 * 
 * Call this endpoint via:
 * - Vercel Cron (recommended for production)
 * - Manual trigger for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { fetchWithRetry } from '@/lib/facebook/rate-limit-handler';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

interface SyncResult {
  pageId: string;
  pageName: string;
  synced: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Sync All] Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Sync All] Starting background sync for all pages...');

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get all active pages
    const { data: pages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('id, facebook_page_id, user_id, name, access_token, last_synced_at')
      .eq('is_active', true)
      .order('last_synced_at', { ascending: true, nullsFirst: true });

    if (pagesError) {
      console.error('[Sync All] Error fetching pages:', pagesError);
      throw pagesError;
    }

    if (!pages || pages.length === 0) {
      console.log('[Sync All] No active pages to sync');
      return NextResponse.json({
        success: true,
        message: 'No active pages to sync',
        pages: 0,
        totalSynced: 0
      });
    }

    console.log(`[Sync All] Found ${pages.length} active page(s) to sync`);

    const results: SyncResult[] = [];
    let totalSynced = 0;

    // Sync each page
    for (const page of pages) {
      const pageResult: SyncResult = {
        pageId: page.facebook_page_id,
        pageName: page.name,
        synced: 0
      };

      try {
        console.log(`[Sync All] Syncing page: ${page.name}`);
        
        const syncResult = await syncPageConversations(
          supabase,
          page.id,
          page.facebook_page_id,
          page.user_id,
          page.access_token,
          page.last_synced_at
        );

        pageResult.synced = syncResult.synced;
        totalSynced += syncResult.synced;

        console.log(`[Sync All] ✅ Synced ${syncResult.synced} conversations for ${page.name}`);

      } catch (error) {
        console.error(`[Sync All] Error syncing page ${page.name}:`, error);
        pageResult.error = error instanceof Error ? error.message : 'Sync failed';
      }

      results.push(pageResult);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successCount = results.filter(r => !r.error).length;

    console.log(`[Sync All] ✅ Complete! Synced ${totalSynced} conversations across ${successCount}/${pages.length} pages in ${duration}s`);

    return NextResponse.json({
      success: true,
      message: `Synced ${totalSynced} conversations across ${successCount} page(s)`,
      pages: pages.length,
      successCount,
      totalSynced,
      duration: `${duration}s`,
      results
    });

  } catch (error) {
    console.error('[Sync All] Fatal error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to sync pages';
    
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
 * Sync conversations for a specific page (incremental sync)
 */
async function syncPageConversations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pageDbId: string,
  facebookPageId: string,
  userId: string,
  pageAccessToken: string,
  lastSyncedAt: string | null
): Promise<{ synced: number }> {
  const FACEBOOK_API_LIMIT = 50;
  const MAX_CONVERSATIONS = 1000; // Reasonable limit for background sync
  
  let totalSynced = 0;
  
  // Use incremental sync if we have a last sync time (only fetch new/updated)
  const sinceParam = lastSyncedAt 
    ? `&since=${new Date(lastSyncedAt).getTime() / 1000}` 
    : '';
  
  let nextUrl = `https://graph.facebook.com/v18.0/${facebookPageId}/conversations?fields=participants,updated_time,messages.limit(1){message,created_time}&limit=${FACEBOOK_API_LIMIT}&access_token=${pageAccessToken}${sinceParam}`;

  console.log(`[Sync Page] Starting ${lastSyncedAt ? 'incremental' : 'full'} sync for page ${facebookPageId}`);

  while (nextUrl && totalSynced < MAX_CONVERSATIONS) {
    try {
      const response = await fetchWithRetry(nextUrl, {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 5000,
      });

      const data = await response.json();

      if (data.error) {
        console.error('[Sync Page] Facebook API error:', data.error);
        break;
      }

      const conversations = data.data || [];
      
      if (conversations.length === 0) break;

      // Prepare conversation payloads
      const conversationPayloads = [];

      for (const conv of conversations) {
        const participants = conv.participants?.data || [];
        const lastTime = conv.updated_time || new Date().toISOString();
        const messages = conv.messages?.data || [];
        const lastMessage = messages[0]?.message || '';

        for (const participant of participants) {
          // Skip the page itself
          if (participant.id === facebookPageId) continue;

          conversationPayloads.push({
            user_id: userId,
            page_id: facebookPageId,
            sender_id: participant.id,
            sender_name: participant.name || 'Facebook User',
            last_message: lastMessage,
            last_message_time: lastTime,
            conversation_status: 'active',
            updated_at: new Date().toISOString()
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
      console.error('[Sync Page] Error fetching conversations:', error);
      break;
    }
  }

  // Update last synced timestamp
  await supabase
    .from('facebook_pages')
    .update({ 
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', pageDbId);

  return { synced: totalSynced };
}

