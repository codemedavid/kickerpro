import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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
      message_tag: message.message_tag || 'none',
      selected_recipients: message.selected_recipients?.length || 0
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

      recipients = conversations?.map((c: { sender_id: string }) => c.sender_id) || [];
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

    // Update message metadata now that we have the exact recipient count
    await supabase
      .from('messages')
      .update({
        status: 'sending',
        recipient_count: recipients.length,
        delivered_count: 0,
        error_message: null
      })
      .eq('id', messageId);

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

    return NextResponse.json({
      success: true,
      total: recipients.length,
      batches: {
        total: totalBatches,
        size: BATCH_SIZE
      }
    });
  } catch (error) {
    console.error('[Send API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    );
  }
}
