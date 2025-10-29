import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Helper function to exchange short-lived token for long-lived token (60 days)
async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
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
    
    // Extract expiry date if provided (Facebook sometimes includes this)
    const expiresIn = data.expires_in ? `${data.expires_in} seconds` : '60 days (estimated)';
    console.log('[Facebook Auth] ✅ Token exchanged successfully. Expires in:', expiresIn);
    
    return longLivedToken;
  } catch (error) {
    console.error('[Facebook Auth] Error during token exchange:', error);
    // If exchange fails, fall back to using the short-lived token
    console.warn('[Facebook Auth] ⚠️ Falling back to short-lived token');
    return shortLivedToken;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, userID, name, email, picture } = body;

    console.log('[Facebook Auth] Starting authentication for user:', userID);
    console.log('[Facebook Auth] User data:', { name, email, hasToken: !!accessToken });

    // 🔄 EXCHANGE SHORT-LIVED TOKEN FOR LONG-LIVED TOKEN (60 days)
    const longLivedToken = await exchangeForLongLivedToken(accessToken);
    console.log('[Facebook Auth] Using token type:', longLivedToken === accessToken ? 'short-lived (fallback)' : 'long-lived (60 days)');

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
      console.warn('[Facebook Auth] Supabase not configured, using development mode');
      
      // Development mode - set cookie without database
      const cookieStore = await cookies();
      const devUserId = `dev_${userID}`;
      
      cookieStore.set('fb-auth-user', devUserId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      });

      // Store Facebook access token for API calls (using long-lived token)
      cookieStore.set('fb-access-token', longLivedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 60, // 60 days to match long-lived token
        path: '/'
      });

      // Store user data in cookie for dev mode
      cookieStore.set('fb-auth-user-data', JSON.stringify({
        id: devUserId,
        facebook_id: userID,
        name,
        email: email || `fb_${userID}@facebook.local`,
        profile_picture: picture,
        role: 'admin'
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      });

      return NextResponse.json({ 
        success: true, 
        userId: devUserId,
        message: 'Authentication successful (Development Mode)',
        mode: 'development'
      });
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

    // Create a session by setting cookies
    const cookieStore = await cookies();
    
    // Store user ID
    cookieStore.set('fb-auth-user', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    });

    // Store Facebook access token for API calls (using long-lived token - 60 days)
    cookieStore.set('fb-access-token', longLivedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 60, // 60 days to match long-lived token
      path: '/'
    });

    console.log('[Facebook Auth] Session created for user:', userId);

    return NextResponse.json({ 
      success: true, 
      userId,
      message: 'Authentication successful',
      mode: 'production'
    });
  } catch (error) {
    console.error('[Facebook Auth] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    console.error('[Facebook Auth] Error details:', errorDetails);
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        success: false
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
