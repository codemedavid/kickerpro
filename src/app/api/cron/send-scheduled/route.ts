import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { openRouterService } from '@/lib/ai/openrouter';
import type { ConversationContext } from '@/lib/ai/openrouter';

/**
 * Cron job endpoint for sending scheduled messages
 * GET /api/cron/send-scheduled
 * 
 * This is automatically called by Vercel Cron every 1 minute (configured in vercel.json)
 * Works 24/7 server-side - no browser needs to be open!
 * 
 * For local development testing:
 * - Set CRON_SECRET in .env.local
 * - Call: curl http://localhost:3000/api/cron/send-scheduled -H "Authorization: Bearer your-secret"
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Skip auth check if CRON_SECRET is not set (allows Vercel Cron to work)
    // In production, protect this endpoint using Vercel's firewall or by setting CRON_SECRET
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[Cron Send Scheduled] ⚠️ Unauthorized access attempt');
        console.warn('[Cron Send Scheduled] Expected:', `Bearer ${cronSecret}`);
        console.warn('[Cron Send Scheduled] Received:', authHeader || 'none');
        return NextResponse.json({ 
          error: 'Unauthorized',
          message: 'Invalid or missing authorization header' 
        }, { status: 401 });
      }
    } else {
      console.log('[Cron Send Scheduled] ℹ️ Running without CRON_SECRET (Vercel Cron mode)');
    }

    const currentTime = new Date();
    console.log('[Cron Send Scheduled] ⏰ Starting scheduled message check at', currentTime.toISOString());
    console.log('[Cron Send Scheduled] Local time:', currentTime.toLocaleString());
    
    // Create Supabase admin client using service role key (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      console.error('[Cron Send Scheduled] Missing Supabase configuration');
      return NextResponse.json({ 
        error: 'Supabase configuration missing',
        message: 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set' 
      }, { status: 500 });
    }

    const supabase = createSupabaseClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Find all due scheduled messages (any user)
    const nowIso = currentTime.toISOString();
    console.log('[Cron Send Scheduled] 🔍 Current time (UTC):', nowIso);
    console.log('[Cron Send Scheduled] 🔍 Current time (Local):', currentTime.toLocaleString());
    
    // First, check ALL scheduled messages (for debugging)
    const { data: allScheduled } = await supabase
      .from('messages')
      .select('id, title, scheduled_for, status, created_at')
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true });
    
    console.log(`[Cron Send Scheduled] 📊 Total scheduled messages in database: ${allScheduled?.length || 0}`);
    
    if (allScheduled && allScheduled.length > 0) {
      console.log('[Cron Send Scheduled] 📋 Scheduled messages details:');
      allScheduled.forEach((msg, index) => {
        const msgTime = new Date(msg.scheduled_for);
        const diff = msgTime.getTime() - currentTime.getTime();
        const minutesUntil = Math.floor(diff / 60000);
        const isPastDue = diff <= 0;
        
        console.log(`[Cron Send Scheduled]   ${index + 1}. "${msg.title}"`);
        console.log(`[Cron Send Scheduled]      - Scheduled for: ${msg.scheduled_for} (${msgTime.toLocaleString()})`);
        console.log(`[Cron Send Scheduled]      - Created: ${msg.created_at}`);
        console.log(`[Cron Send Scheduled]      - Status: ${isPastDue ? '✅ PAST DUE - Should send!' : `⏰ Future - sends in ${minutesUntil} minutes`}`);
        console.log(`[Cron Send Scheduled]      - Time difference: ${minutesUntil} minutes`);
      });
    }
    
    console.log('[Cron Send Scheduled] 🔎 Querying for messages with scheduled_for <=', nowIso);
    
    const { data: dueMessages, error: queryError } = await supabase
      .from('messages')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(10); // Process max 10 per run

    if (queryError) {
      console.error('[Cron Send Scheduled] ❌ Query error:', queryError);
      return NextResponse.json({ 
        error: queryError.message,
        success: false 
      }, { status: 500 });
    }

    console.log(`[Cron Send Scheduled] 🎯 Messages due for sending RIGHT NOW: ${dueMessages?.length || 0}`);

    if (!dueMessages || dueMessages.length === 0) {
      if (allScheduled && allScheduled.length > 0) {
        console.log('[Cron Send Scheduled] ⏰ No messages due yet, but', allScheduled.length, 'scheduled message(s) waiting');
      } else {
        console.log('[Cron Send Scheduled] ℹ️  No scheduled messages in database at all');
      }
      return NextResponse.json({ 
        success: true, 
        dispatched: 0,
        message: 'No messages due',
        totalScheduled: allScheduled?.length || 0
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
                  .select('sender_id, sender_name, conversation_tags')
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

                // Generate AI messages if AI personalization is enabled
                let aiMessagesMap: Record<string, string> | undefined;
                if (msg.ai_personalize_auto_fetch && selectedRecipients.length > 0) {
                  console.log(`[Cron Send Scheduled] AI personalization enabled for ${selectedRecipients.length} contacts`);
                  
                  try {
                    // Fetch message histories for all recipients
                    const { data: messageHistories } = await supabase
                      .from('messenger_messages')
                      .select('*')
                      .eq('page_id', page.facebook_page_id)
                      .in('sender_id', selectedRecipients)
                      .order('timestamp', { ascending: false })
                      .limit(1000);

                    // Group messages by sender_id to create conversation contexts
                    const conversationContexts: ConversationContext[] = [];
                    const messagesBySender = new Map<string, any[]>();
                    
                    if (messageHistories) {
                      for (const message of messageHistories) {
                        const senderId = message.sender_id;
                        if (!messagesBySender.has(senderId)) {
                          messagesBySender.set(senderId, []);
                        }
                        messagesBySender.get(senderId)!.push(message);
                      }
                    }

                    // Create context for each recipient
                    for (const senderId of selectedRecipients) {
                      const messages = messagesBySender.get(senderId) || [];
                      const conversation = filteredRecipients.find((c: any) => c.sender_id === senderId);
                      
                      conversationContexts.push({
                        conversationId: senderId,
                        participantName: conversation?.sender_name || 'Customer',
                        messages: messages.map(m => ({
                          from: m.is_from_page ? 'page' : conversation?.sender_name || 'Customer',
                          message: m.message_text || '',
                          timestamp: m.timestamp || new Date().toISOString()
                        }))
                      });
                    }

                    console.log(`[Cron Send Scheduled] Generating AI messages for ${conversationContexts.length} conversations...`);
                    
                    // Generate AI messages
                    const generatedMessages = await openRouterService.generateBatchMessages(
                      conversationContexts,
                      msg.ai_custom_instructions || undefined
                    );

                    // Build AI messages map
                    aiMessagesMap = {};
                    for (const generated of generatedMessages) {
                      aiMessagesMap[generated.conversationId] = generated.generatedMessage;
                    }

                    console.log(`[Cron Send Scheduled] Generated ${Object.keys(aiMessagesMap).length} AI messages`);
                  } catch (aiError) {
                    console.error('[Cron Send Scheduled] AI generation error:', aiError);
                    // Continue without AI messages if generation fails
                  }
                }

                // Update message with fresh recipients and AI messages
                const updateData: {
                  selected_recipients: string[];
                  recipient_count: number;
                  recipient_type: string;
                  use_ai_bulk_send?: boolean;
                  ai_messages_map?: Record<string, string>;
                } = {
                  selected_recipients: selectedRecipients,
                  recipient_count: selectedRecipients.length,
                  recipient_type: 'selected'
                };

                if (aiMessagesMap && Object.keys(aiMessagesMap).length > 0) {
                  updateData.use_ai_bulk_send = true;
                  updateData.ai_messages_map = aiMessagesMap;
                  console.log(`[Cron Send Scheduled] Enabled AI bulk send with ${Object.keys(aiMessagesMap).length} personalized messages`);
                }

                await supabase
                  .from('messages')
                  .update(updateData)
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
            // Use AI-generated message if available, otherwise use standard content
            let contentToSend = msg.content;
            if (msg.use_ai_bulk_send && msg.ai_messages_map && msg.ai_messages_map[recipientId]) {
              contentToSend = msg.ai_messages_map[recipientId];
              console.log(`[Cron Send Scheduled] Using AI-generated message for ${recipientId.substring(0, 20)}`);
            }

            const result = await sendFacebookMessage(
              page.facebook_page_id,
              recipientId,
              contentToSend,
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

