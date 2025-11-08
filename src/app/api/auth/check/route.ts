import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Diagnostic endpoint to check authentication status
 * GET /api/auth/check
 * 
 * Returns detailed info about cookies and auth state
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    
    // Get all auth-related cookies
    const fbUserId = cookieStore.get('fb-user-id');
    const fbAuthUser = cookieStore.get('fb-auth-user');
    const fbAccessToken = cookieStore.get('fb-access-token');
    
    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      authenticated: !!(fbUserId || fbAuthUser),
      cookies: {
        'fb-user-id': fbUserId ? {
          value: fbUserId.value,
          present: true
        } : {
          present: false,
          message: 'Cookie not found - user not logged in'
        },
        'fb-auth-user': fbAuthUser ? {
          value: fbAuthUser.value,
          present: true
        } : {
          present: false,
          message: 'Cookie not found - user not logged in'
        },
        'fb-access-token': fbAccessToken ? {
          present: true,
          length: fbAccessToken.value.length,
          preview: fbAccessToken.value.substring(0, 20) + '...'
        } : {
          present: false,
          message: 'Cookie not found - user not logged in'
        }
      },
      totalCookies: allCookies.length,
      allCookieNames: allCookies.map(c => c.name),
      environment: process.env.NODE_ENV,
      diagnosis: fbUserId || fbAuthUser
        ? '✅ User is authenticated - cookies present'
        : '⚠️ User is NOT authenticated - no auth cookies found (this is normal if not logged in)'
    };
    
    return NextResponse.json(diagnostics, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('[Auth Check] Error:', error);
    return NextResponse.json({
      error: 'Failed to check auth status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

