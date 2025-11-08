import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Simplified auth: Check for user ID in cookie (set by Facebook auth)
    const cookieStore = await cookies();
    const userIdFromCookie = cookieStore.get('fb-user-id')?.value;

    if (!userIdFromCookie) {
      return NextResponse.json(
        { user: null, authenticated: false },
        { status: 401 }
      );
    }

    // Get user from database
    const supabase = await createClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userIdFromCookie)
      .single();

    if (error || !user) {
      console.error('[Auth Me] User not found in database:', error);
      return NextResponse.json(
        { user: null, authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user,
      authenticated: true,
      mode: 'database-auth'
    });
  } catch (error) {
    console.error('[Auth Me] Error:', error);
    return NextResponse.json(
      { user: null, authenticated: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
