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
      return NextResponse.json(
        { error: 'Failed to create batch records' },
        { status: 500 }
      );
    } else {
      console.log('[Send API] Created', totalBatches, 'batch records in database');
    }

    // Start processing batches asynchronously (don't wait for completion)
    console.log('[Send API] Starting asynchronous batch processing...');
    
    // Process batches in the background without blocking the response
    const processingPromise = processBatchesAsync(messageId, totalBatches, request);
    
    // Don't await, but ensure it runs
    processingPromise.catch(error => {
      console.error('[Send API] Background batch processing error:', error);
      
      // Update message status on error
      createClient().then(async (supabase) => {
        await supabase
          .from('messages')
          .update({ 
            status: 'failed',
            error_message: `Background processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
          .eq('id', messageId);
      }).catch(updateError => {
        console.error('[Send API] Failed to update message after error:', updateError);
      });
    });

    // IMMEDIATE FALLBACK: If we're in development or if the async might fail,
    // trigger the first batch immediately in a separate request
    if (process.env.NODE_ENV === 'development') {
      console.log('[Send API] DEV MODE: Triggering first batch immediately as fallback...');
      
      // Fire and forget - trigger first batch
      setTimeout(async () => {
        try {
          const origin = request.nextUrl.origin;
          await fetch(`${origin}/api/messages/${messageId}/batches/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: request.headers.get('cookie') || ''
            }
          });
          console.log('[Send API] Fallback batch trigger successful');
        } catch (fallbackError) {
          console.error('[Send API] Fallback batch trigger failed:', fallbackError);
        }
      }, 100); // 100ms delay
    }

    return NextResponse.json({
      success: true,
      total: recipients.length,
      batches: {
        total: totalBatches,
        size: BATCH_SIZE
      },
      message: 'Batches created and processing started'
    });
  } catch (error) {
    console.error('[Send API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    );
  }
}

// 🚀 ASYNCHRONOUS BATCH PROCESSING FUNCTION
async function processBatchesAsync(messageId: string, totalBatches: number, request: NextRequest) {
  console.log('[Send API] 🚀 Starting background batch processing for', totalBatches, 'batches');
  
  const supabase = await createClient();
  
  try {
    // Process batches sequentially with delays to allow polling to catch up
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      console.log(`[Send API] 🚀 Processing batch ${batchIndex + 1}/${totalBatches} in background`);
      
      try {
        const origin = request.nextUrl.origin;
        const batchResponse = await fetch(
          `${origin}/api/messages/${messageId}/batches/process`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: request.headers.get('cookie') || ''
            },
            signal: AbortSignal.timeout(120000) // 2 minute timeout per batch
          }
        );

        if (!batchResponse.ok) {
          const errorText = await batchResponse.text();
          console.error(`[Send API] 🚀 Batch ${batchIndex + 1} processing failed with status ${batchResponse.status}:`, errorText);
          
          // Update message status to show error
          await supabase
            .from('messages')
            .update({ 
              status: 'partially_sent',
              error_message: `Batch ${batchIndex + 1} failed: ${errorText.substring(0, 200)}`
            })
            .eq('id', messageId);
          
          break;
        }

        const batchResult = await batchResponse.json();
        console.log(`[Send API] 🚀 Batch ${batchIndex + 1} completed:`, {
          sent: batchResult.batch?.sent || 0,
          failed: batchResult.batch?.failed || 0,
          status: batchResult.batch?.status || 'unknown'
        });

        // If no more batches to process, break
        if (!batchResult.hasMore) {
          console.log('[Send API] 🚀 All batches processed in background');
          break;
        }

        // Add a small delay to allow frontend polling to catch up
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (batchError) {
        console.error(`[Send API] 🚀 Batch ${batchIndex + 1} processing exception:`, batchError);
        
        // Update message to show error
        await supabase
          .from('messages')
          .update({ 
            status: 'partially_sent',
            error_message: `Batch processing error: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`
          })
          .eq('id', messageId);
        
        break;
      }
    }
    
    console.log('[Send API] 🚀 Background batch processing completed');
  } catch (error) {
    console.error('[Send API] 🚀 Background batch processing fatal error:', error);
    
    // Final fallback: update message status
    try {
      await supabase
        .from('messages')
        .update({ 
          status: 'failed',
          error_message: `Background processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
        .eq('id', messageId);
    } catch (updateError) {
      console.error('[Send API] 🚀 Failed to update message status after error:', updateError);
    }
  }
}
