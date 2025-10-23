import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

interface SendResult {
  recipient_id: string;
  success: boolean;
  message_id?: string;
  error?: string;
}

export async function POST(
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

    console.log('[Send API] Starting to send message:', messageId);

    const supabase = await createClient();

    // Get message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    console.log('[Send API] Message details:', {
      title: message.title,
      recipient_type: message.recipient_type,
      recipient_count: message.recipient_count,
      message_tag: message.message_tag || 'none'
    });

    // Get page details
    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', message.page_id)
      .single();

    if (pageError || !page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    console.log('[Send API] Using page:', page.name);

    // Update message status to sending
    await supabase
      .from('messages')
      .update({ status: 'sending' })
      .eq('id', messageId);

    let recipients: string[] = [];

    // Determine recipients based on type
    if (message.recipient_type === 'selected' && message.selected_recipients) {
      // Use selected recipients
      recipients = message.selected_recipients;
      console.log('[Send API] Sending to', recipients.length, 'selected recipients');
    } else if (message.recipient_type === 'all' || message.recipient_type === 'active') {
      // Get conversations for this page
      const { data: conversations } = await supabase
        .from('messenger_conversations')
        .select('sender_id')
        .eq('page_id', page.facebook_page_id)
        .eq('conversation_status', 'active');

      recipients = conversations?.map(c => c.sender_id) || [];
      console.log('[Send API] Sending to', recipients.length, 'conversation recipients');
    }

    if (recipients.length === 0) {
      await supabase
        .from('messages')
        .update({ 
          status: 'failed',
          error_message: 'No recipients found'
        })
        .eq('id', messageId);

      return NextResponse.json(
        { error: 'No recipients found for this message' },
        { status: 400 }
      );
    }

    // Split recipients into batches of 100
    const BATCH_SIZE = 100;
    const batches: string[][] = [];
    
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      batches.push(recipients.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = batches.length;
    console.log('[Send API] Split', recipients.length, 'recipients into', totalBatches, 'batches of', BATCH_SIZE);

    // Create batch records in database
    const batchRecords = batches.map((batchRecipients, index) => ({
      message_id: messageId,
      batch_number: index + 1,
      total_batches: totalBatches,
      recipients: batchRecipients,
      recipient_count: batchRecipients.length,
      status: 'pending'
    }));

    const { error: batchInsertError } = await supabase
      .from('message_batches')
      .insert(batchRecords);

    if (batchInsertError) {
      console.error('[Send API] Error creating batches:', batchInsertError);
    } else {
      console.log('[Send API] Created', totalBatches, 'batch records in database');
    }

    // Send messages batch by batch
    const results: SendResult[] = [];
    let sentCount = 0;
    let failedCount = 0;

    console.log('[Send API] Starting to send', totalBatches, 'batches...');

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchNumber = batchIndex + 1;
      
      console.log(`[Send API] Processing batch ${batchNumber}/${totalBatches} (${batch.length} recipients)`);

      // Update batch status to processing
      await supabase
        .from('message_batches')
        .update({ 
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('message_id', messageId)
        .eq('batch_number', batchNumber);

      let batchSent = 0;
      let batchFailed = 0;

      for (const recipientId of batch) {
        try {
          const result = await sendFacebookMessage(
            page.facebook_page_id,
            recipientId,
            message.content,
            page.access_token,
            message.message_tag || null
          );

          if (result.success) {
            sentCount++;
            batchSent++;
            results.push({
              recipient_id: recipientId,
              success: true,
              message_id: result.message_id
            });
          } else {
            failedCount++;
            batchFailed++;
            results.push({
              recipient_id: recipientId,
              success: false,
              error: result.error
            });
          }

          // Small delay to avoid rate limiting (100ms between messages)
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          failedCount++;
          batchFailed++;
          console.error('[Send API] Error sending to', recipientId, error);
          results.push({
            recipient_id: recipientId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Update batch status to completed
      await supabase
        .from('message_batches')
        .update({ 
          status: batchFailed === batch.length ? 'failed' : 'completed',
          sent_count: batchSent,
          failed_count: batchFailed,
          completed_at: new Date().toISOString()
        })
        .eq('message_id', messageId)
        .eq('batch_number', batchNumber);

      console.log(`[Send API] Batch ${batchNumber}/${totalBatches} completed. Sent: ${batchSent}, Failed: ${batchFailed}`);
    }

    console.log('[Send API] All batches completed. Total sent:', sentCount, 'Total failed:', failedCount);

    // Check final message status (might be cancelled)
    const { data: finalMessage } = await supabase
      .from('messages')
      .select('status')
      .eq('id', messageId)
      .single();

    const wasCancelled = finalMessage?.status === 'cancelled';
    const finalStatus = wasCancelled 
      ? 'cancelled' 
      : failedCount === recipients.length 
      ? 'failed' 
      : 'sent';

    // Update message with results
    await supabase
      .from('messages')
      .update({
        status: finalStatus,
        sent_at: new Date().toISOString(),
        delivered_count: sentCount,
        error_message: wasCancelled 
          ? `Cancelled by user. ${sentCount} sent, ${recipients.length - sentCount - failedCount} not sent` 
          : failedCount > 0 
          ? `${failedCount} messages failed to send` 
          : null
      })
      .eq('id', messageId);

    // Create activity log
    await supabase
      .from('message_activity')
      .insert({
        message_id: messageId,
        activity_type: wasCancelled ? 'cancelled' : 'sent',
        description: wasCancelled 
          ? `Message "${message.title}" cancelled. ${sentCount} sent before cancellation`
          : `Message "${message.title}" sent to ${sentCount} recipients (${failedCount} failed)`
      });

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: recipients.length,
      cancelled: wasCancelled,
      batches: {
        total: totalBatches,
        size: BATCH_SIZE,
        processed: totalBatches
      },
      results
    });
  } catch (error) {
    console.error('[Send API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    );
  }
}

// Helper function to send a single message via Facebook Send API
async function sendFacebookMessage(
  pageId: string,
  recipientId: string,
  messageText: string,
  accessToken: string,
  messageTag?: string | null
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v18.0/me/messages`;
    
    const postData: {
      recipient: { id: string };
      message: { text: string };
      access_token: string;
      messaging_type?: string;
      tag?: string;
    } = {
      recipient: {
        id: recipientId
      },
      message: {
        text: messageText
      },
      access_token: accessToken
    };

    // Only add message tag if specified
    if (messageTag) {
      postData.messaging_type = 'MESSAGE_TAG';
      postData.tag = messageTag;
      console.log('[Send API] Sending to recipient:', recipientId.substring(0, 10) + `... (with ${messageTag} tag)`);
    } else {
      console.log('[Send API] Sending to recipient:', recipientId.substring(0, 10) + '... (standard messaging)');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    });

    const data = await response.json();

    if (response.ok && data.message_id) {
      return {
        success: true,
        message_id: data.message_id
      };
    } else {
      console.error('[Send API] Facebook error:', data.error);
      
      // Check for token expiration (Error code 190)
      if (data.error?.code === 190) {
        return {
          success: false,
          error: '🔄 TOKEN_EXPIRED: Your Facebook session has expired. Please logout and login again to refresh your access token.'
        };
      }
      
      // Check for 24-hour policy violation (Should be bypassed by ACCOUNT_UPDATE tag)
      if (data.error?.code === 10 && data.error?.error_subcode === 2018278) {
        return {
          success: false,
          error: '⏰ 24-HOUR_POLICY: Message tag rejected. Make sure your Facebook app has permission to use ACCOUNT_UPDATE tag.'
        };
      }
      
      return {
        success: false,
        error: data.error?.message || 'Failed to send'
      };
    }
  } catch (error) {
    console.error('[Send API] Network error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

