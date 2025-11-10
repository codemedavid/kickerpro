/**
 * Facebook OAuth Callback Handler
 * Handles the redirect from Facebook after user authorization
 * Automatically exchanges for long-lived token and stores in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getUserProfile,
  getUserPages,
  calculateTokenExpiry,
  debugToken,
} from '@/lib/facebook/token-manager';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('Facebook OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(
        `/dashboard?error=facebook_auth_failed&message=${encodeURIComponent(errorDescription || error)}`,
        request.url
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard?error=missing_code', request.url)
    );
  }

  try {
    const supabase = await createClient();
    
    // Get current authenticated user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.redirect(
        new URL('/login?error=unauthorized', request.url)
      );
    }

    // Step 1: Exchange code for short-lived token
    const shortLivedToken = await exchangeCodeForToken(code);
    
    // Step 2: Exchange short-lived for long-lived token (~60 days)
    const longLivedToken = await exchangeForLongLivedToken(
      shortLivedToken.access_token
    );

    // Step 3: Verify token and get user info
    const [tokenInfo, fbProfile] = await Promise.all([
      debugToken(longLivedToken.access_token),
      getUserProfile(longLivedToken.access_token),
    ]);

    if (!tokenInfo.data.is_valid) {
      throw new Error('Token validation failed');
    }

    // Step 4: Calculate token expiry
    const expiresAt = calculateTokenExpiry(longLivedToken.expires_in);

    // Step 5: Update or create user in database
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .single();

    const userData = {
      id: authUser.id,
      facebook_id: fbProfile.id,
      name: fbProfile.name,
      email: fbProfile.email || authUser.email,
      profile_picture: fbProfile.picture?.data?.url,
      facebook_access_token: longLivedToken.access_token,
      facebook_token_expires_at: expiresAt.toISOString(),
      facebook_token_updated_at: new Date().toISOString(),
    };

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          facebook_id: userData.facebook_id,
          name: userData.name,
          email: userData.email,
          profile_picture: userData.profile_picture,
          facebook_access_token: userData.facebook_access_token,
          facebook_token_expires_at: userData.facebook_token_expires_at,
          facebook_token_updated_at: userData.facebook_token_updated_at,
        })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
        throw updateError;
      }
    } else {
      // Insert new user
      const { error: insertError } = await supabase
        .from('users')
        .insert(userData);

      if (insertError) {
        console.error('Error inserting user:', insertError);
        throw insertError;
      }
    }

    // Step 6: Fetch and store user's Facebook Pages
    let pagesCount = 0;
    try {
      const pagesData = await getUserPages(longLivedToken.access_token);
      pagesCount = pagesData.data?.length || 0;
      
      if (pagesData.data && pagesData.data.length > 0) {
        // Delete old pages for this user (they'll be re-added)
        await supabase
          .from('facebook_pages')
          .delete()
          .eq('user_id', authUser.id);

        // Insert all pages
        const pagesToInsert = pagesData.data.map((page) => ({
          user_id: authUser.id,
          facebook_page_id: page.id,
          name: page.name,
          category: page.category,
          profile_picture: page.picture?.data?.url,
          follower_count: page.followers_count || 0,
          access_token: page.access_token,
          is_active: true,
        }));

        const { error: pagesError } = await supabase
          .from('facebook_pages')
          .insert(pagesToInsert);

        if (pagesError) {
          console.error('Error inserting pages:', pagesError);
          // Don't throw - pages are optional
        }
      }
    } catch (pageError) {
      console.error('Error fetching pages:', pageError);
      // Don't throw - pages are optional
    }

    // Success! Redirect to dashboard with success message
    return NextResponse.redirect(
      new URL(
        '/dashboard?success=facebook_connected&pages=' + pagesCount,
        request.url
      )
    );
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
    
    return NextResponse.redirect(
      new URL(
        `/dashboard?error=facebook_auth_failed&message=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    );
  }
}

