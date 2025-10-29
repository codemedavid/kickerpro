import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

interface SendResult {
  recipient_id: string;
  success: boolean;
  message_id?: string;
  error?: string;
}

interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  is_reusable?: boolean;
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

    console.log('[Send Enhanced API] Starting to send message with media support:', messageId);

    const supabase = await createClient();

    // Get message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('created_by', userId)
      .single();

    if (messageError || !message) {
      console.error('[Send Enhanced API] Message not found:', messageError);
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    console.log('[Send Enhanced API] Message details:', {
      title: message.title,
      recipient_type: message.recipient_type,
      recipient_count: message.recipient_count,
      message_tag: message.message_tag,
      selected_recipients: message.selected_recipients?.length || 0,
      has_media: !!(message.media_attachments && message.media_attachments.length > 0)
    });

    // Get page details
    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', message.page_id)
      .single();

    if (pageError || !page) {
      console.error('[Send Enhanced API] Page not found:', pageError);
      return NextResponse.json(
        { error: 'Facebook page not found' },
        { status: 404 }
      );
    }

    console.log('[Send Enhanced API] Using page:', page.name);

    // Get recipients
    let recipients: string[] = [];
    
    if (message.recipient_type === 'selected' && message.selected_recipients) {
      recipients = message.selected_recipients;
      console.log('[Send Enhanced API] Sending to', recipients.length, 'selected recipients');
    } else {
      // Get all active recipients for the page
      const { data: contacts } = await supabase
        .from('facebook_contacts')
        .select('sender_id')
        .eq('page_id', message.page_id)
        .eq('is_active', true);
      
      recipients = contacts?.map((c: { sender_id: string }) => c.sender_id) || [];
      console.log('[Send Enhanced API] Sending to', recipients.length, 'active recipients');
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients found' },
        { status: 400 }
      );
    }

    // Process recipients in batches
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    console.log(`[Send Enhanced API] Split ${recipients.length} recipients into ${batches.length} batches of ${batchSize}`);

    // Create batch records
    const batchRecords = batches.map((batch, index) => ({
      message_id: messageId,
      batch_number: index + 1,
      total_batches: batches.length,
      recipients: batch, // Include recipients array for batch processor compatibility
      recipient_count: batch.length,
      status: 'pending'
    }));

    const { error: batchError } = await supabase
      .from('message_batches')
      .insert(batchRecords);

    if (batchError) {
      console.error('[Send Enhanced API] Failed to create batch records:', batchError);
    } else {
      console.log('[Send Enhanced API] Created', batches.length, 'batch records in database');
    }

    console.log('[Send Enhanced API] Starting to send', batches.length, 'batches...');

    let totalSent = 0;
    let totalFailed = 0;
    const allResults: SendResult[] = [];

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`[Send Enhanced API] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} recipients)`);

      let batchSent = 0;
      let batchFailed = 0;
      const batchResults: SendResult[] = [];

      // Process each recipient in the batch
      for (const recipientId of batch) {
        try {
          // Get personalized content for this recipient
          const personalizedContent = message.content; // For now, use the same content for all

          // Send text message first if there's text content
          let textResult: { success: boolean; message_id?: string; error?: string } = { success: true };
          if (personalizedContent && personalizedContent.trim()) {
            textResult = await sendFacebookTextOnly(
              page.facebook_page_id,
              recipientId,
              personalizedContent,
              page.access_token,
              message.message_tag || null
            );
            
            if (!textResult.success) {
              throw new Error(`Text message failed: ${textResult.error}`);
            }
            
            // Add a small delay before sending media
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Send media attachments as separate messages
          const mediaResults = [];
          if (message.media_attachments && Array.isArray(message.media_attachments) && message.media_attachments.length > 0) {
            console.log(`[Send Enhanced API] Sending ${message.media_attachments.length} media attachments to ${recipientId}`);
            
            for (let i = 0; i < message.media_attachments.length; i++) {
              const mediaAttachment = message.media_attachments[i];
              
              // Skip media attachments with empty URLs or errors
              if (!mediaAttachment.url || mediaAttachment.url.trim() === '' || mediaAttachment.error) {
                console.log(`[Send Enhanced API] Skipping media attachment ${i + 1} - no valid URL:`, {
                  filename: mediaAttachment.filename,
                  url: mediaAttachment.url,
                  error: mediaAttachment.error
                });
                
                mediaResults.push({
                  success: false,
                  error: `Media upload failed: ${mediaAttachment.error || 'No URL provided'}`
                });
                continue;
              }
              
              console.log(`[Send Enhanced API] Sending media attachment ${i + 1}/${message.media_attachments.length}:`, {
                filename: mediaAttachment.filename,
                type: mediaAttachment.type,
                url: mediaAttachment.url
              });
              
              const mediaResult = await sendFacebookMediaOnly(
                page.facebook_page_id,
                recipientId,
                mediaAttachment,
                page.access_token,
                message.message_tag || null
              );
              
              mediaResults.push(mediaResult);
              
              // Add delay between media messages to avoid rate limiting
              if (i < message.media_attachments.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          // Determine overall success
          const allMediaSuccessful = mediaResults.length === 0 || mediaResults.every(result => result.success);
          const result = {
            success: textResult.success && allMediaSuccessful,
            message_id: textResult.message_id || mediaResults[0]?.message_id,
            media_count: mediaResults.length,
            media_successful: mediaResults.filter(r => r.success).length
          };

          if (result.success) {
            batchSent++;
            totalSent++;
            batchResults.push({
              recipient_id: recipientId,
              success: true,
              message_id: result.message_id
            });
          } else {
            batchFailed++;
            totalFailed++;
            batchResults.push({
              recipient_id: recipientId,
              success: false,
              error: `Text: ${textResult.success ? 'OK' : 'Failed'}, Media: ${result.media_successful}/${result.media_count}`
            });
          }

        } catch (error) {
          console.error(`[Send Enhanced API] Error sending to ${recipientId}`, error);
          batchFailed++;
          totalFailed++;
          batchResults.push({
            recipient_id: recipientId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      allResults.push(...batchResults);
      console.log(`[Send Enhanced API] Batch ${batchIndex + 1}/${batches.length} completed. Sent: ${batchSent}, Failed: ${batchFailed}`);
    }

    console.log(`[Send Enhanced API] All batches completed. Total sent: ${totalSent} Total failed: ${totalFailed}`);

    // Update message status
    const finalStatus = totalFailed === 0 ? 'sent' : totalSent === 0 ? 'failed' : 'partially_sent';
    await supabase
      .from('messages')
      .update({ 
        status: finalStatus,
        sent_count: totalSent,
        failed_count: totalFailed
      })
      .eq('id', messageId);

    return NextResponse.json({
      success: true,
      message: `Message processing completed`,
      total_recipients: recipients.length,
      sent: totalSent,
      failed: totalFailed,
      results: allResults
    });

  } catch (error) {
    console.error('[Send Enhanced API] Caught error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to send message',
        success: false
      },
      { status: 500 }
    );
  }
}

// Function to send text-only messages
async function sendFacebookTextOnly(
  pageId: string,
  recipientId: string,
  textContent: string,
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
        text: textContent
      },
      access_token: accessToken
    };

    // Add message tag if specified
    if (messageTag) {
      postData.messaging_type = 'MESSAGE_TAG';
      postData.tag = messageTag;
    }

    console.log(`[Send Enhanced API] Sending text to Facebook:`, {
      recipient: recipientId,
      text: textContent.substring(0, 100) + '...'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    });

    const responseData = await response.json();

    if (response.ok) {
      console.log(`[Send Enhanced API] Text sent successfully to ${recipientId}:`, responseData);
      return {
        success: true,
        message_id: responseData.message_id
      };
    } else {
      console.error(`[Send Enhanced API] Facebook error:`, responseData);
      return {
        success: false,
        error: responseData.error?.message || 'Unknown Facebook API error'
      };
    }
  } catch (error) {
    console.error(`[Send Enhanced API] Network error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// Function to send media-only messages
async function sendFacebookMediaOnly(
  pageId: string,
  recipientId: string,
  mediaAttachment: MediaAttachment,
  accessToken: string,
  messageTag?: string | null
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v18.0/me/messages`;
    
    const postData: {
      recipient: { id: string };
      message: {
        attachment: {
          type: string;
          payload: {
            url: string;
            is_reusable: boolean;
          };
        };
      };
      access_token: string;
      messaging_type?: string;
      tag?: string;
    } = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: mediaAttachment.type,
          payload: {
            url: mediaAttachment.url,
            is_reusable: mediaAttachment.is_reusable || true
          }
        }
      },
      access_token: accessToken
    };

    // Add message tag if specified
    if (messageTag) {
      postData.messaging_type = 'MESSAGE_TAG';
      postData.tag = messageTag;
    }

    console.log(`[Send Enhanced API] Sending media to Facebook:`, {
      recipient: recipientId,
      type: mediaAttachment.type,
      url: mediaAttachment.url
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    });

    const responseData = await response.json();

    if (response.ok) {
      console.log(`[Send Enhanced API] Media sent successfully to ${recipientId}:`, responseData);
      return {
        success: true,
        message_id: responseData.message_id
      };
    } else {
      console.error(`[Send Enhanced API] Facebook error:`, responseData);
      return {
        success: false,
        error: responseData.error?.message || 'Unknown Facebook API error'
      };
    }
  } catch (error) {
    console.error(`[Send Enhanced API] Network error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}
