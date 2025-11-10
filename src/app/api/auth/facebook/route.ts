/**
 * Facebook OAuth Initiation & Direct Login
 * GET: Redirects user to Facebook login/authorization
 * POST: Direct login with Facebook SDK token (simplified auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateFacebookOAuthUrl } from '@/lib/facebook/config';
import { createClient } from '@/lib/supabase/server';

/**
 * GET handler - OAuth redirect flow
 */
export async function GET(request: NextRequest) {
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
          facebook_access_token: accessToken,
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
          facebook_access_token: accessToken,
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

    // Set authentication cookie
    const response = NextResponse.json({
      success: true,
      userId,
      mode: 'database-auth',
      message: 'Authentication successful'
    });

    response.cookies.set('fb-user-id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    console.log('[Facebook Auth] Cookie set, responding with success');

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
