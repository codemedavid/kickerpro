import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { invalidateConversationCache, setCached, getCached } from '@/lib/redis/client';

// Webhook verification (GET request from Facebook)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'Token123';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error('Webhook verification failed');
    return new NextResponse('Verification token mismatch', { status: 403 });
  }
}

// Webhook events (POST request from Facebook)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Webhook event received:', JSON.stringify(body, null, 2));

    // Process webhook events
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        const messaging = entry.messaging || [];

        for (const event of messaging) {
          if (event.message) {
            // Only handle incoming messages (from user, not echo from page)
            // Alternative approach: Check if sender is the page itself
            const senderId = event.sender?.id;
            const recipientId = event.recipient?.id;
            // isEcho if: sender === recipient (page talking to itself) OR explicit is_echo flag
            // Also treat as echo if sender/recipient missing (safety)
            const isEcho = (senderId && recipientId && senderId === recipientId) || event.message.is_echo === true;
            
            if (!isEcho && event.message.text) {
              // This is a real user message with text
            await handleMessage(event);
            }
            
            // 🛑 STOP AUTOMATIONS when contact replies (not on echo messages)
            if (!isEcho) {
            await handleReplyDetection(event);
            }
          }
        }
      }
    }

    // Always return 200 OK to Facebook
    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent Facebook from retrying
    return NextResponse.json({ status: 'ERROR' }, { status: 200 });
  }
}

interface WebhookEvent {
  sender?: { id: string };
  recipient?: { id: string };
  message?: { 
    text?: string;
    is_echo?: boolean;
  };
  timestamp: number;
}

async function handleMessage(event: WebhookEvent) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const messageText = event.message?.text;
  const timestamp = event.timestamp;

  if (!senderId || !recipientId) {
    console.log('[Webhook⚡] Missing sender or recipient ID');
    return;
  }

  console.log(`[Webhook⚡] Message from ${senderId} to ${recipientId}`);
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    
    // Check cache for page user_id first
    const cacheKey = `page:${recipientId}:user`;
    let userId = await getCached<string>(cacheKey);

    if (!userId) {
      // Cache miss - fetch from database
      const { data: page } = await supabase
        .from('facebook_pages')
        .select('user_id')
        .eq('facebook_page_id', recipientId)
        .single();

      if (!page) {
        console.log(`[Webhook⚡] No page found for: ${recipientId}`);
        return;
      }

      userId = page.user_id;
      // Cache for 5 minutes
      await setCached(cacheKey, userId, 300);
    }

    // Save conversation with optimized upsert
    const payload = {
      user_id: userId,
      page_id: recipientId,
      sender_id: senderId,
      sender_name: 'Facebook User',
      last_message: messageText || '',
      last_message_time: new Date(timestamp).toISOString(),
      conversation_status: 'active'
    };

    const attemptUpsert = async (onConflict: string) =>
      supabase
        .from('messenger_conversations')
        .upsert(payload, {
          onConflict,
          ignoreDuplicates: false
        });

    let { error } = await attemptUpsert('page_id,sender_id');

    if (error && error.code === '42P10') {
      ({ error } = await attemptUpsert('user_id,page_id,sender_id'));
    }

    if (error) {
      console.error('[Webhook⚡] Error saving:', error.message);
    } else {
      // Invalidate conversation cache for instant UI updates
      await invalidateConversationCache(recipientId);
      
      const duration = Date.now() - startTime;
      console.log(`[Webhook⚡] ✓ Saved in ${duration}ms`);
    }
  } catch (error) {
    console.error('[Webhook⚡] Error:', error);
  }
}

/**
 * Handle reply detection and stop automations when contacts reply
 * This is the critical "Stop When Contact Replies" functionality
 */
