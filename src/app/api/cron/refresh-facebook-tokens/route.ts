import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Automatic Facebook Token Refresh Cron
 * GET /api/cron/refresh-facebook-tokens
 * 
 * Runs daily to check and refresh Facebook page tokens before they expire
 * Configured in vercel.json to run every 24 hours
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Token Refresh Cron] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('='.repeat(80));
    console.log('[Token Refresh Cron] 🔄 Starting automatic token refresh check');
    console.log('='.repeat(80));

    // Get Facebook App credentials
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      console.error('[Token Refresh Cron] Missing Facebook app credentials');
      return NextResponse.json({ 
        error: 'Facebook app credentials not configured',
        message: 'Set NEXT_PUBLIC_FACEBOOK_APP_ID and FACEBOOK_APP_SECRET' 
      }, { status: 500 });
    }

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      console.error('[Token Refresh Cron] Missing Supabase configuration');
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get all Facebook pages
    const { data: pages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('*');

    if (pagesError) {
      console.error('[Token Refresh Cron] Error fetching pages:', pagesError);
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }

    if (!pages || pages.length === 0) {
      console.log('[Token Refresh Cron] No Facebook pages found');
      return NextResponse.json({ 
        message: 'No Facebook pages to refresh',
        refreshed: 0 
      });
    }

    console.log(`[Token Refresh Cron] Found ${pages.length} page(s) to check`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    // Process each page
    for (const page of pages) {
      try {
        console.log(`\n[Token Refresh Cron] Checking: ${page.name || page.facebook_page_id}`);

        if (!page.access_token) {
          console.log('[Token Refresh Cron] ⏭️  Skipped - no access token');
          skippedCount++;
          continue;
        }

        // Step 1: Check if current token is still valid
        console.log('[Token Refresh Cron] 🔍 Testing current token...');
        const testUrl = `https://graph.facebook.com/v18.0/me?access_token=${page.access_token}`;
        
        const testResponse = await fetch(testUrl);
        const testData = await testResponse.json();

        // If token is valid, check if it needs refresh (optional - refresh anyway for safety)
        if (!testData.error) {
          console.log('[Token Refresh Cron] ✅ Current token is valid');
          
          // Get token debug info to check expiration
          const debugUrl = `https://graph.facebook.com/v18.0/debug_token?input_token=${page.access_token}&access_token=${appId}|${appSecret}`;
          const debugResponse = await fetch(debugUrl);
          const debugData = await debugResponse.json();

          if (debugData.data?.expires_at) {
            const expiresAt = new Date(debugData.data.expires_at * 1000);
            const daysUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            
            console.log(`[Token Refresh Cron] Token expires in ${daysUntilExpiry} days (${expiresAt.toISOString()})`);
            
            // Only refresh if less than 7 days remaining
            if (daysUntilExpiry > 7) {
              console.log('[Token Refresh Cron] ⏭️  Skipped - token still has', daysUntilExpiry, 'days');
              skippedCount++;
              results.push({
                page_id: page.facebook_page_id,
                page_name: page.name,
                status: 'skipped',
                reason: `Token valid for ${daysUntilExpiry} more days`
              });
              continue;
            }
          }
        } else {
          console.log('[Token Refresh Cron] ⚠️  Current token invalid:', testData.error.message);
        }

        // Step 2: Try to exchange for long-lived token
        console.log('[Token Refresh Cron] 🔄 Attempting token refresh...');
        
        const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${page.access_token}`;

        const exchangeResponse = await fetch(exchangeUrl);
        const exchangeData = await exchangeResponse.json();

        if (exchangeData.error) {
          console.error('[Token Refresh Cron] ❌ Refresh failed:', exchangeData.error.message);
          failureCount++;
          results.push({
            page_id: page.facebook_page_id,
            page_name: page.name,
            status: 'failed',
            error: exchangeData.error.message
          });
          continue;
        }

        const newToken = exchangeData.access_token;
        const expiresIn = exchangeData.expires_in;
        const daysValid = Math.floor(expiresIn / (60 * 60 * 24));

        console.log(`[Token Refresh Cron] ✅ Got new token (valid for ${daysValid} days)`);

        // Step 3: Update token in database
        const { error: updateError } = await supabase
          .from('facebook_pages')
          .update({
            access_token: newToken,
            updated_at: new Date().toISOString()
          })
          .eq('id', page.id);

        if (updateError) {
          console.error('[Token Refresh Cron] ❌ Failed to update database:', updateError);
          failureCount++;
          results.push({
            page_id: page.facebook_page_id,
            page_name: page.name,
            status: 'failed',
            error: 'Database update failed'
          });
          continue;
        }

        console.log('[Token Refresh Cron] ✅ Token updated in database');
        successCount++;
        results.push({
          page_id: page.facebook_page_id,
          page_name: page.name,
          status: 'refreshed',
          expires_in_days: daysValid
        });

      } catch (pageError) {
        console.error('[Token Refresh Cron] Error processing page:', pageError);
        failureCount++;
        results.push({
          page_id: page.facebook_page_id,
          page_name: page.name,
          status: 'error',
          error: pageError instanceof Error ? pageError.message : 'Unknown error'
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('[Token Refresh Cron] ✅ Refresh check completed');
    console.log(`  Pages Checked: ${pages.length}`);
    console.log(`  Refreshed: ${successCount}`);
    console.log(`  Skipped: ${skippedCount}`);
    console.log(`  Failed: ${failureCount}`);
    console.log('='.repeat(80));

    return NextResponse.json({
      success: true,
      message: 'Token refresh check completed',
      pages_checked: pages.length,
      refreshed: successCount,
      skipped: skippedCount,
      failed: failureCount,
      results
    });

  } catch (error) {
    console.error('[Token Refresh Cron] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

