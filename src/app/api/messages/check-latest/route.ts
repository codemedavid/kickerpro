import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Check the latest message and its actual status
 * GET /api/messages/check-latest
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get latest message
    const { data: latestMessage, error } = await supabase
      .from('messages')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latestMessage) {
      return NextResponse.json({ error: 'No messages found' }, { status: 404 });
    }

    // Get batches for this message
    const { data: batches } = await supabase
      .from('message_batches')
      .select('*')
      .eq('message_id', latestMessage.id);

    return NextResponse.json({
      message: {
        id: latestMessage.id,
        title: latestMessage.title,
        content: latestMessage.content.substring(0, 100),
        status: latestMessage.status,
        recipient_count: latestMessage.recipient_count,
        delivered_count: latestMessage.delivered_count,
        selected_recipients: latestMessage.selected_recipients,
        has_recipients: !!latestMessage.selected_recipients && latestMessage.selected_recipients.length > 0,
        scheduled_for: latestMessage.scheduled_for,
        created_at: latestMessage.created_at,
        error_message: latestMessage.error_message
      },
      batches: batches?.map(b => ({
        batch_number: b.batch_number,
        status: b.status,
        recipient_count: b.recipient_count,
        sent_count: b.sent_count || 0,
        failed_count: b.failed_count || 0,
        has_recipients: Array.isArray(b.recipients) && b.recipients.length > 0
      })),
      diagnosis: diagnoseLatestMessage(latestMessage, batches)
    });

  } catch (error) {
    console.error('[Check Latest] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 }
    );
  }
}

function diagnoseLatestMessage(message: any, batches: any[] | null): any {
  const issues = [];
  const actions = [];

  // Check status
  if (message.status === 'sending') {
    issues.push('Message stuck in SENDING status');
    actions.push(`Visit: http://localhost:3000/api/messages/${message.id}/send-now`);
  }

  if (message.status === 'scheduled') {
    const now = new Date();
    const scheduledTime = new Date(message.scheduled_for);
    const isPast = scheduledTime <= now;
    
    if (isPast) {
      issues.push('Message is PAST scheduled time but not sent');
      actions.push('Click "Check & Send Due Messages" button');
      actions.push(`Or visit: http://localhost:3000/api/messages/send-all-scheduled`);
    } else {
      issues.push('Message scheduled for future - waiting');
      actions.push('Wait for scheduled time or click "Send Now" button');
    }
  }

  // Check recipients
  if (!message.selected_recipients || message.selected_recipients.length === 0) {
    issues.push('NO RECIPIENTS SELECTED!');
    actions.push('Cannot send without recipients');
    return { issues, actions, severity: 'critical' };
  }

  // Check batches
  if (message.status === 'sending' && (!batches || batches.length === 0)) {
    issues.push('Status is SENDING but no batches exist');
    actions.push('Use send-now to bypass batches');
  }

  if (batches && batches.length > 0) {
    const allPending = batches.every(b => b.status === 'pending');
    if (allPending) {
      issues.push('Batches created but never processed');
      actions.push(`Visit: http://localhost:3000/api/messages/${message.id}/send-now`);
    }
  }

  if (issues.length === 0) {
    issues.push('Message looks OK');
    if (message.status === 'scheduled') {
      actions.push('Wait for scheduled time or use manual button');
    }
  }

  return { issues, actions, severity: issues.length > 0 ? 'medium' : 'low' };
}



