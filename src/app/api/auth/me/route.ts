import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { user: null, authenticated: false },
        { status: 401 }
      );
    }

    // Check if in development mode (no Supabase)
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!hasSupabase || userId.startsWith('dev_')) {
      // Development mode - get user from cookie
      const userDataCookie = cookieStore.get('fb-auth-user-data')?.value;
      
      if (userDataCookie) {
        try {
          const user = JSON.parse(userDataCookie);
          return NextResponse.json({
            user,
            authenticated: true,
            mode: 'development'
          });
        } catch (e) {
          console.error('[Auth Me] Failed to parse dev user data:', e);
        }
      }
      
      // Return basic dev user if cookie parse fails
      return NextResponse.json({
        user: {
          id: userId,
          facebook_id: userId.replace('dev_', ''),
          name: 'Development User',
          email: 'dev@test.com',
          profile_picture: null,
          role: 'admin'
        },
        authenticated: true,
        mode: 'development'
      });
    }

    // Production mode - get user from Supabase
    const supabase = await createClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('[Auth Me] User not found or error:', error);
      // Clear invalid cookie
      cookieStore.delete('fb-auth-user');
      return NextResponse.json(
        { user: null, authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user,
      authenticated: true,
      mode: 'production'
    });
  } catch (error) {
    console.error('[Auth Me] Error:', error);
    return NextResponse.json(
      { user: null, authenticated: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