async function handleReplyDetection(event: WebhookEvent) {
  try {
    const senderPSID = event.sender?.id;
    const pagePSID = event.recipient?.id;

    if (!senderPSID || !pagePSID) {
      console.log('[Reply Detector] Missing sender or recipient ID');
      return;
    }

    console.log(`[Reply Detector] 💬 Contact ${senderPSID} replied to page ${pagePSID}`);

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error('[Reply Detector] ❌ Missing Supabase credentials');
      return;
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

    // Find conversation
    const { data: conversation, error: convError } = await supabase
      .from('messenger_conversations')
      .select('id, page_id, sender_name')
      .eq('sender_id', senderPSID)
      .eq('page_id', pagePSID)
      .single();

    if (convError || !conversation) {
      console.log(`[Reply Detector] ⚠️  No conversation found for ${senderPSID} (might be first message)`);
      return;
    }

    console.log(`[Reply Detector] ✅ Found conversation: ${conversation.sender_name || senderPSID} (${conversation.id})`);

    // 🏷️ AUTO-REMOVE "AI" TAG when customer replies (universal behavior)
    // This happens regardless of automation rules
    try {
      const { data: aiTag } = await supabase
        .from('tags')
        .select('id, name')
        .ilike('name', 'AI')
        .single();

      if (aiTag) {
        const { error: removeError } = await supabase
          .from('conversation_tags')
          .delete()
          .eq('conversation_id', conversation.id)
          .eq('tag_id', aiTag.id);

        if (!removeError) {
          console.log(`[Reply Detector] 🏷️✨ Auto-removed "AI" tag for ${conversation.sender_name || senderPSID}`);
        }
      }
    } catch {
      // Don't fail if AI tag doesn't exist or removal fails
      console.log(`[Reply Detector] ℹ️ No "AI" tag found to remove (might not exist)`);
    }

    // Find active automation rules with stop_on_reply enabled
    const { data: activeRules, error: rulesError } = await supabase
      .from('ai_automation_rules')
      .select('id, name, remove_tag_on_reply, include_tag_ids')
      .eq('enabled', true)
      .eq('stop_on_reply', true);

    if (rulesError) {
      console.error('[Reply Detector] ❌ Error fetching rules:', rulesError);
      return;
    }

    if (!activeRules || activeRules.length === 0) {
      console.log('[Reply Detector] ℹ️  No rules with stop_on_reply enabled (AI tag already removed if present)');
      return;
    }

    console.log(`[Reply Detector] 🔍 Checking ${activeRules.length} rule(s) with stop_on_reply enabled`);

    let stoppedCount = 0;

    // Stop all applicable automations for this conversation
    for (const rule of activeRules) {
      console.log(`[Reply Detector] Checking rule: "${rule.name}" (${rule.id})`);

      // Check if this automation was running for this conversation
      const { data: hasExecutions, error: execError } = await supabase
        .from('ai_automation_executions')
        .select('follow_up_number, created_at')
        .eq('rule_id', rule.id)
        .eq('conversation_id', conversation.id)
        .order('follow_up_number', { ascending: false })
        .limit(1)
        .single();

      if (execError) {
        console.log(`[Reply Detector]   ℹ️  No executions found for rule "${rule.name}" on this conversation`);
        continue;
      }

      if (hasExecutions) {
        console.log(`[Reply Detector]   ✓ Found ${hasExecutions.follow_up_number} follow-up(s) sent`);

        // Check if already stopped
        const { data: existingStop } = await supabase
          .from('ai_automation_stops')
          .select('stopped_reason')
          .eq('rule_id', rule.id)
          .eq('conversation_id', conversation.id)
          .single();

        if (existingStop) {
          console.log(`[Reply Detector]   ⏭️  Already stopped (reason: ${existingStop.stopped_reason})`);
          continue;
        }

        // Stop the automation
        const { error: stopError } = await supabase
          .from('ai_automation_stops')
          .upsert({
            rule_id: rule.id,
            conversation_id: conversation.id,
            sender_id: senderPSID,
            stopped_reason: 'contact_replied',
            follow_ups_sent: hasExecutions.follow_up_number,
            tag_removed: rule.remove_tag_on_reply
          });

        if (stopError) {
          console.error(`[Reply Detector]   ❌ Error stopping automation:`, stopError);
          continue;
        }

        console.log(`[Reply Detector]   🛑 STOPPED automation "${rule.name}" for ${conversation.sender_name || senderPSID}`);
        stoppedCount++;

        // 🏷️ AUTO-REMOVE ALL TRIGGER TAGS (include_tag_ids)
        // Remove tags that triggered this automation so contact doesn't get re-processed
        if (rule.include_tag_ids && rule.include_tag_ids.length > 0) {
          console.log(`[Reply Detector]   🏷️  Removing ${rule.include_tag_ids.length} trigger tag(s)...`);
          
          for (const tagId of rule.include_tag_ids) {
            const { error: autoRemoveError } = await supabase
              .from('conversation_tags')
              .delete()
              .eq('conversation_id', conversation.id)
              .eq('tag_id', tagId);

            if (!autoRemoveError) {
              console.log(`[Reply Detector]      ✓ Removed trigger tag: ${tagId}`);
            } else {
              console.error(`[Reply Detector]      ✗ Failed to remove tag ${tagId}:`, autoRemoveError);
            }
          }
        }

        // Remove manual tag if specified (backward compatibility)
        if (rule.remove_tag_on_reply) {
          const { error: tagError } = await supabase
            .from('conversation_tags')
            .delete()
            .eq('conversation_id', conversation.id)
            .eq('tag_id', rule.remove_tag_on_reply);

          if (tagError) {
            console.error(`[Reply Detector]   ❌ Error removing manual tag:`, tagError);
          } else {
            console.log(`[Reply Detector]   🏷️  Removed manual tag ${rule.remove_tag_on_reply}`);
          }
        }
      } else {
        console.log(`[Reply Detector]   ⏭️  No active automation for rule "${rule.name}"`);
      }
    }

    if (stoppedCount > 0) {
      console.log(`[Reply Detector] ✅ Successfully stopped ${stoppedCount} automation(s) for ${conversation.sender_name || senderPSID}`);
    } else {
      console.log(`[Reply Detector] ℹ️  No automations needed to be stopped`);
    }
  } catch (error) {
    console.error('[Reply Detector] ❌ Unexpected error:', error);
    // Don't throw - we don't want to fail the webhook
  }
}
