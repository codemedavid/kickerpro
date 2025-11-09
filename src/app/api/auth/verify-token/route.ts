import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the user ID from cookie
    const cookieStore = request.cookies;
    const userId = cookieStore.get('fb-user-id')?.value;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user's Facebook access token from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('facebook_access_token, name')
      .eq('id', userId)
      .single();

    if (userError || !user?.facebook_access_token) {
      return NextResponse.json(
        { error: 'No Facebook token found' },
        { status: 404 }
      );
    }

    // Verify token with Facebook's debug API
    const debugResponse = await fetch(
      `https://graph.facebook.com/debug_token?` +
      `input_token=${user.facebook_access_token}&` +
      `access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
    );

    if (!debugResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to verify token with Facebook' },
        { status: 500 }
      );
    }

    const debugData = await debugResponse.json();
    
    if (!debugData.data) {
      return NextResponse.json(
        { error: 'Invalid response from Facebook' },
        { status: 500 }
      );
    }

    const tokenData = debugData.data;
    
    // Get expiration time from cookie to compare
    const cookieExpiresAt = cookieStore.get('fb-token-expires')?.value;
    const cookieExpiration = cookieExpiresAt ? parseInt(cookieExpiresAt) : null;

    // Calculate the real expiration from Facebook
    const realExpiresAt = tokenData.data_access_expires_at 
      ? tokenData.data_access_expires_at * 1000 // Convert to milliseconds
      : null;

    const now = Date.now();
    const realExpiresIn = realExpiresAt ? Math.floor((realExpiresAt - now) / 1000) : null;
    const cookieExpiresIn = cookieExpiration ? Math.floor((cookieExpiration - now) / 1000) : null;

    // Check if there's a mismatch (more than 60 seconds difference)
    const hasMismatch = realExpiresIn && cookieExpiresIn && Math.abs(realExpiresIn - cookieExpiresIn) > 60;

    return NextResponse.json({
      isValid: tokenData.is_valid,
      expiresAt: realExpiresAt,
      expiresIn: realExpiresIn,
      expiresInDays: realExpiresIn ? Math.floor(realExpiresIn / 86400) : null,
      issuedAt: tokenData.issued_at ? tokenData.issued_at * 1000 : null,
      appId: tokenData.app_id,
      userId: tokenData.user_id,
      userName: user.name,
      cookieExpiration,
      cookieExpiresIn,
      hasMismatch,
      mismatchSeconds: hasMismatch ? (realExpiresIn! - cookieExpiresIn!) : 0,
      scopes: tokenData.scopes || [],
    });
  } catch (error) {
    console.error('[Token Verify] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to verify token',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

