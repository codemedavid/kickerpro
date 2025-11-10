import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getUserIdFromCookies } from '@/lib/auth/cookies';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      recipient_ids, // Optional: specific recipients to retry. If not provided, retry all retryable failed recipients
      error_types // Optional: only retry failures with specific error types
    } = body;

    const supabase = await createClient();

    // Verify message ownership and get message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*, page_id')
      .eq('id', messageId)
      .eq('created_by', userId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

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

    // Get retryable recipients
    let recipientsToRetry: string[] = [];

    if (recipient_ids && Array.isArray(recipient_ids) && recipient_ids.length > 0) {
      // Specific recipients provided
      recipientsToRetry = recipient_ids;
    } else {
      // Get all retryable recipients
      const { data: retryableRecipients, error: retryError } = await supabase
        .rpc('get_retryable_recipients', {
          p_message_id: messageId,
          p_max_attempts: message.max_retry_attempts || 3
        });

      if (retryError) {
        console.error('[Resend API] Error fetching retryable recipients:', retryError);
        return NextResponse.json(
          { error: 'Failed to fetch retryable recipients' },
          { status: 500 }
        );
      }

      // Filter by error types if specified
      let filteredRecipients = retryableRecipients || [];
      if (error_types && Array.isArray(error_types) && error_types.length > 0) {
        filteredRecipients = filteredRecipients.filter((r: { last_error_type: string }) => 
          error_types.includes(r.last_error_type)
        );
      }

      recipientsToRetry = filteredRecipients.map((r: { recipient_id: string }) => r.recipient_id);
    }

    if (recipientsToRetry.length === 0) {
      return NextResponse.json(
        { error: 'No recipients to retry' },
        { status: 400 }
      );
    }

    console.log(`[Resend API] Retrying ${recipientsToRetry.length} failed recipients for message ${messageId}`);

    // Update message retry count
    await supabase
      .from('messages')
      .update({ 
        retry_count: (message.retry_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    // Split recipients into batches of 100
    const BATCH_SIZE = 100;
    const batches: string[][] = [];
    
    for (let i = 0; i < recipientsToRetry.length; i += BATCH_SIZE) {
      batches.push(recipientsToRetry.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = batches.length;
    console.log('[Resend API] Split', recipientsToRetry.length, 'recipients into', totalBatches, 'retry batches');

    // Get the highest batch number for this message
    const { data: existingBatches } = await supabase
      .from('message_batches')
      .select('batch_number')
      .eq('message_id', messageId)
      .order('batch_number', { ascending: false })
      .limit(1);

    const startBatchNumber = existingBatches && existingBatches.length > 0 
      ? existingBatches[0].batch_number + 1 
      : 1;

    // Create new batch records for retry
    const batchRecords = batches.map((batchRecipients, index) => ({
      message_id: messageId,
      batch_number: startBatchNumber + index,
      total_batches: totalBatches,
      recipients: batchRecipients,
      recipient_count: batchRecipients.length,
      status: 'pending'
    }));

    const { error: batchInsertError } = await supabase
      .from('message_batches')
      .insert(batchRecords);

    if (batchInsertError) {
      console.error('[Resend API] Error creating retry batches:', batchInsertError);
      return NextResponse.json(
        { error: 'Failed to create retry batch records' },
        { status: 500 }
      );
    }

    console.log('[Resend API] Created', totalBatches, 'retry batch records');

    // Update message status to sending if it was failed/sent
    if (message.status === 'failed' || message.status === 'sent') {
      await supabase
        .from('messages')
        .update({ 
          status: 'sending',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    }

    // Start processing batches asynchronously
    const processingPromise = processRetryBatchesAsync(messageId, totalBatches, request);
    
    processingPromise.catch(error => {
      console.error('[Resend API] Background retry processing error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Retry batches created and processing started',
      recipients_to_retry: recipientsToRetry.length,
      batches: {
        total: totalBatches,
        size: BATCH_SIZE,
        start_number: startBatchNumber
      }
    });
  } catch (error) {
    console.error('[Resend API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resend message' },
      { status: 500 }
    );
  }
}

async function processRetryBatchesAsync(messageId: string, totalBatches: number, request: NextRequest) {
  console.log('[Resend API] 🚀 Starting background retry batch processing for', totalBatches, 'batches');
  
  const supabase = await createClient();
  
  try {
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      console.log(`[Resend API] 🚀 Processing retry batch ${batchIndex + 1}/${totalBatches}`);
      
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
          console.error(`[Resend API] 🚀 Retry batch ${batchIndex + 1} failed:`, errorText);
          break;
        }

        const batchResult = await batchResponse.json();
        console.log(`[Resend API] 🚀 Retry batch ${batchIndex + 1} completed:`, {
          sent: batchResult.batch?.sent || 0,
          failed: batchResult.batch?.failed || 0
        });

        if (!batchResult.hasMore) {
          console.log('[Resend API] 🚀 All retry batches processed');
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (batchError) {
        console.error(`[Resend API] 🚀 Retry batch ${batchIndex + 1} exception:`, batchError);
        break;
      }
    }
    
    console.log('[Resend API] 🚀 Background retry processing completed');
  } catch (error) {
    console.error('[Resend API] 🚀 Background retry processing fatal error:', error);
  }
}

