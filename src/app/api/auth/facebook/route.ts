import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper function to exchange short-lived token for long-lived token (60 days)
async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ token: string; expiresIn: number }> {
  try {
    console.log('[Facebook Auth] Exchanging short-lived token for long-lived token...');
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${process.env.FACEBOOK_APP_ID}&` +
      `client_secret=${process.env.FACEBOOK_APP_SECRET}&` +
      `fb_exchange_token=${shortLivedToken}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Facebook Auth] Token exchange failed:', errorData);
      throw new Error(`Token exchange failed: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const longLivedToken = data.access_token;
    // Facebook returns expires_in in seconds, default to 60 days if not provided
    const expiresInSeconds = data.expires_in || (60 * 24 * 60 * 60);
    
    console.log('[Facebook Auth] ✅ Token exchanged successfully. Expires in:', expiresInSeconds, 'seconds');
    
    return { token: longLivedToken, expiresIn: expiresInSeconds };
  } catch (error) {
    console.error('[Facebook Auth] Error during token exchange:', error);
    // If exchange fails, fall back to using the short-lived token (assume 2 hours)
    console.warn('[Facebook Auth] ⚠️ Falling back to short-lived token');
    return { token: shortLivedToken, expiresIn: 2 * 60 * 60 }; // 2 hours
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, userID, name, email, picture } = body;

    console.log('[Facebook Auth] Starting authentication for user:', userID);
    console.log('[Facebook Auth] User data:', { name, email, hasToken: !!accessToken });

    // 🔄 EXCHANGE SHORT-LIVED TOKEN FOR LONG-LIVED TOKEN (60 days)
    const { token: longLivedToken, expiresIn: tokenExpiresInSeconds } = await exchangeForLongLivedToken(accessToken);
    console.log('[Facebook Auth] Using token type:', longLivedToken === accessToken ? 'short-lived (fallback)' : 'long-lived');
    console.log('[Facebook Auth] Token expires in:', tokenExpiresInSeconds, 'seconds (', Math.floor(tokenExpiresInSeconds / 86400), 'days )');

    if (!accessToken || !userID) {
      console.error('[Facebook Auth] Missing required data');
      return NextResponse.json(
        { error: 'Missing required Facebook data' },
        { status: 400 }
      );
    }

    // Check if Supabase is configured
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!hasSupabaseUrl || !hasSupabaseKey) {
      console.error('[Facebook Auth] Supabase credentials not configured');
      return NextResponse.json(
        { 
          error: 'Supabase not configured',
          details: 'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables',
          success: false
        },
        { status: 500 }
      );
    }

    const supabase = await createClient();

    // Check if user exists by Facebook ID
    console.log('[Facebook Auth] Checking if user exists in database...');
    const { data: existingUsers, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('facebook_id', userID);

    if (queryError) {
      console.error('[Facebook Auth] Database query error:', queryError);
      throw new Error(`Database error: ${queryError.message}`);
    }

    const existingUser = existingUsers?.[0];
    let userId: string;

    if (existingUser) {
      console.log('[Facebook Auth] User exists, updating info...');
      // User exists, update their info
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name,
          email,
          profile_picture: picture,
          updated_at: new Date().toISOString()
        })
        .eq('facebook_id', userID);

      if (updateError) {
        console.error('[Facebook Auth] Update error:', updateError);
        throw new Error(`Update failed: ${updateError.message}`);
      }
      userId = existingUser.id;
      console.log('[Facebook Auth] User updated successfully');
    } else {
      console.log('[Facebook Auth] Creating new user in database...');
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          facebook_id: userID,
          name,
          email: email || `fb_${userID}@facebook.local`,
          profile_picture: picture,
          role: 'member'
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Facebook Auth] Insert error:', insertError);
        throw new Error(`User creation failed: ${insertError.message}`);
      }
      
      if (!newUser) {
        throw new Error('Failed to create user - no data returned');
      }
      
      userId = newUser.id;
      console.log('[Facebook Auth] User created successfully:', userId);
    }

    // Store Facebook access token in user record
    console.log('[Facebook Auth] Storing Facebook access token...');
    const { error: tokenUpdateError } = await supabase
      .from('users')
      .update({
        facebook_access_token: longLivedToken,
        facebook_token_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (tokenUpdateError) {
      console.warn('[Facebook Auth] Failed to store Facebook token:', tokenUpdateError);
    } else {
      console.log('[Facebook Auth] ✅ Facebook token stored successfully');
    }

    console.log('[Facebook Auth] ✅ Authentication complete - user ready');

    // Set cookies for user session
    const response = NextResponse.json({ 
      success: true, 
      userId,
      message: 'Authentication successful',
      mode: 'database-auth'
    });

    // Set user ID cookie for authentication
    response.cookies.set('fb-user-id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    // Also set legacy cookie names for compatibility with existing pages API
    response.cookies.set('fb-auth-user', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
    });

    // Set Facebook access token cookie (for pages API)
    response.cookies.set('fb-access-token', longLivedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenExpiresInSeconds, // Use actual token expiration from Facebook
      path: '/'
    });

    // Set token expiration tracking cookie using Facebook's actual expiration time
    const tokenExpiresAt = Date.now() + (tokenExpiresInSeconds * 1000); // Convert seconds to milliseconds
    response.cookies.set('fb-token-expires', tokenExpiresAt.toString(), {
      httpOnly: false, // Needs to be readable by client-side widget
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenExpiresInSeconds, // Use actual token expiration from Facebook
      path: '/'
    });

    console.log('[Facebook Auth] ✅ All session cookies set (user ID + access token + expiration)');
    console.log('[Facebook Auth] Token expires at:', new Date(tokenExpiresAt).toLocaleString());

    return response;
  } catch (error) {
    console.error('[Facebook Auth] ❌ CRITICAL ERROR:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    console.error('[Facebook Auth] Error message:', errorMessage);
    console.error('[Facebook Auth] Error stack:', errorDetails);
    console.error('[Facebook Auth] Error type:', typeof error);
    console.error('[Facebook Auth] Error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        success: false,
        errorType: typeof error,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return NextResponse.json({ 
    status: 'ok',
    endpoint: 'Facebook Authentication',
    timestamp: new Date().toISOString(),
    supabaseConfigured: hasSupabase,
    mode: hasSupabase ? 'production' : 'development'
  });
}
