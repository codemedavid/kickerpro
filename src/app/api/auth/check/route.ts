import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';

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
    const fbTokenExpires = cookieStore.get('fb-token-expires');
    const effectiveUserId = getAuthenticatedUserId(cookieStore);
    
    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      authenticated: !!effectiveUserId,
      cookies: {
        'fb-user-id': fbUserId ? {
          value: fbUserId.value,
          present: true
        } : {
          present: false,
          message: 'Cookie not found - user not logged in'
        },
        'fb-auth-user (legacy)': fbAuthUser ? {
          value: fbAuthUser.value,
          present: true,
          note: 'Legacy cookie - will be removed once all clients are updated'
        } : {
          present: false,
          message: 'Legacy cookie not found (expected for new logins)'
        },
        'fb-access-token': fbAccessToken ? {
          present: true,
          length: fbAccessToken.value.length,
          preview: fbAccessToken.value.substring(0, 20) + '...'
        } : {
          present: false,
          message: 'Cookie not found - user not logged in'
        },
        'fb-token-expires': fbTokenExpires ? {
          value: fbTokenExpires.value,
          present: true,
          expiresAt: new Date(parseInt(fbTokenExpires.value)).toISOString()
        } : {
          present: false,
          message: 'Token expiration not set'
        }
      },
      effectiveUserId,
      totalCookies: allCookies.length,
      allCookieNames: allCookies.map(c => c.name),
      environment: process.env.NODE_ENV,
      diagnosis: effectiveUserId
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

