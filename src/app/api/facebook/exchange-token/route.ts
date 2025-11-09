import { NextRequest, NextResponse } from 'next/server';

/**
 * Exchange short-lived Facebook token for long-lived token (60 days)
 * POST /api/facebook/exchange-token
 * 
 * Body: { shortLivedToken: string, pageId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { shortLivedToken, pageId } = await request.json();

    if (!shortLivedToken) {
      return NextResponse.json(
        { error: 'shortLivedToken is required' },
        { status: 400 }
      );
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Facebook app credentials not configured' },
        { status: 500 }
      );
    }

    console.log('[Token Exchange] Exchanging short-lived token for long-lived token...');

    // Step 1: Exchange short-lived user token for long-lived user token
    const userTokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    userTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    userTokenUrl.searchParams.set('client_id', appId);
    userTokenUrl.searchParams.set('client_secret', appSecret);
    userTokenUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const userTokenResponse = await fetch(userTokenUrl.toString());
    const userTokenData = await userTokenResponse.json();

    if (!userTokenResponse.ok || !userTokenData.access_token) {
      console.error('[Token Exchange] Failed to get long-lived user token:', userTokenData);
      return NextResponse.json(
        { 
          error: 'Failed to exchange token',
          details: userTokenData 
        },
        { status: 400 }
      );
    }

    const longLivedUserToken = userTokenData.access_token;
    const expiresIn = userTokenData.expires_in; // Should be ~5184000 seconds (60 days)

    console.log(`[Token Exchange] ✅ Got long-lived user token (expires in ${expiresIn} seconds / ${Math.floor(expiresIn / 86400)} days)`);

    // Step 2: Get long-lived page token using the long-lived user token
    if (pageId) {
      const pageTokenUrl = `https://graph.facebook.com/v18.0/${pageId}?fields=access_token&access_token=${longLivedUserToken}`;
      
      const pageTokenResponse = await fetch(pageTokenUrl);
      const pageTokenData = await pageTokenResponse.json();

      if (pageTokenResponse.ok && pageTokenData.access_token) {
        console.log('[Token Exchange] ✅ Got long-lived page token');
        
        // Page tokens don't expire as long as the user token is valid
        return NextResponse.json({
          success: true,
          longLivedToken: pageTokenData.access_token,
          tokenType: 'page',
          expiresIn: 'never (as long as user token is valid)',
          message: 'Long-lived page token generated successfully'
        });
      }
    }

    // If no pageId provided, return user token
    return NextResponse.json({
      success: true,
      longLivedToken: longLivedUserToken,
      tokenType: 'user',
      expiresIn: expiresIn,
      expiresInDays: Math.floor(expiresIn / 86400),
      message: 'Long-lived user token generated successfully'
    });

  } catch (error) {
    console.error('[Token Exchange] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exchange token' },
      { status: 500 }
    );
  }
}

/**
 * Get token info (expiration, validity)
 * GET /api/facebook/exchange-token?token=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'token parameter is required' },
        { status: 400 }
      );
    }

    // Debug token to check expiration
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Facebook app credentials not configured' },
        { status: 500 }
      );
    }

    const debugUrl = `https://graph.facebook.com/v18.0/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`;
    
    const response = await fetch(debugUrl);
    const data = await response.json();

    if (data.data) {
      const tokenInfo = data.data;
      const expiresAt = tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000) : null;
      const isValid = tokenInfo.is_valid;
      const daysUntilExpiry = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

      return NextResponse.json({
        isValid,
        expiresAt: expiresAt?.toISOString(),
        daysUntilExpiry,
        tokenType: tokenInfo.type,
        scopes: tokenInfo.scopes,
        appId: tokenInfo.app_id
      });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('[Token Exchange] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check token' },
      { status: 500 }
    );
  }
}

