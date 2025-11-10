import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient();

    // Get all cookies
    const allCookies = cookieStore.getAll();
    const fbUserIdCookie = cookieStore.get('fb-user-id')?.value;
    const fbAuthUserCookie = cookieStore.get('fb-auth-user')?.value;
    const fbAccessTokenCookie = cookieStore.get('fb-access-token')?.value;

    // Get user from database
    let dbUser = null;
    if (fbUserIdCookie) {
      const { data } = await supabase
        .from('users')
        .select('id, name, facebook_id, facebook_access_token, facebook_token_expires_at, facebook_token_updated_at')
        .eq('id', fbUserIdCookie)
        .single();
      dbUser = data;
    }

    // Test the access token
    const tokenTest = { valid: false, error: null, pages: 0 };
    const tokenToTest = fbAccessTokenCookie || dbUser?.facebook_access_token;
    
    if (tokenToTest) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${tokenToTest}`,
          { method: 'GET' }
        );
        const data = await response.json();
        
        if (data.error) {
          tokenTest.error = data.error.message;
        } else {
          tokenTest.valid = true;
          tokenTest.pages = data.data?.length || 0;
        }
      } catch (e: any) {
        tokenTest.error = e.message;
      }
    }

    // Calculate token expiration info
    let tokenExpiration = null;
    if (dbUser?.facebook_token_expires_at) {
      const expiresAt = new Date(dbUser.facebook_token_expires_at);
      const now = new Date();
      const msUntilExpiry = expiresAt.getTime() - now.getTime();
      const daysUntilExpiry = Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24));
      
      tokenExpiration = {
        expiresAt: expiresAt.toISOString(),
        daysUntilExpiry,
        isExpired: msUntilExpiry <= 0,
        isExpiringSoon: daysUntilExpiry <= 7 && daysUntilExpiry > 0
      };
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      tokenExpiration,
      cookies: {
        fbUserId: fbUserIdCookie ? 'Present' : 'Missing',
        fbAuthUser: fbAuthUserCookie ? 'Present' : 'Missing',
        fbAccessToken: fbAccessTokenCookie ? `Present (${fbAccessTokenCookie.substring(0, 20)}...)` : 'Missing',
        allCookieNames: allCookies.map(c => c.name)
      },
      database: {
        userFound: !!dbUser,
        userId: dbUser?.id || 'None',
        facebookId: dbUser?.facebook_id || 'None',
        name: dbUser?.name || 'None',
        hasTokenInDb: !!dbUser?.facebook_access_token,
        tokenUpdatedAt: dbUser?.facebook_token_updated_at || 'Never',
        dbTokenPreview: dbUser?.facebook_access_token ? 
          `${dbUser.facebook_access_token.substring(0, 20)}...` : 'None'
      },
      tokenTest: {
        valid: tokenTest.valid,
        error: tokenTest.error,
        pagesFound: tokenTest.pages,
        tokenUsed: tokenToTest ? 'Cookie or Database' : 'None available'
      },
      recommendation: !tokenToTest 
        ? 'No token found - Logout and login again'
        : !tokenTest.valid
        ? `Token invalid: ${tokenTest.error} - Logout and login again`
        : tokenTest.pages === 0
        ? 'Token valid but 0 pages - Check https://www.facebook.com/pages or request pages permissions'
        : 'Everything looks good!'
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Diagnostic failed',
      stack: error instanceof Error ? error.stack : String(error)
    }, { status: 500 });
  }
}






