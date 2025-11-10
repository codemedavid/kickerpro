import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('[Cancel API] Cancelling message:', messageId);

    const supabase = await createClient();

    // Check if message exists and belongs to user
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('created_by', userId)
      .single();

    if (messageError || !message) {
      console.error('[Cancel API] Message not found:', messageError);
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Only allow cancellation of sending messages
    if (message.status !== 'sending') {
      return NextResponse.json(
        { error: 'Message is not currently being sent' },
        { status: 400 }
      );
    }

    // Update message status to cancelled
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        status: 'cancelled',
        error_message: `Cancelled at ${new Date().toISOString()}`
      })
      .eq('id', messageId)
      .eq('created_by', userId);

    if (updateError) {
      console.error('[Cancel API] Failed to update message status:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel message' },
        { status: 500 }
      );
    }

    // Mark any remaining batches as cancelled
    const { error: batchUpdateError } = await supabase
      .from('message_batches')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Cancelled before processing'
      })
      .eq('message_id', messageId)
      .in('status', ['pending', 'processing']);

    if (batchUpdateError) {
      console.error('[Cancel API] Failed to update batch statuses:', batchUpdateError);
    }

    // Log the cancellation
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action: 'message_cancelled',
        details: {
          message_id: messageId,
          message_title: message.title,
          recipient_count: message.recipient_count
        }
      });

    console.log('[Cancel API] Message cancelled successfully:', messageId);

    return NextResponse.json({
      success: true,
      message: 'Message cancelled successfully'
    });

  } catch (error) {
    console.error('[Cancel API] Caught error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to cancel message',
        success: false
      },
      { status: 500 }
    );
  }
}
