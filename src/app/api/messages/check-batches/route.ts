import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Check if batches are being created and can be read from Supabase
 * GET /api/messages/check-batches?messageId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    const supabase = await createClient();

    // Check all sending messages if no specific ID
    let messagesQuery = supabase
      .from('messages')
      .select('*')
      .eq('status', 'sending')
      .order('created_at', { ascending: false });

    if (messageId) {
      messagesQuery = messagesQuery.eq('id', messageId);
    }

    const { data: messages, error: msgError } = await messagesQuery;

    if (msgError) {
      return NextResponse.json({
        error: 'Failed to query messages',
        supabase_error: msgError.message,
        code: msgError.code
      }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        status: 'no_messages',
        message: 'No messages in sending status found'
      });
    }

    const results = [];

    for (const message of messages) {
      // Try to read batches for this message
      const { data: batches, error: batchError } = await supabase
        .from('message_batches')
        .select('*')
        .eq('message_id', message.id);

      // Try with service role to see if RLS is the issue
      const supabaseAdmin = await createClient();
      const { data: batchesAdmin, error: batchErrorAdmin } = await supabaseAdmin
        .from('message_batches')
        .select('*')
        .eq('message_id', message.id);

      results.push({
        message: {
          id: message.id,
          title: message.title,
          status: message.status,
          recipient_count: message.recipient_count,
          delivered_count: message.delivered_count,
          created_at: message.created_at
        },
        batches_found: {
          with_user_auth: batches?.length || 0,
          with_admin: batchesAdmin?.length || 0,
          error: batchError?.message || null,
          admin_error: batchErrorAdmin?.message || null
        },
        batch_details: batches?.map(b => ({
          id: b.id,
          batch_number: b.batch_number,
          status: b.status,
          recipient_count: b.recipient_count,
          sent_count: b.sent_count || 0,
          failed_count: b.failed_count || 0,
          has_recipients_array: Array.isArray(b.recipients),
          recipients_count: Array.isArray(b.recipients) ? b.recipients.length : 0,
          created_at: b.created_at,
          started_at: b.started_at,
          completed_at: b.completed_at
        })),
        diagnosis: diagnoseBatchIssue(batches, batchError, message)
      });
    }

    return NextResponse.json({
      total_messages: results.length,
      messages: results
    });

  } catch (error) {
    console.error('[Check Batches] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 }
    );
  }
}

function diagnoseBatchIssue(batches: any[] | null, error: any, message: any): any {
  if (error) {
    return {
      issue: 'SUPABASE_ERROR',
      details: 'Cannot read batches from database',
      error: error.message,
      likely_cause: 'RLS policy blocking batch reads or batches table missing',
      fix: 'Check Supabase RLS policies for message_batches table'
    };
  }

  if (!batches || batches.length === 0) {
    return {
      issue: 'NO_BATCHES_CREATED',
      details: 'Message is in sending status but no batches exist',
      likely_cause: 'Batch creation failed or was skipped',
      fix: 'Check if message.selected_recipients or recipient_type is valid'
    };
  }

  const allPending = batches.every(b => b.status === 'pending');
  if (allPending) {
    return {
      issue: 'BATCHES_PENDING',
      details: `${batches.length} batch(es) created but never processed`,
      likely_cause: 'Background processing not starting',
      fix: 'Use /retry endpoint to manually process batches'
    };
  }

  const processing = batches.filter(b => b.status === 'processing');
  if (processing.length > 0) {
    return {
      issue: 'BATCHES_STUCK_PROCESSING',
      details: `${processing.length} batch(es) stuck in processing status`,
      likely_cause: 'Processing crashed or timed out',
      fix: 'Mark as failed and retry'
    };
  }

  return {
    issue: 'UNKNOWN',
    details: 'Batch status unclear',
    batches: batches.length,
    fix: 'Check batch details manually'
  };
}





