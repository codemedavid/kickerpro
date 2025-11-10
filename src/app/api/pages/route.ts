import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
async function exchangeForLongLivedToken(shortLivedToken: string, pageId: string): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    console.error('[Token Exchange] Missing Facebook app credentials');
    return shortLivedToken; // Fallback to short-lived if no credentials
  }

  try {
    console.log(`[Token Exchange] Exchanging token for page ${pageId}...`);

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
      return shortLivedToken; // Fallback to short-lived
    }

    const longLivedUserToken = userTokenData.access_token;
    const expiresIn = userTokenData.expires_in;
    const daysValid = Math.floor(expiresIn / 86400);

    console.log(`[Token Exchange] ✅ Got long-lived user token (${daysValid} days)`);

    // Step 2: Get long-lived page token using the long-lived user token
    const pageTokenUrl = `https://graph.facebook.com/v18.0/${pageId}?fields=access_token&access_token=${longLivedUserToken}`;
    
    const pageTokenResponse = await fetch(pageTokenUrl);
    const pageTokenData = await pageTokenResponse.json();

    if (pageTokenResponse.ok && pageTokenData.access_token) {
      console.log(`[Token Exchange] ✅ Got long-lived page token for ${pageId} (never expires)`);
      return pageTokenData.access_token;
    }

    // If page token fails, return long-lived user token (better than short-lived)
    console.log('[Token Exchange] ⚠️ Failed to get page token, using user token');
    return longLivedUserToken;

  } catch (error) {
    console.error('[Token Exchange] Error:', error);
    return shortLivedToken; // Fallback to short-lived
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data: pages, error } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Pages API] Error fetching pages:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(pages || []);
  } catch (error) {
    console.error('[Pages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pages } = body;

    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: 'No pages provided' },
        { status: 400 }
      );
    }

    console.log('[Pages API] Connecting', pages.length, 'pages for user:', userId);

    const supabase = await createClient();
    const results = [];

    for (const page of pages) {
      try {
        // 🔐 CRITICAL: Exchange short-lived token for 60-day long-lived token
        console.log(`[Pages API] 🔄 Exchanging token for page: ${page.name}...`);
        const longLivedToken = await exchangeForLongLivedToken(page.access_token, page.id);
        console.log(`[Pages API] ✅ Token exchanged for: ${page.name}`);

        // Check if THIS USER already has this page (not globally)
        const { data: existing } = await supabase
          .from('facebook_pages')
          .select('*')
          .eq('facebook_page_id', page.id)
          .eq('user_id', userId) // ✅ Check per-user, allowing multi-tenancy
          .maybeSingle(); // Use maybeSingle() instead of single() to avoid error if not found

        if (existing) {
          // Update existing page for this user
          console.log('[Pages API] Page exists for this user, updating:', page.name);
          const { data: updated, error: updateError } = await supabase
            .from('facebook_pages')
            .update({
              name: page.name,
              category: page.category || null,
              profile_picture: page.picture?.data?.url || null,
              follower_count: page.fan_count || 0,
              access_token: longLivedToken, // ✅ Save 60-day token instead of short-lived
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id) // Update by internal ID, not facebook_page_id
            .select()
            .single();

          if (updateError) {
            console.error('[Pages API] Update error for page', page.id, updateError);
            results.push({ id: page.id, success: false, error: updateError.message });
          } else {
            console.log('[Pages API] ✅ Updated page with 60-day token:', page.name);
            results.push({ id: page.id, success: true, data: updated });
          }
        } else {
          // Insert new page for this user (even if another user already has it)
          console.log('[Pages API] Page does not exist for this user, inserting:', page.name);
          const { data: inserted, error: insertError } = await supabase
            .from('facebook_pages')
            .insert({
              facebook_page_id: page.id,
              user_id: userId,
              name: page.name,
              category: page.category || null,
              profile_picture: page.picture?.data?.url || null,
              follower_count: page.fan_count || 0,
              access_token: longLivedToken, // ✅ Save 60-day token instead of short-lived
              is_active: true
            })
            .select()
            .single();

          if (insertError) {
            console.error('[Pages API] Insert error for page', page.id, insertError);
            console.error('[Pages API] Error details:', insertError);
            results.push({ id: page.id, success: false, error: insertError.message });
          } else {
            console.log('[Pages API] ✅ Inserted page with 60-day token:', page.name);
            results.push({ id: page.id, success: true, data: inserted });
          }
        }
      } catch (error) {
        console.error('[Pages API] Error processing page', page.id, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ id: page.id, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log('[Pages API] Connected', successCount, 'pages successfully,', failCount, 'failed');

    return NextResponse.json({
      success: true,
      connected: successCount,
      failed: failCount,
      results
    });
  } catch (error) {
    console.error('[Pages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to connect pages' },
      { status: 500 }
    );
  }
}

