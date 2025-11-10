/**
 * FIXED WEBHOOK HANDLER
 * Addresses critical race condition and data consistency issues
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

interface WebhookEvent {
  sender?: { id: string };
  recipient?: { id: string };
  message?: { 
    text?: string;
    is_echo?: boolean;
  };
  timestamp: number;
}

/**
 * FIX #14 & #1: Handle message with optimistic locking and proper deduplication
 */
export async function handleMessageFixed(event: WebhookEvent) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const messageText = event.message?.text;
  const timestamp = event.timestamp;

  if (!senderId || !recipientId) {
    console.log('[Webhook Fixed] Missing sender or recipient ID');
    return;
  }

  console.log(`[Webhook Fixed] Processing message from ${senderId} to page ${recipientId}`);
  const startTime = Date.now();

  try {
    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error('[Webhook Fixed] Missing Supabase credentials');
      return;
    }

    const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get page user_id
    const { data: page } = await supabase
      .from('facebook_pages')
      .select('user_id, access_token')
      .eq('facebook_page_id', recipientId)
      .single();

    if (!page) {
      console.log(`[Webhook Fixed] No page found for: ${recipientId}`);
      return;
    }

    const userId = page.user_id;

    // Fetch sender name from Facebook API
    let senderName = 'Facebook User';
    try {
      if (page.access_token) {
        const userInfoUrl = `https://graph.facebook.com/v18.0/${senderId}?fields=name&access_token=${page.access_token}`;
        const userInfoRes = await fetch(userInfoUrl);
        const userInfo = await userInfoRes.json();
        
        if (userInfo.name) {
          senderName = userInfo.name;
        }
      }
    } catch (nameError) {
      console.warn('[Webhook Fixed] Could not fetch sender name:', nameError);
    }

    // ============================================================================
    // FIX #14: USE ATOMIC RPC WITH OPTIMISTIC LOCKING
    // ============================================================================
    
    // Prepare event for this message
    const events = [{
      event_type: 'message_replied',
      event_timestamp: new Date(timestamp).toISOString(),
      channel: 'messenger',
      is_outbound: false,
      is_success: true,
      success_weight: 1.0,
      metadata: {
        source: 'webhook',
        message_text: messageText || '',
        received_at: new Date().toISOString()
      }
    }];

    // Use atomic upsert function
    const { data: result, error } = await supabase.rpc(
      'upsert_conversation_with_events',
      {
        p_user_id: userId,
        p_page_id: recipientId,
        p_sender_id: senderId,
        p_sender_name: senderName,
        p_last_message: messageText || '',
        p_last_message_time: new Date(timestamp).toISOString(),
        p_conversation_status: 'active',
        p_events: events
      }
    );

    if (error) {
      console.error('[Webhook Fixed] Error upserting conversation:', error.message);
      return;
    }

    const duration = Date.now() - startTime;
    const conversationData = result as Array<{
      conversation_id: string;
      is_new: boolean;
      events_created: number;
      version: number;
    }>;

    if (conversationData && conversationData.length > 0) {
      const { conversation_id, is_new, events_created, version } = conversationData[0];
      
      if (is_new) {
        console.log(`[Webhook Fixed] ✨ NEW CONTACT: ${senderName} (${senderId}) - ${events_created} events created - ${duration}ms`);
      } else {
        console.log(`[Webhook Fixed] ✓ Updated: ${senderName} (${senderId}) - v${version} - ${duration}ms`);
      }

      // ============================================================================
      // HANDLE REPLY DETECTION (Stop automations)
      // ============================================================================
      await handleReplyDetectionFixed(conversation_id, senderId, recipientId, senderName, supabase);
    }

  } catch (error) {
    console.error('[Webhook Fixed] Error:', error);
  }
}

/**
 * FIX: Improved reply detection with better error handling
 */
async function handleReplyDetectionFixed(
  conversationId: string,
  senderPSID: string,
  pagePSID: string,
  senderName: string,
  supabase: ReturnType<typeof createSupabaseClient>
) {
  try {
    console.log(`[Reply Detector Fixed] 💬 Contact replied: ${senderName} (${senderPSID})`);

    // 🏷️ AUTO-REMOVE "AI" TAG (universal behavior)
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
          .eq('conversation_id', conversationId)
          .eq('tag_id', aiTag.id);

        if (!removeError) {
          console.log(`[Reply Detector Fixed] 🏷️ Removed "AI" tag for ${senderName}`);
        }
      }
    } catch {
      // AI tag doesn't exist or already removed
    }

    // Find active automation rules with stop_on_reply enabled
    const { data: activeRules, error: rulesError } = await supabase
      .from('ai_automation_rules')
      .select('id, name, remove_tag_on_reply, include_tag_ids')
      .eq('enabled', true)
      .eq('stop_on_reply', true);

    if (rulesError || !activeRules || activeRules.length === 0) {
      return;
    }

    console.log(`[Reply Detector Fixed] Checking ${activeRules.length} rule(s) with stop_on_reply`);

    let stoppedCount = 0;

    for (const rule of activeRules) {
      // Check if automation was running
      const { data: hasExecutions } = await supabase
        .from('ai_automation_executions')
        .select('follow_up_number')
        .eq('rule_id', rule.id)
        .eq('conversation_id', conversationId)
        .order('follow_up_number', { ascending: false })
        .limit(1)
        .single();

      if (!hasExecutions) continue;

      // Check if already stopped
      const { data: existingStop } = await supabase
        .from('ai_automation_stops')
        .select('id')
        .eq('rule_id', rule.id)
        .eq('conversation_id', conversationId)
        .single();

      if (existingStop) continue;

      // Stop the automation
      const { error: stopError } = await supabase
        .from('ai_automation_stops')
        .upsert({
          rule_id: rule.id,
          conversation_id: conversationId,
          sender_id: senderPSID,
          stopped_reason: 'contact_replied',
          follow_ups_sent: hasExecutions.follow_up_number,
          tag_removed: rule.remove_tag_on_reply
        });

      if (stopError) {
        console.error(`[Reply Detector Fixed] Error stopping automation:`, stopError);
        continue;
      }

      console.log(`[Reply Detector Fixed] 🛑 STOPPED automation "${rule.name}" for ${senderName}`);
      stoppedCount++;

      // Remove trigger tags
      if (rule.include_tag_ids && rule.include_tag_ids.length > 0) {
        for (const tagId of rule.include_tag_ids) {
          await supabase
            .from('conversation_tags')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('tag_id', tagId);
        }
        console.log(`[Reply Detector Fixed] 🏷️ Removed ${rule.include_tag_ids.length} trigger tag(s)`);
      }

      // Remove manual tag if specified
      if (rule.remove_tag_on_reply) {
        await supabase
          .from('conversation_tags')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('tag_id', rule.remove_tag_on_reply);
      }
    }

    if (stoppedCount > 0) {
      console.log(`[Reply Detector Fixed] ✅ Stopped ${stoppedCount} automation(s) for ${senderName}`);
    }

  } catch (error) {
    console.error('[Reply Detector Fixed] Error:', error);
    // Don't throw - webhook should always succeed
  }
}

/**
 * Export functions for use in main webhook route
 */
export const WebhookFixed = {
  handleMessage: handleMessageFixed,
  handleReplyDetection: handleReplyDetectionFixed
};

