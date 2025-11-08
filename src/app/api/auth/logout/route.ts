import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Clear the user cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Delete the auth cookie
    response.cookies.delete('fb-user-id');

    console.log('[Logout] User logged out successfully');

    return response;
  } catch (error) {
    console.error('[Logout] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}

