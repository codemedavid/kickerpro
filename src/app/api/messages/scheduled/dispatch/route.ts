import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Find due scheduled messages for this user
    const nowIso = new Date().toISOString();
    const { data: dueMessages, error: queryError } = await supabase
      .from('messages')
      .select('id, status, scheduled_for')
      .eq('created_by', userId)
      .eq('status', 'scheduled')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(5);

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!dueMessages || dueMessages.length === 0) {
      return NextResponse.json({ success: true, dispatched: 0 });
    }

    let dispatched = 0;

    for (const msg of dueMessages) {
      // Mark ready to send (clear schedule to avoid double-run) and move to 'sent' entry point
      const { error: updateError } = await supabase
        .from('messages')
        .update({ status: 'sent', scheduled_for: null })
        .eq('id', msg.id)
        .eq('created_by', userId);

      if (updateError) {
        // Skip this message and continue with others
        continue;
      }

      // Trigger standard send pipeline
      const origin = request.nextUrl.origin;
      const sendResponse = await fetch(
        `${origin}/api/messages/${msg.id}/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: request.headers.get('cookie') || ''
          }
        }
      );

      if (sendResponse.ok) {
        dispatched++;
      }
    }

    return NextResponse.json({ success: true, dispatched });
  } catch (error) {
    console.error('[Scheduled Dispatch] Error:', error);
    return NextResponse.json({ error: 'Failed to dispatch scheduled messages' }, { status: 500 });
  }
}


