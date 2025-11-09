import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Exchange short-lived Facebook token for long-lived token (60 days)
 * POST /api/facebook/refresh-token
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { pageId, shortLivedToken } = body;

    if (!pageId || !shortLivedToken) {
      return NextResponse.json(
        { error: 'Missing pageId or shortLivedToken' },
        { status: 400 }
      );
    }

    // Get Facebook App credentials from environment
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Facebook app credentials not configured' },
        { status: 500 }
      );
    }

    console.log('[Token Refresh] Exchanging token for long-lived version...');

    // Step 1: Exchange short-lived token for long-lived user token
    const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;

    const exchangeResponse = await fetch(exchangeUrl);
    const exchangeData = await exchangeResponse.json();

    if (exchangeData.error) {
      console.error('[Token Refresh] Exchange failed:', exchangeData.error);
      return NextResponse.json(
        { error: 'Failed to exchange token', details: exchangeData.error },
        { status: 400 }
      );
    }

    const longLivedUserToken = exchangeData.access_token;
    console.log('[Token Refresh] ✅ Got long-lived user token (expires in', exchangeData.expires_in, 'seconds)');

    // Step 2: Get long-lived page token using the long-lived user token
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedUserToken}`;

    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error('[Token Refresh] Failed to get pages:', pagesData.error);
      return NextResponse.json(
        { error: 'Failed to get page token', details: pagesData.error },
        { status: 400 }
      );
    }

    // Find the specific page
    const page = pagesData.data?.find((p: any) => p.id === pageId);

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found in account' },
        { status: 404 }
      );
    }

    const longLivedPageToken = page.access_token;
    console.log('[Token Refresh] ✅ Got long-lived page token for', page.name);

    // Step 3: Update token in database
    const { error: updateError } = await supabase
      .from('facebook_pages')
      .update({
        access_token: longLivedPageToken,
        updated_at: new Date().toISOString()
      })
      .eq('facebook_page_id', pageId);

    if (updateError) {
      console.error('[Token Refresh] Failed to update database:', updateError);
      return NextResponse.json(
        { error: 'Failed to update token in database' },
        { status: 500 }
      );
    }

    console.log('[Token Refresh] ✅ Token updated successfully in database');

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully (valid for ~60 days)',
      pageName: page.name,
      expiresIn: exchangeData.expires_in
    });

  } catch (error) {
    console.error('[Token Refresh] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

