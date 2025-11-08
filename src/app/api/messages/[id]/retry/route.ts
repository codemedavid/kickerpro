import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Retry sending a stuck message by processing all pending batches
 * GET or POST /api/messages/[id]/retry
 */

// Allow GET for easy browser testing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(request, { params });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('[Retry] Retrying message:', messageId);

    const supabase = await createClient();

    // Get message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    console.log('[Retry] Message status:', message.status);

    // Update status to sending if it's not already
    if (message.status !== 'sending') {
      await supabase
        .from('messages')
        .update({ status: 'sending' })
        .eq('id', messageId);
    }

    // Get all pending batches
    const { data: pendingBatches, error: batchError } = await supabase
      .from('message_batches')
      .select('*')
      .eq('message_id', messageId)
      .eq('status', 'pending')
      .order('batch_number', { ascending: true });

    if (batchError) {
      console.error('[Retry] Error getting batches:', batchError);
      return NextResponse.json({ error: 'Failed to get batches' }, { status: 500 });
    }

    if (!pendingBatches || pendingBatches.length === 0) {
      console.log('[Retry] No pending batches found');
      return NextResponse.json({
        success: true,
        message: 'No pending batches to process',
        pending_count: 0
      });
    }

    console.log(`[Retry] Found ${pendingBatches.length} pending batch(es)`);

    // Process each batch
    const origin = request.nextUrl.origin;
    const results = [];

    for (const batch of pendingBatches) {
      console.log(`[Retry] Processing batch ${batch.batch_number}...`);

      try {
        const processResponse = await fetch(
          `${origin}/api/messages/${messageId}/batches/process`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: request.headers.get('cookie') || ''
            }
          }
        );

        if (processResponse.ok) {
          const processResult = await processResponse.json();
          console.log(`[Retry] Batch ${batch.batch_number} processed:`, processResult.batch);
          
          results.push({
            batch_number: batch.batch_number,
            status: 'success',
            sent: processResult.batch?.sent || 0,
            failed: processResult.batch?.failed || 0
          });
        } else {
          const errorText = await processResponse.text();
          console.error(`[Retry] Batch ${batch.batch_number} failed:`, errorText);
          
          results.push({
            batch_number: batch.batch_number,
            status: 'failed',
            error: errorText
          });
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`[Retry] Exception processing batch ${batch.batch_number}:`, error);
        
        results.push({
          batch_number: batch.batch_number,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Check final message status
    const { data: finalMessage } = await supabase
      .from('messages')
      .select('status, delivered_count')
      .eq('id', messageId)
      .single();

    console.log('[Retry] Final message status:', finalMessage);

    return NextResponse.json({
      success: true,
      message: 'Retry completed',
      batches_processed: results.length,
      results,
      final_status: {
        status: finalMessage?.status,
        delivered_count: finalMessage?.delivered_count
      }
    });

  } catch (error) {
    console.error('[Retry] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Retry failed' },
      { status: 500 }
    );
  }
}

