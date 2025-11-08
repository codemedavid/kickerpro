import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Rescue messages stuck in "sending" status
 * GET /api/messages/rescue-stuck
 * 
 * Finds messages that have been in "sending" status for more than 5 minutes
 * and triggers batch processing or updates their status appropriately
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('[Rescue Stuck] Checking for stuck messages...');

    const supabase = await createClient();

    // Find messages stuck in "sending" status for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: stuckMessages, error: queryError } = await supabase
      .from('messages')
      .select('*')
      .eq('status', 'sending')
      .lt('created_at', fiveMinutesAgo);

    if (queryError) {
      console.error('[Rescue Stuck] Query error:', queryError);
      return NextResponse.json({ error: 'Failed to query stuck messages' }, { status: 500 });
    }

    if (!stuckMessages || stuckMessages.length === 0) {
      console.log('[Rescue Stuck] No stuck messages found');
      return NextResponse.json({
        success: true,
        rescued: 0,
        message: 'No stuck messages found'
      });
    }

    console.log(`[Rescue Stuck] Found ${stuckMessages.length} stuck messages`);

    const rescuedMessages = [];

    for (const message of stuckMessages) {
      console.log(`[Rescue Stuck] Processing message: ${message.id} - ${message.title}`);

      // Check if there are any pending batches
      const { data: pendingBatches, error: batchError } = await supabase
        .from('message_batches')
        .select('*')
        .eq('message_id', message.id)
        .eq('status', 'pending')
        .order('batch_number', { ascending: true });

      if (batchError) {
        console.error(`[Rescue Stuck] Error checking batches for ${message.id}:`, batchError);
        continue;
      }

      if (pendingBatches && pendingBatches.length > 0) {
        // There are pending batches - try to process them
        console.log(`[Rescue Stuck] Message ${message.id} has ${pendingBatches.length} pending batches. Triggering processing...`);

        try {
          // Trigger batch processing for the first pending batch
          const origin = request.nextUrl.origin;
          const processResponse = await fetch(
            `${origin}/api/messages/${message.id}/batches/process`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: request.headers.get('cookie') || ''
              }
            }
          );

          if (processResponse.ok) {
            console.log(`[Rescue Stuck] Successfully triggered batch processing for ${message.id}`);
            rescuedMessages.push({
              id: message.id,
              title: message.title,
              action: 'triggered_processing',
              pending_batches: pendingBatches.length
            });
          } else {
            const errorText = await processResponse.text();
            console.error(`[Rescue Stuck] Failed to process batches for ${message.id}:`, errorText);
            
            // Mark as failed
            await supabase
              .from('messages')
              .update({
                status: 'failed',
                error_message: `Rescue failed: ${errorText.substring(0, 200)}`
              })
              .eq('id', message.id);

            rescuedMessages.push({
              id: message.id,
              title: message.title,
              action: 'marked_failed',
              error: errorText.substring(0, 100)
            });
          }
        } catch (processError) {
          console.error(`[Rescue Stuck] Exception processing ${message.id}:`, processError);
          
          await supabase
            .from('messages')
            .update({
              status: 'failed',
              error_message: `Rescue exception: ${processError instanceof Error ? processError.message : 'Unknown error'}`
            })
            .eq('id', message.id);

          rescuedMessages.push({
            id: message.id,
            title: message.title,
            action: 'marked_failed',
            error: processError instanceof Error ? processError.message : 'Unknown error'
          });
        }
      } else {
        // No pending batches - check completed batches to determine final status
        const { data: allBatches } = await supabase
          .from('message_batches')
          .select('*')
          .eq('message_id', message.id);

        if (!allBatches || allBatches.length === 0) {
          // No batches at all - something went wrong
          console.log(`[Rescue Stuck] Message ${message.id} has no batches. Marking as failed.`);
          
          await supabase
            .from('messages')
            .update({
              status: 'failed',
              error_message: 'No message batches were created'
            })
            .eq('id', message.id);

          rescuedMessages.push({
            id: message.id,
            title: message.title,
            action: 'marked_failed',
            reason: 'no_batches'
          });
        } else {
          // Calculate final status based on batches
          const totalSent = allBatches.reduce((sum, b) => sum + (b.sent_count || 0), 0);
          const totalFailed = allBatches.reduce((sum, b) => sum + (b.failed_count || 0), 0);
          const allCompleted = allBatches.every(b => b.status === 'completed');

          console.log(`[Rescue Stuck] Message ${message.id} batch summary:`, {
            total: allBatches.length,
            completed: allBatches.filter(b => b.status === 'completed').length,
            sent: totalSent,
            failed: totalFailed
          });

          if (allCompleted) {
            const finalStatus = totalSent > 0 
              ? (totalFailed > 0 ? 'partially_sent' : 'sent')
              : 'failed';

            await supabase
              .from('messages')
              .update({
                status: finalStatus,
                delivered_count: totalSent,
                sent_at: new Date().toISOString(),
                error_message: totalFailed > 0 ? `${totalFailed} failed deliveries` : null
              })
              .eq('id', message.id);

            console.log(`[Rescue Stuck] Updated message ${message.id} to ${finalStatus}`);

            rescuedMessages.push({
              id: message.id,
              title: message.title,
              action: 'updated_status',
              new_status: finalStatus,
              sent: totalSent,
              failed: totalFailed
            });
          } else {
            // Some batches still processing or pending
            console.log(`[Rescue Stuck] Message ${message.id} has batches still in progress`);
            rescuedMessages.push({
              id: message.id,
              title: message.title,
              action: 'still_processing',
              batches: allBatches.length
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      rescued: rescuedMessages.length,
      messages: rescuedMessages
    });

  } catch (error) {
    console.error('[Rescue Stuck] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rescue stuck messages' },
      { status: 500 }
    );
  }
}



