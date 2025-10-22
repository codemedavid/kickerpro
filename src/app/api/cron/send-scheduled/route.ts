import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Cron Job: Send Scheduled Messages
 * 
 * This endpoint checks for scheduled messages that are due to be sent
 * and triggers the send API for them.
 * 
 * Should be called every minute via:
 * - Vercel Cron Jobs (vercel.json)
 * - External cron service (cron-job.org)
 * - GitHub Actions
 */

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Starting scheduled message check...');

    const supabase = await createClient();

    // Find messages that are scheduled and due to be sent
    const now = new Date().toISOString();
    
    const { data: dueMessages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now);

    if (error) {
      console.error('[Cron] Error fetching due messages:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!dueMessages || dueMessages.length === 0) {
      console.log('[Cron] No messages due to send');
      return NextResponse.json({
        success: true,
        message: 'No messages due to send',
        checked_at: now,
        sent: 0
      });
    }

    console.log(`[Cron] Found ${dueMessages.length} message(s) due to send`);

    const results = [];

    // Send each due message
    for (const message of dueMessages) {
      try {
        console.log(`[Cron] Sending scheduled message: ${message.id} - "${message.title}"`);

        // Call the send API
        const sendResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/messages/${message.id}/send`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cronSecret}`
            }
          }
        );

        if (sendResponse.ok) {
          const sendResult = await sendResponse.json();
          console.log(`[Cron] Successfully sent message ${message.id}. Sent: ${sendResult.sent}, Failed: ${sendResult.failed}`);
          
          results.push({
            message_id: message.id,
            title: message.title,
            success: true,
            sent: sendResult.sent,
            failed: sendResult.failed
          });

          // Log activity
          await supabase
            .from('message_activity')
            .insert({
              message_id: message.id,
              activity_type: 'scheduled_sent',
              description: `Scheduled message "${message.title}" sent automatically. ${sendResult.sent} delivered, ${sendResult.failed} failed.`
            });
        } else {
          const errorData = await sendResponse.json();
          console.error(`[Cron] Failed to send message ${message.id}:`, errorData);
          
          // Update message status to failed
          await supabase
            .from('messages')
            .update({ 
              status: 'failed',
              error_message: errorData.error || 'Scheduled send failed'
            })
            .eq('id', message.id);

          results.push({
            message_id: message.id,
            title: message.title,
            success: false,
            error: errorData.error
          });
        }
      } catch (error) {
        console.error(`[Cron] Error processing message ${message.id}:`, error);
        
        // Update message status to failed
        await supabase
          .from('messages')
          .update({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', message.id);

        results.push({
          message_id: message.id,
          title: message.title,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[Cron] Completed. Sent: ${successCount}, Failed: ${failCount}`);

    return NextResponse.json({
      success: true,
      checked_at: now,
      messages_found: dueMessages.length,
      sent: successCount,
      failed: failCount,
      results
    });
  } catch (error) {
    console.error('[Cron] Error in cron job:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Cron job failed',
        checked_at: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Allow POST as well (for manual triggering)
export async function POST(request: NextRequest) {
  return GET(request);
}

