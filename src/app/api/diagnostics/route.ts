import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);
    const accessToken = cookieStore.get('fb-access-token')?.value;
    const primaryAuthCookie = cookieStore.get('fb-user-id')?.value;
    const legacyAuthCookie = cookieStore.get('fb-auth-user')?.value;

    const supabase = await createClient();

    // Try a simple query
    const { error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // Check if selected_recipients column exists
    const { data: sampleMessage } = await supabase
      .from('messages')
      .select('*')
      .limit(1)
      .single();

    const diagnostics = {
      timestamp: new Date().toISOString(),
      authentication: {
        userId: userId ? '✅ Present' : '❌ Missing',
        accessToken: accessToken ? '✅ Present' : '❌ Missing',
      },
      database: {
        connection: countError ? '❌ Error' : '✅ Connected',
        messagesTable: countError ? `❌ ${countError.message}` : '✅ Accessible',
        hasSelectedRecipientsColumn: sampleMessage && 'selected_recipients' in sampleMessage ? '✅ Yes' : '⚠️ No (needs migration)',
      },
      cookies: {
        'fb-user-id': primaryAuthCookie ? 'Present' : 'Missing',
        'fb-auth-user (legacy)': legacyAuthCookie ? 'Present' : 'Missing',
        'fb-access-token': cookieStore.get('fb-access-token')?.value ? 'Present' : 'Missing',
      },
      effectiveUserId: userId,
      recommendations: [] as string[]
    };

    // Add recommendations
    if (!userId) {
      diagnostics.recommendations.push('❌ Not authenticated. Please login.');
    }
    if (!accessToken) {
      diagnostics.recommendations.push('⚠️ No access token. Please re-login to Facebook.');
    }
    if (sampleMessage && !('selected_recipients' in sampleMessage)) {
      diagnostics.recommendations.push('⚠️ Database migration needed. Run database-update.sql in Supabase SQL Editor.');
    }

    return NextResponse.json({
      status: 'ok',
      diagnostics,
      message: diagnostics.recommendations.length > 0 
        ? 'Issues found - see recommendations' 
        : 'All systems operational'
    });
  } catch (error) {
    console.error('[Diagnostics] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to run diagnostics'
      },
      { status: 500 }
    );
  }
}

