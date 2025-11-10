/**
 * Facebook OAuth Initiation & Direct Login
 * GET: Redirects user to Facebook login/authorization
 * POST: Direct login with Facebook SDK token (simplified auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateFacebookOAuthUrl } from '@/lib/facebook/config';
import { createClient } from '@/lib/supabase/server';
import { 
  exchangeForLongLivedToken, 
  debugToken, 
  calculateTokenExpiry 
} from '@/lib/facebook/token-manager';

/**
 * GET handler - OAuth redirect flow
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }
    
    // Generate a state parameter for CSRF protection
    const state = `${user.id}_${Date.now()}_${Math.random().toString(36)}`;
    
    // Store state in session/cookie for verification (optional but recommended)
    const response = NextResponse.redirect(generateFacebookOAuthUrl(state));
    response.cookies.set('fb_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
    });
    
    return response;
  } catch (error) {
    console.error('Facebook OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Facebook OAuth' },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Direct login with Facebook SDK (simplified auth)
 * Receives Facebook token from client SDK and creates user session
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Facebook Auth] POST request received');
    
    const body = await request.json();
    const { accessToken, userID, name, email, picture } = body;

    console.log('[Facebook Auth] Request data:', {
      userID,
      name,
      email: email || '(empty)',
      hasToken: !!accessToken,
      hasPicture: !!picture
    });

    // Validate required fields
    if (!accessToken || !userID || !name) {
      console.error('[Facebook Auth] Missing required fields');
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'accessToken, userID, and name are required',
          success: false 
        },
        { status: 400 }
      );
    }

    // Step 1: Exchange short-lived token for long-lived token
    console.log('[Facebook Auth] Exchanging for long-lived token...');
    let finalAccessToken = accessToken;
    let tokenExpiresAt: Date | null = null;
    let tokenExpiresIn: number | null = null;
    
    try {
      const longLivedResult = await exchangeForLongLivedToken(accessToken);
      finalAccessToken = longLivedResult.access_token;
      
      // Step 2: Get real expiration from Facebook API
      const tokenDebugInfo = await debugToken(finalAccessToken);
      
      if (tokenDebugInfo.data) {
        // Facebook returns expires_at as Unix timestamp (seconds)
        if (tokenDebugInfo.data.expires_at && tokenDebugInfo.data.expires_at !== 0) {
          tokenExpiresAt = new Date(tokenDebugInfo.data.expires_at * 1000);
          tokenExpiresIn = Math.floor((tokenExpiresAt.getTime() - Date.now()) / 1000);
          console.log('[Facebook Auth] ✅ Token expires at:', tokenExpiresAt.toISOString());
          console.log('[Facebook Auth] ✅ Token expires in:', Math.floor(tokenExpiresIn / 86400), 'days');
        } else {
          // Token never expires (page token)
          console.log('[Facebook Auth] ✅ Token has no expiration (page token)');
          tokenExpiresAt = calculateTokenExpiry(longLivedResult.expires_in);
          tokenExpiresIn = longLivedResult.expires_in || null;
        }
        
        if (!tokenDebugInfo.data.is_valid) {
          console.error('[Facebook Auth] ⚠️ Token is not valid according to Facebook');
          return NextResponse.json(
            { 
              error: 'Invalid Facebook token',
              details: 'Token was rejected by Facebook API',
              success: false 
            },
            { status: 401 }
          );
        }
      } else {
        // Fallback if debug fails
        tokenExpiresAt = calculateTokenExpiry(longLivedResult.expires_in);
        tokenExpiresIn = longLivedResult.expires_in || null;
        console.log('[Facebook Auth] ⚠️ Using fallback expiration calculation');
      }
      
      console.log('[Facebook Auth] ✅ Successfully exchanged for long-lived token');
    } catch (tokenError) {
      console.error('[Facebook Auth] Failed to exchange token:', tokenError);
      // Continue with short-lived token but warn
      console.warn('[Facebook Auth] ⚠️ Continuing with short-lived token (will expire in 1-2 hours)');
      tokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours fallback
      tokenExpiresIn = 2 * 60 * 60; // 2 hours in seconds
    }

    const supabase = await createClient();

    // Check if user exists in database
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('facebook_id', userID)
      .maybeSingle();

    let userId: string;

    if (existingUser) {
      // Update existing user
      console.log('[Facebook Auth] Updating existing user:', existingUser.id);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name,
          email: email || existingUser.email,
          profile_picture: picture || existingUser.profile_picture,
          facebook_access_token: finalAccessToken,
          facebook_token_expires_at: tokenExpiresAt?.toISOString(),
          facebook_token_updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('[Facebook Auth] Update error:', updateError);
        return NextResponse.json(
          { 
            error: 'Failed to update user',
            details: updateError.message,
            success: false 
          },
          { status: 500 }
        );
      }

      userId = existingUser.id;
    } else {
      // Create new user
      console.log('[Facebook Auth] Creating new user for Facebook ID:', userID);
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          facebook_id: userID,
          name,
          email: email || `facebook_${userID}@temp.com`,
          profile_picture: picture,
          facebook_access_token: finalAccessToken,
          facebook_token_expires_at: tokenExpiresAt?.toISOString(),
          facebook_token_updated_at: new Date().toISOString(),
          role: 'member', // Default role
        })
        .select()
        .single();

      if (insertError || !newUser) {
        console.error('[Facebook Auth] Insert error:', insertError);
        return NextResponse.json(
          { 
            error: 'Failed to create user',
            details: insertError?.message || 'Unknown error',
            success: false 
          },
          { status: 500 }
        );
      }

      userId = newUser.id;
    }

    console.log('[Facebook Auth] Session created for user:', userId);

    // Calculate cookie maxAge based on real token expiration
    // Use actual token expiration, but cap at 60 days for security
    const cookieMaxAge = tokenExpiresIn 
      ? Math.min(tokenExpiresIn, 60 * 60 * 24 * 60) // Cap at 60 days
      : 60 * 60 * 24 * 30; // Default to 30 days if unknown

    // Set authentication cookie
    const response = NextResponse.json({
      success: true,
      userId,
      mode: 'database-auth',
      message: 'Authentication successful',
      tokenExpiresAt: tokenExpiresAt?.toISOString(),
      tokenExpiresInDays: tokenExpiresIn ? Math.floor(tokenExpiresIn / 86400) : null
    });

    // Set user ID cookie (new standard)
    response.cookies.set('fb-user-id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/'
    });

    // BACKWARD COMPATIBILITY: Also set fb-auth-user for legacy endpoints
    // Many existing API routes still use 'fb-auth-user' cookie
    response.cookies.set('fb-auth-user', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/'
    });
    console.log('[Facebook Auth] Set both fb-user-id and fb-auth-user cookies for compatibility');

    // Set token expiration cookie for frontend timer widget
    // This cookie is readable by JavaScript so the UI can show accurate countdown
    if (tokenExpiresAt) {
      response.cookies.set('fb-token-expires', tokenExpiresAt.getTime().toString(), {
        httpOnly: false, // Must be readable by frontend
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: cookieMaxAge,
        path: '/'
      });
      console.log('[Facebook Auth] Token expiration cookie set:', tokenExpiresAt.getTime());
    }

    // Set access token cookie for frontend (optional, for diagnostics)
    response.cookies.set('fb-access-token', finalAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/'
    });

    console.log('[Facebook Auth] Cookies set with expiration:', new Date(Date.now() + cookieMaxAge * 1000).toISOString());
    console.log('[Facebook Auth] Token expires at:', tokenExpiresAt?.toISOString());
    console.log('[Facebook Auth] Cookie expires in:', Math.floor(cookieMaxAge / 86400), 'days');

    return response;
  } catch (error) {
    console.error('[Facebook Auth] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      },
      { status: 500 }
    );
  }
}
