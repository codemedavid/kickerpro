import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get all batches for this message
    const { data: batches, error } = await supabase
      .from('message_batches')
      .select('*')
      .eq('message_id', messageId)
      .order('batch_number', { ascending: true });

    if (error) {
      console.error('[Batches API] Error fetching batches:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Calculate overall stats
    const totalRecipients = batches?.reduce((sum: number, b: { recipient_count: number }) => sum + b.recipient_count, 0) || 0;
    const totalSent = batches?.reduce((sum: number, b: { sent_count?: number }) => sum + (b.sent_count || 0), 0) || 0;
    const totalFailed = batches?.reduce((sum: number, b: { failed_count?: number }) => sum + (b.failed_count || 0), 0) || 0;
    const completedBatches = batches?.filter((b: { status: string }) => b.status === 'completed').length || 0;
    const failedBatches = batches?.filter((b: { status: string }) => b.status === 'failed').length || 0;
    const processingBatches = batches?.filter((b: { status: string }) => b.status === 'processing').length || 0;
    const pendingBatches = batches?.filter((b: { status: string }) => b.status === 'pending').length || 0;
    const cancelledBatches = batches?.filter((b: { status: string }) => b.status === 'cancelled').length || 0;
    const failureMessages = batches?.reduce((list: string[], batch: { error_message?: string | null }) => {
      if (batch.error_message) {
        list.push(batch.error_message);
      }
      return list;
    }, []) || [];

    const { data: messageRow } = await supabase
      .from('messages')
      .select('status, error_message')
      .eq('id', messageId)
      .single();

    return NextResponse.json({
      success: true,
      batches: batches || [],
      summary: {
        total_batches: batches?.length || 0,
        completed: completedBatches,
        processing: processingBatches,
        pending: pendingBatches,
        failed_batches: failedBatches,
        cancelled_batches: cancelledBatches,
        total_recipients: totalRecipients,
        sent: totalSent,
        failed_messages: totalFailed,
        success_rate: totalRecipients > 0 ? Math.round((totalSent / totalRecipients) * 100) : 0,
        failure_messages: failureMessages
      },
      messageStatus: messageRow?.status || null,
      messageError: messageRow?.error_message || null
    });
  } catch (error) {
    console.error('[Batches API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch status' },
      { status: 500 }
    );
  }
}
