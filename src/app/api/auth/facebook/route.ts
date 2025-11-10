import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper function to get actual token expiration from Facebook's debug API
async function getTokenExpirationFromFacebook(token: string): Promise<{ expiresAt: number; expiresIn: number } | null> {
  try {
    console.log('[Facebook Auth] Verifying token expiration with Facebook debug API...');
    
    const debugResponse = await fetch(
      `https://graph.facebook.com/debug_token?` +
      `input_token=${token}&` +
      `access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
    );

    if (!debugResponse.ok) {
      console.error('[Facebook Auth] Debug token API failed');
      return null;
    }

    const debugData = await debugResponse.json();
    
    if (debugData.data?.data_access_expires_at) {
      // Facebook returns Unix timestamp in seconds - this is the ABSOLUTE expiration time
      const expiresAt = debugData.data.data_access_expires_at;
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = expiresAt - now;
      
      console.log('[Facebook Auth] ✅ Token expiration from Facebook:', {
        expiresAt: new Date(expiresAt * 1000).toLocaleString(),
        expiresAtUnix: expiresAt,
        expiresIn: expiresIn,
        expiresInDays: Math.floor(expiresIn / 86400),
        isValid: debugData.data.is_valid
      });
      
      // Return BOTH absolute expiration and remaining time
      return { expiresAt, expiresIn };
    }
    
    console.warn('[Facebook Auth] No data_access_expires_at in debug response');
    return null;
  } catch (error) {
    console.error('[Facebook Auth] Error checking token expiration:', error);
    return null;
  }
}

// Helper function to exchange short-lived token for long-lived token (60 days)
async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ token: string; expiresIn: number; expiresAt: number }> {
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
    
    // IMPORTANT: Get the REAL expiration from Facebook's debug API
    const tokenExpiration = await getTokenExpirationFromFacebook(longLivedToken);
    
    if (tokenExpiration && tokenExpiration.expiresIn > 0) {
      console.log('[Facebook Auth] ✅ Using REAL expiration from Facebook:', tokenExpiration.expiresIn, 'seconds (', Math.floor(tokenExpiration.expiresIn / 86400), 'days)');
      return { 
        token: longLivedToken, 
        expiresIn: tokenExpiration.expiresIn,
        expiresAt: tokenExpiration.expiresAt // Unix timestamp in seconds
      };
    }
    
    // Fallback to expires_in from exchange response if debug API fails
    const expiresInSeconds = data.expires_in || (60 * 24 * 60 * 60);
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + expiresInSeconds;
    console.log('[Facebook Auth] ⚠️ Using expires_in from exchange response:', expiresInSeconds, 'seconds');
    
    return { 
      token: longLivedToken, 
      expiresIn: expiresInSeconds,
      expiresAt: expiresAtSeconds
    };
  } catch (error) {
    console.error('[Facebook Auth] Error during token exchange:', error);
    
    // Even for fallback, try to get real expiration
    const tokenExpiration = await getTokenExpirationFromFacebook(shortLivedToken);
    if (tokenExpiration && tokenExpiration.expiresIn > 0) {
      console.warn('[Facebook Auth] ⚠️ Using short-lived token with REAL expiration:', tokenExpiration.expiresIn, 'seconds');
      return { 
        token: shortLivedToken, 
        expiresIn: tokenExpiration.expiresIn,
        expiresAt: tokenExpiration.expiresAt
      };
    }
    
    // Last resort fallback
    const fallbackExpiresIn = 2 * 60 * 60; // 2 hours
    const fallbackExpiresAt = Math.floor(Date.now() / 1000) + fallbackExpiresIn;
    console.warn('[Facebook Auth] ⚠️ Falling back to short-lived token with estimated expiration');
    return { 
      token: shortLivedToken, 
      expiresIn: fallbackExpiresIn,
      expiresAt: fallbackExpiresAt
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, userID, name, email, picture } = body;

    console.log('[Facebook Auth] Starting authentication for user:', userID);
    console.log('[Facebook Auth] User data:', { name, email, hasToken: !!accessToken });

    // 🔄 EXCHANGE SHORT-LIVED TOKEN FOR LONG-LIVED TOKEN (60 days)
    const { token: longLivedToken, expiresIn: tokenExpiresInSeconds, expiresAt: tokenExpiresAtSeconds } = await exchangeForLongLivedToken(accessToken);
    console.log('[Facebook Auth] Using token type:', longLivedToken === accessToken ? 'short-lived (fallback)' : 'long-lived');
    console.log('[Facebook Auth] Token expires in:', tokenExpiresInSeconds, 'seconds (', Math.floor(tokenExpiresInSeconds / 86400), 'days )');
    console.log('[Facebook Auth] Token absolute expiration:', new Date(tokenExpiresAtSeconds * 1000).toLocaleString());

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

    // Set token expiration tracking cookie using Facebook's ABSOLUTE expiration time
    // Use the exact timestamp from Facebook to avoid drift and calculation errors
    const tokenExpiresAtMilliseconds = tokenExpiresAtSeconds * 1000; // Convert Unix seconds to milliseconds
    response.cookies.set('fb-token-expires', tokenExpiresAtMilliseconds.toString(), {
      httpOnly: false, // Needs to be readable by client-side widget
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenExpiresInSeconds, // Use actual token expiration from Facebook
      path: '/'
    });

    console.log('[Facebook Auth] ✅ All session cookies set (user ID + access token + expiration)');
    console.log('[Facebook Auth] Token expires at:', new Date(tokenExpiresAtMilliseconds).toLocaleString());
    console.log('[Facebook Auth] Using ABSOLUTE expiration timestamp from Facebook (no calculation drift)');

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
