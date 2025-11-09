/**
 * Utility functions for Facebook token management
 * Handles exchanging short-lived tokens for long-lived ones
 */

interface TokenExchangeResult {
  success: boolean;
  longLivedToken?: string;
  expiresIn?: number;
  expiresInDays?: number;
  error?: string;
}

/**
 * Exchange a short-lived token for a long-lived token (60 days)
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  pageId?: string
): Promise<TokenExchangeResult> {
  try {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('Facebook app credentials not configured');
    }

    console.log('[Token Refresh] Exchanging for long-lived token...');

    // Exchange for long-lived user token
    const userTokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    userTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    userTokenUrl.searchParams.set('client_id', appId);
    userTokenUrl.searchParams.set('client_secret', appSecret);
    userTokenUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const userResponse = await fetch(userTokenUrl.toString());
    const userData = await userResponse.json();

    if (!userResponse.ok || !userData.access_token) {
      console.error('[Token Refresh] Failed:', userData);
      return {
        success: false,
        error: userData.error?.message || 'Failed to exchange token'
      };
    }

    const longLivedUserToken = userData.access_token;
    const expiresIn = userData.expires_in;

    console.log(`[Token Refresh] ✅ Got long-lived token (${Math.floor(expiresIn / 86400)} days)`);

    // If pageId provided, get page token
    if (pageId) {
      const pageUrl = `https://graph.facebook.com/v18.0/${pageId}?fields=access_token&access_token=${longLivedUserToken}`;
      const pageResponse = await fetch(pageUrl);
      const pageData = await pageResponse.json();

      if (pageResponse.ok && pageData.access_token) {
        console.log('[Token Refresh] ✅ Got page token (never expires)');
        return {
          success: true,
          longLivedToken: pageData.access_token,
          expiresIn: 0, // Page tokens don't expire
          expiresInDays: 999999 // Effectively permanent
        };
      }
    }

    return {
      success: true,
      longLivedToken: longLivedUserToken,
      expiresIn,
      expiresInDays: Math.floor(expiresIn / 86400)
    };

  } catch (error) {
    console.error('[Token Refresh] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if a token is valid and when it expires
 */
export async function checkTokenExpiration(token: string): Promise<{
  isValid: boolean;
  expiresAt?: Date;
  daysUntilExpiry?: number;
  needsRefresh?: boolean;
}> {
  try {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('Facebook app credentials not configured');
    }

    const debugUrl = `https://graph.facebook.com/v18.0/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`;
    
    const response = await fetch(debugUrl);
    const data = await response.json();

    if (data.data) {
      const tokenInfo = data.data;
      const expiresAt = tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000) : null;
      const daysUntilExpiry = expiresAt 
        ? Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        isValid: tokenInfo.is_valid,
        expiresAt: expiresAt || undefined,
        daysUntilExpiry: daysUntilExpiry || undefined,
        needsRefresh: daysUntilExpiry !== null && daysUntilExpiry < 7 // Refresh if < 7 days
      };
    }

    return {
      isValid: false
    };

  } catch (error) {
    console.error('[Token Check] Error:', error);
    return {
      isValid: false
    };
  }
}

/**
 * Refresh all page tokens that are expiring soon
 * Should be called by a cron job
 */
export async function refreshExpiringTokens(supabase: any): Promise<{
  checked: number;
  refreshed: number;
  failed: number;
}> {
  const stats = {
    checked: 0,
    refreshed: 0,
    failed: 0
  };

  try {
    // Get all pages
    const { data: pages, error } = await supabase
      .from('facebook_pages')
      .select('id, facebook_page_id, access_token, name');

    if (error || !pages) {
      console.error('[Token Refresh] Failed to fetch pages:', error);
      return stats;
    }

    console.log(`[Token Refresh] Checking ${pages.length} page(s)...`);

    for (const page of pages) {
      stats.checked++;

      if (!page.access_token) {
        console.log(`[Token Refresh] ⏭️  ${page.name} - no token`);
        continue;
      }

      // Check token expiration
      const tokenStatus = await checkTokenExpiration(page.access_token);

      if (!tokenStatus.isValid) {
        console.log(`[Token Refresh] ❌ ${page.name} - token invalid`);
        stats.failed++;
        continue;
      }

      if (tokenStatus.needsRefresh) {
        console.log(`[Token Refresh] 🔄 ${page.name} - expires in ${tokenStatus.daysUntilExpiry} days, refreshing...`);

        // Try to refresh
        const result = await exchangeForLongLivedToken(page.access_token, page.facebook_page_id);

        if (result.success && result.longLivedToken) {
          // Update token in database
          const { error: updateError } = await supabase
            .from('facebook_pages')
            .update({
              access_token: result.longLivedToken,
              updated_at: new Date().toISOString()
            })
            .eq('id', page.id);

          if (updateError) {
            console.error(`[Token Refresh] ❌ Failed to update ${page.name}:`, updateError);
            stats.failed++;
          } else {
            console.log(`[Token Refresh] ✅ ${page.name} - refreshed (${result.expiresInDays} days)`);
            stats.refreshed++;
          }
        } else {
          console.error(`[Token Refresh] ❌ ${page.name} - refresh failed:`, result.error);
          stats.failed++;
        }
      } else {
        console.log(`[Token Refresh] ✓ ${page.name} - OK (${tokenStatus.daysUntilExpiry} days remaining)`);
      }
    }

    console.log(`[Token Refresh] Summary: ${stats.checked} checked, ${stats.refreshed} refreshed, ${stats.failed} failed`);

  } catch (error) {
    console.error('[Token Refresh] Error:', error);
  }

  return stats;
}

