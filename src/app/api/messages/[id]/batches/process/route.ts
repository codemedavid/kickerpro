import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  getPersonalizedContentFromConversations,
  sendFacebookMessage,
  SendResult
} from '@/lib/messages/send-helpers';

const MESSAGE_DELAY_MS = 100;
const CANCELLATION_CHECK_INTERVAL = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Validate message ownership
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('created_by', userId)
      .single();

    if (messageError || !message) {
      console.error('[Process Batch API] Message not found:', messageError);
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Fetch Facebook page details
    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', message.page_id)
      .single();

    if (pageError || !page) {
      console.error('[Process Batch API] Page not found:', pageError);
      return NextResponse.json({ error: 'Facebook page not found' }, { status: 404 });
    }

    // Find the next batch that needs processing
    console.log('[Process Batch API] 🔍 Looking for next batch to process...');
    const { data: nextBatchOptions, error: nextBatchError } = await supabase
      .from('message_batches')
      .select('*')
      .eq('message_id', messageId)
      .in('status', ['pending', 'processing'])
      .order('batch_number', { ascending: true })
      .limit(1);

    if (nextBatchError) {
      console.error('[Process Batch API] ❌ Failed to fetch next batch:', nextBatchError);
      return NextResponse.json({ error: 'Failed to fetch pending batches' }, { status: 500 });
    }

    console.log('[Process Batch API] 📊 Batch query result:', {
      found_batches: nextBatchOptions?.length || 0,
      message_id: messageId
    });

    if (!nextBatchOptions || nextBatchOptions.length === 0) {
      console.log('[Process Batch API] ✅ No more batches to process, finalizing...');
      // Nothing left to process – finalize message status if needed
      const summary = await summarizeBatches(supabase, messageId);
      await updateMessageStatus(supabase, messageId, message.title, summary);

      return NextResponse.json({
        success: true,
        message: 'All batches already processed',
        hasMore: false,
        totals: summary
      });
    }

    let batch = nextBatchOptions[0];

    // Claim the batch (set to processing) to avoid duplicate work
    if (batch.status === 'pending') {
      const { data: claimedBatch, error: claimError } = await supabase
        .from('message_batches')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', batch.id)
        .eq('status', 'pending')
        .select()
        .single();

      if (claimError) {
        console.error('[Process Batch API] Failed to claim batch:', claimError);
        return NextResponse.json({ error: 'Failed to claim batch for processing' }, { status: 500 });
      }

      if (!claimedBatch) {
        // Another worker grabbed it. Ask caller to retry.
        return NextResponse.json({
          success: true,
          message: 'Batch already claimed by another worker',
          hasMore: true
        });
      }

      batch = claimedBatch;
    }

    if (!Array.isArray(batch.recipients) || batch.recipients.length === 0) {
      await supabase
        .from('message_batches')
        .update({
          status: 'completed',
          sent_count: 0,
          failed_count: 0,
          completed_at: new Date().toISOString()
        })
        .eq('id', batch.id);

      const summary = await summarizeBatches(supabase, messageId);
      await updateMessageStatus(supabase, messageId, message.title, summary);

      return NextResponse.json({
        success: true,
        message: 'Batch had no recipients',
        hasMore: summary.pending_batches > 0,
        batch: {
          number: batch.batch_number,
          sent: 0,
          failed: 0,
          total: 0,
          status: 'completed'
        },
        totals: summary
      });
    }

    console.log(`[Process Batch API] Processing batch ${batch.batch_number}/${batch.total_batches} (${batch.recipient_count} recipients)`);

    const results: SendResult[] = [];
    let firstErrorMessage: string | null = null;
    let batchSent = 0;
    let batchFailed = 0;
    let cancellationDetected = false;
    let currentStatus = message.status;

    for (let index = 0; index < batch.recipients.length; index++) {
      const recipientId = batch.recipients[index];

      if (index === 0 || index % CANCELLATION_CHECK_INTERVAL === 0) {
        const { data: statusCheck } = await supabase
          .from('messages')
          .select('status')
          .eq('id', messageId)
          .single();

        currentStatus = statusCheck?.status || currentStatus;

        if (currentStatus === 'cancelled') {
          console.log('[Process Batch API] Cancellation detected. Stopping batch processing.');
          cancellationDetected = true;
          break;
        }
      }

      try {
        console.log(
          '[Process Batch API] Attempting send',
          JSON.stringify({
            message_id: messageId,
            batch_number: batch.batch_number,
            recipient: recipientId.substring(0, 12) + '...'
          })
        );

        const personalizedContent = await getPersonalizedContentFromConversations(
          message.content,
          recipientId,
          messageId
        );

        const result = await sendFacebookMessage(
          page.facebook_page_id,
          recipientId,
          personalizedContent,
          page.access_token,
          message.message_tag || null
        );

        if (result.success) {
          batchSent++;
          console.log(
            '[Process Batch API] Send succeeded',
            JSON.stringify({
              message_id: messageId,
              batch_number: batch.batch_number,
              recipient: recipientId.substring(0, 12) + '...',
              facebook_message_id: result.message_id || 'n/a'
            })
          );
          results.push({
            recipient_id: recipientId,
            success: true,
            message_id: result.message_id
          });

          // 🚀 INSTANT TAGGING: Tag the user immediately after successful send
          await instantTagRecipient(
            supabase,
            messageId,
            recipientId,
            page.facebook_page_id,
            request
          );
        } else {
          batchFailed++;
          if (!firstErrorMessage && result.error) {
            firstErrorMessage = result.error;
          }
          console.warn(
            '[Process Batch API] Send failed',
            JSON.stringify({
              message_id: messageId,
              batch_number: batch.batch_number,
              recipient: recipientId.substring(0, 12) + '...',
              error: result.error || 'Unknown error'
            })
          );
          results.push({
            recipient_id: recipientId,
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        batchFailed++;
        console.error('[Process Batch API] Error sending message to', recipientId, error);
        if (!firstErrorMessage) {
          firstErrorMessage =
            error instanceof Error ? error.message : 'Unknown error sending message';
        }
        console.error(
          '[Process Batch API] Send threw error',
          JSON.stringify({
            message_id: messageId,
            batch_number: batch.batch_number,
            recipient: recipientId.substring(0, 12) + '...',
            error: error instanceof Error ? error.message : String(error)
          })
        );
        results.push({
          recipient_id: recipientId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Update progress more frequently for real-time updates
      if ((index + 1) % 5 === 0 || index === batch.recipients.length - 1) {
        console.log(`[Process Batch API] 📊 Updating progress: ${batchSent} sent, ${batchFailed} failed`);
        await supabase
          .from('message_batches')
          .update({
            sent_count: batchSent,
            failed_count: batchFailed
          })
          .eq('id', batch.id);
      }

      // Delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY_MS));
    }

    // Update batch status after processing
    const batchStatus = cancellationDetected
      ? 'cancelled'
      : batchFailed === batch.recipients.length
      ? 'failed'
      : 'completed';

    await supabase
      .from('message_batches')
      .update({
        status: batchStatus,
        sent_count: batchSent,
        failed_count: batchFailed,
        completed_at: cancellationDetected ? null : new Date().toISOString(),
        error_message:
          batchFailed > 0
            ? firstErrorMessage || `${batchFailed} recipient(s) failed in this batch`
            : null
      })
      .eq('id', batch.id);

    console.log(`[Process Batch API] Batch ${batch.batch_number} finished. Sent: ${batchSent}, Failed: ${batchFailed}, Status: ${batchStatus}`);

    // Note: Auto-tagging now happens instantly per recipient above
    // This batch-level tagging is kept as a fallback for any missed recipients
    if (!cancellationDetected && batchSent > 0) {
      console.log('[Process Batch API] 🏷️ Running fallback batch-level tagging for any missed recipients...');
      await autoTagSuccessfulRecipients(
        supabase,
        messageId,
        message.title,
        page.facebook_page_id,
        results.filter(r => r.success).map(r => r.recipient_id),
        request
      );
    }

    const summary = await summarizeBatches(supabase, messageId);
    await updateMessageStatus(supabase, messageId, message.title, summary);

    const hasMore = summary.pending_batches > 0 && !cancellationDetected;

    return NextResponse.json({
      success: true,
      batch: {
        number: batch.batch_number,
        sent: batchSent,
        failed: batchFailed,
        total: batch.recipient_count,
        status: batchStatus
      },
      cancelled: cancellationDetected || summary.final_status === 'cancelled',
      hasMore,
      totals: summary,
      failureReason: firstErrorMessage
    });
  } catch (error) {
    console.error('[Process Batch API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process batch' },
      { status: 500 }
    );
  }
}

async function summarizeBatches(supabase: Awaited<ReturnType<typeof createClient>>, messageId: string) {
  const { data: batches = [] } = await supabase
    .from('message_batches')
    .select('status, sent_count, failed_count, recipient_count, error_message')
    .eq('message_id', messageId);

  const totals = (batches || []).reduce(
    (acc: {
      total_recipients: number;
      sent: number;
      failed: number;
      pending_batches: number;
      failed_batches: number;
      completed_batches: number;
      cancelled_batches: number;
      failure_messages: string[];
    }, batch: { status: string; sent_count: number | null; failed_count: number | null; recipient_count: number | null; error_message?: string | null }) => {
      acc.total_recipients += batch.recipient_count || 0;
      acc.sent += batch.sent_count || 0;
      acc.failed += batch.failed_count || 0;
      if (batch.status === 'pending' || batch.status === 'processing') {
        acc.pending_batches += 1;
      } else if (batch.status === 'failed') {
        acc.failed_batches += 1;
      } else if (batch.status === 'completed') {
        acc.completed_batches += 1;
      } else if (batch.status === 'cancelled') {
        acc.cancelled_batches += 1;
      }
      if (batch.error_message) {
        acc.failure_messages.push(batch.error_message);
      }
      return acc;
    },
    {
      total_recipients: 0,
      sent: 0,
      failed: 0,
      pending_batches: 0,
      failed_batches: 0,
      completed_batches: 0,
      cancelled_batches: 0,
      failure_messages: []
    }
  );

  return {
    ...totals,
    success_rate:
      totals.total_recipients > 0
        ? Math.round((totals.sent / totals.total_recipients) * 100)
        : 0,
    final_status: totals.pending_batches > 0 ? 'sending' : totals.sent === 0 ? 'failed' : 'sent'
  };
}

async function updateMessageStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageId: string,
  messageTitle: string,
  summary: Awaited<ReturnType<typeof summarizeBatches>>
) {
  const { data: messageStatus } = await supabase
    .from('messages')
    .select('status')
    .eq('id', messageId)
    .single();

  const wasCancelled = messageStatus?.status === 'cancelled';
  const finalStatus = wasCancelled ? 'cancelled' : summary.final_status;

  const firstFailureMessage = summary.failure_messages?.[0] ?? null;

  const errorMessage = wasCancelled
    ? `Cancelled by user. ${summary.sent} sent, ${summary.total_recipients - summary.sent} not sent`
    : firstFailureMessage
    ? firstFailureMessage
    : summary.sent === 0 && summary.failed > 0
    ? `All ${summary.failed} messages failed to send`
    : summary.failed > 0
    ? `${summary.sent} sent, ${summary.failed} failed`
    : null;

  const updatePayload: Record<string, unknown> = {
    delivered_count: summary.sent,
    error_message: errorMessage
  };

  if (finalStatus !== messageStatus?.status) {
    updatePayload.status = finalStatus;
    if (finalStatus !== 'sending') {
      updatePayload.sent_at = new Date().toISOString();
    }
  }

  await supabase.from('messages').update(updatePayload).eq('id', messageId);

  if (finalStatus === 'sent' || finalStatus === 'failed' || finalStatus === 'cancelled') {
    await supabase.from('message_activity').insert({
      message_id: messageId,
      activity_type:
        finalStatus === 'sent'
          ? 'sent'
          : finalStatus === 'failed'
          ? 'failed'
          : finalStatus === 'cancelled'
          ? 'cancelled'
          : 'sent',
      description:
        finalStatus === 'sent'
          ? `Message "${messageTitle}" sent to ${summary.sent} recipients (${summary.failed} failed)`
          : finalStatus === 'failed'
          ? `Message "${messageTitle}" failed to send`
          : `Message "${messageTitle}" cancelled. ${summary.sent} sent before cancellation`
    });
  }
}

async function autoTagSuccessfulRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageId: string,
  messageTitle: string,
  facebookPageId: string,
  successfulRecipients: string[],
  request: NextRequest
) {
  if (successfulRecipients.length === 0) {
    return;
  }

  try {
    console.log('[Process Batch API] 🏷️ Fallback batch-level tagging for', successfulRecipients.length, 'recipients');

    const { data: autoTag } = await supabase
      .from('message_auto_tags')
      .select('tag_id')
      .eq('message_id', messageId)
      .single();

    if (!autoTag) {
      console.log('[Process Batch API] 🏷️ No auto-tag configured for fallback tagging');
      return;
    }

    const { data: conversations } = await supabase
      .from('messenger_conversations')
      .select('id')
      .eq('page_id', facebookPageId)
      .in('sender_id', successfulRecipients);

    if (!conversations || conversations.length === 0) {
      console.log('[Process Batch API] 🏷️ No conversations found for fallback tagging');
      return;
    }

    const conversationIds = conversations.map((conversation: { id: string }) => conversation.id);

    // Check which conversations don't already have this tag to avoid duplicates
    const { data: existingTags } = await supabase
      .from('conversation_tags')
      .select('conversation_id')
      .eq('tag_id', autoTag.tag_id)
      .in('conversation_id', conversationIds);

    const alreadyTaggedIds = existingTags?.map((t: { conversation_id: string }) => t.conversation_id) || [];
    const untaggedConversationIds = conversationIds.filter((id: string) => !alreadyTaggedIds.includes(id));

    if (untaggedConversationIds.length === 0) {
      console.log('[Process Batch API] 🏷️ All conversations already tagged, skipping fallback');
      return;
    }

    console.log('[Process Batch API] 🏷️ Applying fallback tags to', untaggedConversationIds.length, 'untagged conversations');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/conversations/auto-tag`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') || ''
        },
        body: JSON.stringify({
          conversationIds: untaggedConversationIds,
          tagIds: [autoTag.tag_id]
        })
      }
    );

    if (response.ok) {
      console.log(
        '[Process Batch API] 🏷️ ✅ Fallback auto-tag applied to',
        untaggedConversationIds.length,
        'conversations for message',
        messageTitle
      );
    } else {
      console.error('[Process Batch API] 🏷️ ❌ Fallback auto-tag request failed:', await response.text());
    }
  } catch (error) {
    console.error('[Process Batch API] 🏷️ ❌ Fallback auto-tag error:', error);
  }
}

// 🚀 INSTANT TAGGING FUNCTION
async function instantTagRecipient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageId: string,
  recipientId: string,
  facebookPageId: string,
  request: NextRequest
) {
  try {
    console.log('[Process Batch API] 🏷️ Starting instant tagging for recipient:', recipientId.substring(0, 12) + '...');

    // Check if this message has auto-tagging enabled
    const { data: autoTag } = await supabase
      .from('message_auto_tags')
      .select('tag_id')
      .eq('message_id', messageId)
      .single();

    if (!autoTag) {
      console.log('[Process Batch API] 🏷️ No auto-tag configured for this message');
      return;
    }

    console.log('[Process Batch API] 🏷️ Auto-tag found:', autoTag.tag_id);

    // Find the conversation for this recipient
    const { data: conversation } = await supabase
      .from('messenger_conversations')
      .select('id')
      .eq('page_id', facebookPageId)
      .eq('sender_id', recipientId)
      .single();

    if (!conversation) {
      console.log('[Process Batch API] 🏷️ No conversation found for recipient:', recipientId.substring(0, 12) + '...');
      return;
    }

    console.log('[Process Batch API] 🏷️ Conversation found:', conversation.id);

    // Check if this conversation already has this tag to avoid duplicates
    const { data: existingTag } = await supabase
      .from('conversation_tags')
      .select('id')
      .eq('conversation_id', conversation.id)
      .eq('tag_id', autoTag.tag_id)
      .single();

    if (existingTag) {
      console.log('[Process Batch API] 🏷️ Conversation already has this tag, skipping instant tagging');
      return;
    }

    // Apply the tag instantly
    console.log('[Process Batch API] 🏷️ Making auto-tag API call:', {
      conversationId: conversation.id,
      tagId: autoTag.tag_id,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/conversations/auto-tag`
    });

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/conversations/auto-tag`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') || ''
        },
        body: JSON.stringify({
          conversationIds: [conversation.id],
          tagIds: [autoTag.tag_id]
        })
      }
    );

    console.log('[Process Batch API] 🏷️ Auto-tag API response:', {
      status: response.status,
      ok: response.ok
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log('[Process Batch API] 🏷️ ✅ Instant tag applied successfully:', responseData);
    } else {
      const errorText = await response.text();
      console.error('[Process Batch API] 🏷️ ❌ Instant tag failed:', errorText);
    }
  } catch (error) {
    console.error('[Process Batch API] 🏷️ ❌ Instant tagging error for recipient:', recipientId.substring(0, 12) + '...', error);
  }
}
