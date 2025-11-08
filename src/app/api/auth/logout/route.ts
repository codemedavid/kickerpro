import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Clear all auth cookies
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Delete all auth cookies
    response.cookies.delete('fb-user-id');
    response.cookies.delete('fb-auth-user');
    response.cookies.delete('fb-access-token');

    console.log('[Logout] User logged out successfully - all cookies cleared');

    return response;
  } catch (error) {
    console.error('[Logout] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}

