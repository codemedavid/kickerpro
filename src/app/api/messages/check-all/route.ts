import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Check ALL messages for this user (any status)
 * GET /api/messages/check-all
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get ALL messages for this user (last 10)
    const { data: allMessages, error } = await supabase
      .from('messages')
      .select('id, title, status, scheduled_for, created_at, recipient_count, selected_recipients')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();

    const analysis = (allMessages || []).map(msg => ({
      id: msg.id,
      title: msg.title,
      status: msg.status,
      scheduled_for: msg.scheduled_for,
      scheduled_for_local: msg.scheduled_for ? new Date(msg.scheduled_for).toLocaleString() : null,
      created_at: msg.created_at,
      created_at_local: new Date(msg.created_at).toLocaleString(),
      has_recipients: !!msg.selected_recipients && msg.selected_recipients.length > 0,
      recipient_count: msg.selected_recipients?.length || msg.recipient_count || 0,
      should_auto_send: msg.status === 'scheduled' && msg.scheduled_for && new Date(msg.scheduled_for) <= now
    }));

    return NextResponse.json({
      user_id: userId,
      current_time: now.toISOString(),
      current_time_local: now.toLocaleString(),
      total_messages: allMessages?.length || 0,
      messages: analysis,
      summary: {
        scheduled: analysis.filter(m => m.status === 'scheduled').length,
        sent: analysis.filter(m => m.status === 'sent').length,
        sending: analysis.filter(m => m.status === 'sending').length,
        failed: analysis.filter(m => m.status === 'failed').length,
        should_auto_send_now: analysis.filter(m => m.should_auto_send).length
      }
    });

  } catch (error) {
    console.error('[Check All] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 }
    );
  }
}



