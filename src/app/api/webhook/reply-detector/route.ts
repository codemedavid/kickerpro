import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Force dynamic rendering - this is an API route
export const dynamic = 'force-dynamic';

/**
 * Webhook handler for detecting contact replies
 * This processes Facebook webhook events to detect when contacts reply
 * and stops AI automations accordingly
 * 
 * POST /api/webhook/reply-detector
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Verify Facebook webhook
    const mode = body.object;
    if (mode !== 'page') {
      return NextResponse.json({ success: true });
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      const messaging = entry.messaging || [];
      
      for (const event of messaging) {
        // Check if this is a message from a user (not from page)
        if (event.message && event.sender?.id && event.recipient?.id) {
          const senderPSID = event.sender.id;
          const pagePSID = event.recipient.id;
          
          console.log(`[Reply Detector] Contact ${senderPSID} replied to page ${pagePSID}`);
          
          // Create Supabase admin client
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          
          if (!supabaseUrl || !serviceKey) {
            continue;
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
          const { data: conversation } = await supabase
            .from('messenger_conversations')
            .select('id, page_id')
            .eq('sender_id', senderPSID)
            .eq('page_id', pagePSID)
            .single();
          
          if (!conversation) {
            console.log(`[Reply Detector] No conversation found for ${senderPSID}`);
            continue;
          }
          
          console.log(`[Reply Detector] ✅ Found conversation for ${senderPSID}`);
          
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
                console.log(`[Reply Detector] 🏷️✨ Auto-removed "AI" tag for ${senderPSID}`);
              }
            }
          } catch {
            // Don't fail if AI tag doesn't exist or removal fails
            console.log(`[Reply Detector] ℹ️ No "AI" tag found to remove (might not exist)`);
          }
          
          // Find active automation rules with stop_on_reply enabled
          const { data: activeRules } = await supabase
            .from('ai_automation_rules')
            .select('id, name, remove_tag_on_reply')
            .eq('enabled', true)
            .eq('stop_on_reply', true);
          
          if (!activeRules || activeRules.length === 0) {
            console.log(`[Reply Detector] ℹ️ No rules with stop_on_reply enabled (AI tag already removed if present)`);
            continue;
          }
          
          console.log(`[Reply Detector] Found ${activeRules.length} rules with stop_on_reply`);
          
          // Stop all applicable automations for this conversation
          for (const rule of activeRules) {
            // Check if this automation was running for this conversation
            const { data: hasExecutions } = await supabase
              .from('ai_automation_executions')
              .select('follow_up_number')
              .eq('rule_id', rule.id)
              .eq('conversation_id', conversation.id)
              .order('follow_up_number', { ascending: false })
              .limit(1)
              .single();
            
            if (hasExecutions) {
              // Stop the automation
              await supabase
                .from('ai_automation_stops')
                .upsert({
                  rule_id: rule.id,
                  conversation_id: conversation.id,
                  sender_id: senderPSID,
                  stopped_reason: 'contact_replied',
                  follow_ups_sent: hasExecutions.follow_up_number,
                  tag_removed: rule.remove_tag_on_reply
                });
              
              console.log(`[Reply Detector] 🛑 Stopped automation "${rule.name}" for ${senderPSID}`);
              
              // Remove tag if specified
              if (rule.remove_tag_on_reply) {
                await supabase
                  .from('conversation_tags')
                  .delete()
                  .eq('conversation_id', conversation.id)
                  .eq('tag_id', rule.remove_tag_on_reply);
                
                console.log(`[Reply Detector] 🏷️ Removed tag for ${senderPSID}`);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('[Reply Detector] Error:', error);
    return NextResponse.json({ success: true }); // Don't fail webhook
  }
}

/**
 * Webhook verification for Facebook
 * GET /api/webhook/reply-detector
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'your-verify-token';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Reply Detector] Webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}




