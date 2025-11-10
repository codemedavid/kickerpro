/**
 * Facebook OAuth Initiation
 * Redirects user to Facebook login/authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateFacebookOAuthUrl } from '@/lib/facebook/config';
import { createClient } from '@/lib/supabase/server';

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
