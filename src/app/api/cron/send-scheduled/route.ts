import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Cron job endpoint for sending scheduled messages
 * GET /api/cron/send-scheduled
 * 
 * This should be called by:
 * - Vercel Cron (production) - runs every 1 minute automatically
 * - External cron service (development) - call this URL every minute
 * - Manual testing - visit in browser
 * 
 * Works even when no pages are open!
 */
export async function GET(_request: NextRequest) {
  try {
    const currentTime = new Date();
    console.log('[Cron Send Scheduled] ⏰ Starting scheduled message check at', currentTime.toISOString());
    console.log('[Cron Send Scheduled] Local time:', currentTime.toLocaleString());
    
    const supabase = await createClient();

    // Find all due scheduled messages (any user)
    const nowIso = currentTime.toISOString();
    console.log('[Cron Send Scheduled] Looking for messages scheduled_for <=', nowIso);
    
    const { data: dueMessages, error: queryError } = await supabase
      .from('messages')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(10); // Process max 10 per run

    if (queryError) {
      console.error('[Cron Send Scheduled] Query error:', queryError);
      return NextResponse.json({ 
        error: queryError.message,
        success: false 
      }, { status: 500 });
    }

    if (!dueMessages || dueMessages.length === 0) {
      console.log('[Cron Send Scheduled] No messages due for sending');
      return NextResponse.json({ 
        success: true, 
        dispatched: 0,
        message: 'No messages due'
      });
    }

    console.log(`[Cron Send Scheduled] Found ${dueMessages.length} message(s) due for sending`);

    let dispatched = 0;
    let failed = 0;
    const results = [];

    for (const msg of dueMessages) {
      try {
        console.log(`[Cron Send Scheduled] Processing message: ${msg.id} - ${msg.title}`);
        console.log(`[Cron Send Scheduled] Scheduled for: ${msg.scheduled_for}, Current time: ${nowIso}`);

        // Handle auto-fetch if enabled
        if (msg.auto_fetch_enabled) {
          console.log('[Cron Send Scheduled] Auto-fetch enabled, syncing conversations...');
          
          // Get page for sync
          const { data: page } = await supabase
            .from('facebook_pages')
            .select('facebook_page_id, access_token')
            .eq('id', msg.page_id)
            .single();

          if (page && page.access_token) {
            // Sync conversations
            try {
              const syncUrl = `https://graph.facebook.com/v18.0/${page.facebook_page_id}/conversations?fields=participants,updated_time&limit=100&access_token=${page.access_token}`;
              const syncResponse = await fetch(syncUrl);
              
              if (syncResponse.ok) {
                const syncData = await syncResponse.json();
                const conversations = syncData.data || [];
                
                console.log(`[Cron Send Scheduled] Synced ${conversations.length} conversations`);

                // Update conversations in database
                for (const conv of conversations) {
                  const participants = conv.participants?.data || [];
                  for (const participant of participants) {
                    if (participant.id === page.facebook_page_id) continue;

                    await supabase
                      .from('messenger_conversations')
                      .upsert({
                        user_id: msg.created_by,
                        page_id: page.facebook_page_id,
                        sender_id: participant.id,
                        sender_name: participant.name || 'Facebook User',
                        last_message_time: conv.updated_time || new Date().toISOString(),
                        conversation_status: 'active'
                      }, { onConflict: 'page_id,sender_id' });
                  }
                }

                // Fetch and filter recipients
                const { data: allConversations } = await supabase
                  .from('messenger_conversations')
                  .select('sender_id, conversation_tags')
                  .eq('page_id', page.facebook_page_id);

                let filteredRecipients = allConversations || [];

                // Apply tag filters
                if (msg.include_tag_ids && msg.include_tag_ids.length > 0) {
                  filteredRecipients = filteredRecipients.filter((c: any) => {
                    const tags = c.conversation_tags || [];
                    return msg.include_tag_ids.every((tagId: string) => tags.includes(tagId));
                  });
                }

                if (msg.exclude_tag_ids && msg.exclude_tag_ids.length > 0) {
                  filteredRecipients = filteredRecipients.filter((c: any) => {
                    const tags = c.conversation_tags || [];
                    return !msg.exclude_tag_ids.some((tagId: string) => tags.includes(tagId));
                  });
                }

                const selectedRecipients = filteredRecipients.map((c: any) => c.sender_id);
                
                console.log(`[Cron Send Scheduled] After filters: ${selectedRecipients.length} recipients`);

                // Update message with fresh recipients
                await supabase
                  .from('messages')
                  .update({
                    selected_recipients: selectedRecipients,
                    recipient_count: selectedRecipients.length,
                    recipient_type: 'selected'
                  })
                  .eq('id', msg.id);
              }
            } catch (syncError) {
              console.error('[Cron Send Scheduled] Auto-fetch error:', syncError);
            }
          }
        }

        // Get page with access token
        const { data: page } = await supabase
          .from('facebook_pages')
          .select('*')
          .eq('id', msg.page_id)
          .single();

        if (!page || !page.access_token) {
          console.error('[Cron Send Scheduled] Page or token not found for message:', msg.id);
          await supabase
            .from('messages')
            .update({
              status: 'failed',
              error_message: 'Page access token not found'
            })
            .eq('id', msg.id);
          
          failed++;
          results.push({
            id: msg.id,
            title: msg.title,
            status: 'failed',
            error: 'No access token'
          });
          continue;
        }

        // Get recipients
        let recipients: string[] = [];
        
        if (msg.selected_recipients && msg.selected_recipients.length > 0) {
          recipients = msg.selected_recipients;
        } else if (msg.recipient_type === 'all' || msg.recipient_type === 'active') {
          const { data: conversations } = await supabase
            .from('messenger_conversations')
            .select('sender_id')
            .eq('page_id', page.facebook_page_id)
            .limit(100);
          
          recipients = conversations?.map(c => c.sender_id) || [];
        }

        if (recipients.length === 0) {
          console.error('[Cron Send Scheduled] No recipients for message:', msg.id);
          await supabase
            .from('messages')
            .update({
              status: 'failed',
              error_message: 'No recipients found'
            })
            .eq('id', msg.id);
          
          failed++;
          results.push({
            id: msg.id,
            title: msg.title,
            status: 'failed',
            error: 'No recipients'
          });
          continue;
        }

        console.log(`[Cron Send Scheduled] Sending to ${recipients.length} recipient(s)...`);

        // Update to sending status first
        await supabase
          .from('messages')
          .update({
            status: 'sending',
            scheduled_for: null,
            recipient_count: recipients.length,
            delivered_count: 0
          })
          .eq('id', msg.id);

        // Send directly to each recipient
        const { sendFacebookMessage } = await import('@/lib/messages/send-helpers');
        
        let sent = 0;
        let sendFailed = 0;

        for (const recipientId of recipients) {
          try {
            const result = await sendFacebookMessage(
              page.facebook_page_id,
              recipientId,
              msg.content,
              page.access_token,
              msg.message_tag || null
            );

            if (result.success) {
              sent++;
              console.log(`[Cron Send Scheduled] ✅ Sent to ${recipientId.substring(0, 20)}`);
            } else {
              sendFailed++;
              console.log(`[Cron Send Scheduled] ❌ Failed to ${recipientId.substring(0, 20)}: ${result.error}`);
            }

            // Small delay between sends
            await new Promise(resolve => setTimeout(resolve, 200));

          } catch (error) {
            sendFailed++;
            console.error(`[Cron Send Scheduled] Exception for ${recipientId.substring(0, 20)}:`, error);
          }
        }

        // Update final status
        const finalStatus = sent > 0 
          ? (sendFailed > 0 ? 'partially_sent' : 'sent')
          : 'failed';

        await supabase
          .from('messages')
          .update({
            status: finalStatus,
            delivered_count: sent,
            sent_at: new Date().toISOString(),
            error_message: sendFailed > 0 ? `${sendFailed} failed, ${sent} sent` : null
          })
          .eq('id', msg.id);

        console.log(`[Cron Send Scheduled] ✅ Message ${msg.id} complete: ${sent} sent, ${sendFailed} failed`);

        dispatched++;
        results.push({
          id: msg.id,
          title: msg.title,
          status: finalStatus,
          sent,
          failed: sendFailed
        });

      } catch (error) {
        console.error('[Cron Send Scheduled] Error processing message:', msg.id, error);
        failed++;
        results.push({
          id: msg.id,
          title: msg.title || 'Unknown',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[Cron Send Scheduled] Complete: ${dispatched} dispatched, ${failed} failed`);

    return NextResponse.json({ 
      success: true, 
      dispatched,
      failed,
      results
    });

  } catch (error) {
    console.error('[Cron Send Scheduled] Fatal error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Dispatch failed',
      success: false 
    }, { status: 500 });
  }
}

