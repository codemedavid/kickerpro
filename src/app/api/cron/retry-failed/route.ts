import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

/**
 * Cron job to automatically retry failed message deliveries
 * 
 * This should be scheduled to run periodically (e.g., every 15 minutes)
 * via Vercel Cron Jobs or similar scheduling service
 * 
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/retry-failed",
 *     "schedule": "every 15 minutes"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Retry Failed Cron] Unauthorized: Invalid or missing cron secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Retry Failed Cron] ⏰ Starting auto-retry job...');

    const supabase = await createServerClient();

    // Find messages with auto-retry enabled that have failed deliveries
    const { data: messagesWithRetry, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        title,
        created_by,
        page_id,
        retry_count,
        max_retry_attempts,
        auto_retry_enabled,
        retry_type,
        status
      `)
      .eq('auto_retry_enabled', true)
      .eq('retry_type', 'cron')
      .in('status', ['sent', 'failed', 'sending'])
      .order('created_at', { ascending: false })
      .limit(50); // Process up to 50 messages per run

    if (messagesError) {
      console.error('[Retry Failed Cron] Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    if (!messagesWithRetry || messagesWithRetry.length === 0) {
      console.log('[Retry Failed Cron] No messages with auto-retry enabled found');
      return NextResponse.json({
        success: true,
        message: 'No messages to retry',
        processed: 0
      });
    }

    console.log(`[Retry Failed Cron] Found ${messagesWithRetry.length} messages with auto-retry enabled`);

    const results = [];
    let totalRetried = 0;
    let totalRecipients = 0;

    for (const message of messagesWithRetry) {
      try {
        // Check if message has exceeded max retry attempts
        if (message.retry_count >= message.max_retry_attempts) {
          console.log(`[Retry Failed Cron] Message ${message.id} has exceeded max retry attempts (${message.retry_count}/${message.max_retry_attempts})`);
          continue;
        }

        // Get retryable failed recipients for this message
        const { data: retryableRecipients, error: retryError } = await supabase
          .rpc('get_retryable_recipients', {
            p_message_id: message.id,
            p_max_attempts: message.max_retry_attempts
          });

        if (retryError) {
          console.error(`[Retry Failed Cron] Error fetching retryable recipients for message ${message.id}:`, retryError);
          results.push({
            message_id: message.id,
            title: message.title,
            status: 'error',
            error: retryError.message
          });
          continue;
        }

        if (!retryableRecipients || retryableRecipients.length === 0) {
          console.log(`[Retry Failed Cron] No retryable recipients for message ${message.id}`);
          continue;
        }

        console.log(`[Retry Failed Cron] Found ${retryableRecipients.length} retryable recipients for message "${message.title}"`);

        // Get page details for this message
        const { data: page } = await supabase
          .from('facebook_pages')
          .select('*')
          .eq('id', message.page_id)
          .single();

        if (!page) {
          console.error(`[Retry Failed Cron] Page not found for message ${message.id}`);
          continue;
        }

        const recipientIds = retryableRecipients.map((r: { recipient_id: string }) => r.recipient_id);

        // Create retry batches
        const BATCH_SIZE = 100;
        const batches: string[][] = [];
        
        for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
          batches.push(recipientIds.slice(i, i + BATCH_SIZE));
        }

        // Get the highest batch number for this message
        const { data: existingBatches } = await supabase
          .from('message_batches')
          .select('batch_number')
          .eq('message_id', message.id)
          .order('batch_number', { ascending: false })
          .limit(1);

        const startBatchNumber = existingBatches && existingBatches.length > 0 
          ? existingBatches[0].batch_number + 1 
          : 1;

        // Create batch records
        const batchRecords = batches.map((batchRecipients, index) => ({
          message_id: message.id,
          batch_number: startBatchNumber + index,
          total_batches: batches.length,
          recipients: batchRecipients,
          recipient_count: batchRecipients.length,
          status: 'pending'
        }));

        const { error: batchInsertError } = await supabase
          .from('message_batches')
          .insert(batchRecords);

        if (batchInsertError) {
          console.error(`[Retry Failed Cron] Error creating batches for message ${message.id}:`, batchInsertError);
          results.push({
            message_id: message.id,
            title: message.title,
            status: 'error',
            error: batchInsertError.message
          });
          continue;
        }

        // Update message retry count and status
        await supabase
          .from('messages')
          .update({ 
            retry_count: message.retry_count + 1,
            status: 'sending',
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);

        // Trigger batch processing by calling the process endpoint
        const origin = request.nextUrl.origin || 'http://localhost:3000';
        
        // Process first batch to kick off the chain
        fetch(`${origin}/api/messages/${message.id}/batches/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }).catch(error => {
          console.error(`[Retry Failed Cron] Error triggering batch process for ${message.id}:`, error);
        });

        totalRetried++;
        totalRecipients += recipientIds.length;

        results.push({
          message_id: message.id,
          title: message.title,
          status: 'retrying',
          recipients_count: recipientIds.length,
          batches_created: batches.length,
          retry_attempt: message.retry_count + 1
        });

        console.log(`[Retry Failed Cron] ✅ Initiated retry for message "${message.title}" (${recipientIds.length} recipients, ${batches.length} batches)`);

        // Add delay between messages to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`[Retry Failed Cron] Error processing message ${message.id}:`, error);
        results.push({
          message_id: message.id,
          title: message.title,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[Retry Failed Cron] ✅ Completed: Retried ${totalRetried} messages with ${totalRecipients} total recipients`);

    return NextResponse.json({
      success: true,
      message: `Retry job completed: ${totalRetried} messages processed`,
      processed: totalRetried,
      total_recipients: totalRecipients,
      results
    });

  } catch (error) {
    console.error('[Retry Failed Cron] Fatal error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
}

// Disable body parsing since this is a cron job with no body
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

