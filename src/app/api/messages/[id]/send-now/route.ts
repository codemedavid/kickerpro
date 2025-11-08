import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { sendFacebookMessage } from '@/lib/messages/send-helpers';

/**
 * BYPASS batch system - send message directly right now
 * GET /api/messages/[id]/send-now
 * 
 * This completely bypasses the batch processing system and sends directly
 */
export async function GET(
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

    console.log('[Send Now] Bypassing batch system for message:', messageId);

    const supabase = await createClient();

    // Get message
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    console.log('[Send Now] Message:', message.title);

    // Get page
    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', message.page_id)
      .single();

    if (pageError || !page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    console.log('[Send Now] Page:', page.name);

    // Get recipients
    let recipients: string[] = [];
    
    if (message.selected_recipients && message.selected_recipients.length > 0) {
      recipients = message.selected_recipients;
      console.log('[Send Now] Using selected recipients:', recipients.length);
    } else {
      const { data: conversations } = await supabase
        .from('messenger_conversations')
        .select('sender_id')
        .eq('page_id', page.facebook_page_id)
        .limit(100);
      
      recipients = conversations?.map(c => c.sender_id) || [];
      console.log('[Send Now] Using conversation recipients:', recipients.length);
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found' }, { status: 400 });
    }

    console.log(`[Send Now] Sending to ${recipients.length} recipient(s) directly...`);

    // Update status
    await supabase
      .from('messages')
      .update({ 
        status: 'sending',
        recipient_count: recipients.length,
        delivered_count: 0
      })
      .eq('id', messageId);

    // Send directly to each recipient
    let sent = 0;
    let failed = 0;
    const results = [];

    for (const recipientId of recipients) {
      console.log(`[Send Now] Sending to ${recipientId.substring(0, 20)}...`);

      try {
        const result = await sendFacebookMessage(
          page.facebook_page_id,
          recipientId,
          message.content,
          page.access_token,
          message.message_tag || null
        );

        if (result.success) {
          sent++;
          console.log(`[Send Now] ✅ Sent to ${recipientId.substring(0, 20)}`);
          results.push({
            recipient_id: recipientId.substring(0, 20) + '...',
            status: 'sent',
            message_id: result.message_id
          });
        } else {
          failed++;
          console.log(`[Send Now] ❌ Failed to ${recipientId.substring(0, 20)}: ${result.error}`);
          results.push({
            recipient_id: recipientId.substring(0, 20) + '...',
            status: 'failed',
            error: result.error
          });
        }

        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        failed++;
        console.error(`[Send Now] Exception for ${recipientId.substring(0, 20)}:`, error);
        results.push({
          recipient_id: recipientId.substring(0, 20) + '...',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Update final status
    const finalStatus = sent > 0 
      ? (failed > 0 ? 'partially_sent' : 'sent')
      : 'failed';

    await supabase
      .from('messages')
      .update({
        status: finalStatus,
        delivered_count: sent,
        sent_at: new Date().toISOString(),
        error_message: failed > 0 ? `${failed} failed, ${sent} sent` : null
      })
      .eq('id', messageId);

    console.log(`[Send Now] Complete: ${sent} sent, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: 'Direct send complete',
      stats: {
        total: recipients.length,
        sent,
        failed,
        final_status: finalStatus
      },
      results: results.slice(0, 10) // Show first 10 results
    });

  } catch (error) {
    console.error('[Send Now] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Send failed' },
      { status: 500 }
    );
  }
}




