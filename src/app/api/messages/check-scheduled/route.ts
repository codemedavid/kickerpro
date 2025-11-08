import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Check what scheduled messages exist and why they're not sending
 * GET /api/messages/check-scheduled
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get ALL scheduled messages for this user
    const { data: allScheduled, error: allError } = await supabase
      .from('messages')
      .select('*')
      .eq('created_by', userId)
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true });

    if (allError) {
      return NextResponse.json({ error: allError.message }, { status: 500 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const analysis = (allScheduled || []).map(msg => {
      const scheduledTime = new Date(msg.scheduled_for);
      const isPast = scheduledTime <= now;
      const minutesUntil = Math.floor((scheduledTime.getTime() - now.getTime()) / 60000);

      return {
        id: msg.id,
        title: msg.title,
        scheduled_for: msg.scheduled_for,
        scheduled_for_local: scheduledTime.toLocaleString(),
        current_time: nowIso,
        current_time_local: now.toLocaleString(),
        is_past_due: isPast,
        minutes_until: minutesUntil,
        status_check: isPast ? '✅ SHOULD SEND NOW' : `⏰ Sends in ${minutesUntil} minute(s)`,
        has_recipients: !!msg.selected_recipients && msg.selected_recipients.length > 0,
        recipient_count: msg.selected_recipients?.length || 0,
        page_id: msg.page_id
      };
    });

    // Get due messages (what dispatch endpoint should find)
    const { data: dueMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('created_by', userId)
      .eq('status', 'scheduled')
      .lte('scheduled_for', nowIso);

    return NextResponse.json({
      current_time: nowIso,
      current_time_local: now.toLocaleString(),
      total_scheduled: allScheduled?.length || 0,
      due_now: dueMessages?.length || 0,
      messages: analysis,
      dispatch_would_find: dueMessages?.length || 0,
      dispatch_query: {
        status: 'scheduled',
        created_by: userId,
        scheduled_for_lte: nowIso
      }
    });

  } catch (error) {
    console.error('[Check Scheduled] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 }
    );
  }
}



