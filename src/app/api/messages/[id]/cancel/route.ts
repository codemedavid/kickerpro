import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id: messageId } = await params;
    const supabase = await createClient();

    console.log('[Cancel API] Cancelling message:', messageId);

    // Check if message exists and is sending
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('created_by', userId)
      .single();

    if (fetchError || !message) {
      return NextResponse.json(
        { error: 'Message not found or unauthorized' },
        { status: 404 }
      );
    }

    if (message.status !== 'sending') {
      return NextResponse.json(
        { error: `Cannot cancel message with status: ${message.status}` },
        { status: 400 }
      );
    }

    // Update message status to cancelled
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        status: 'cancelled',
        error_message: 'Cancelled by user'
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('[Cancel API] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel message' },
        { status: 500 }
      );
    }

    // Mark pending batches as cancelled
    await supabase
      .from('message_batches')
      .update({ status: 'cancelled' })
      .eq('message_id', messageId)
      .in('status', ['pending', 'processing']);

    // Create activity log
    await supabase
      .from('message_activity')
      .insert({
        message_id: messageId,
        activity_type: 'cancelled',
        description: `Message "${message.title}" cancelled by user`
      });

    console.log('[Cancel API] Message cancelled successfully');

    return NextResponse.json({
      success: true,
      message: 'Message cancelled successfully'
    });
  } catch (error) {
    console.error('[Cancel API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel message' },
      { status: 500 }
    );
  }
}

