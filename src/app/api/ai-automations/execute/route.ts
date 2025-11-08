import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { openRouterService } from '@/lib/ai/openrouter';

/**
 * Execute AI automations - Check for conversations that match automation rules
 * and generate/send AI messages
 * POST /api/ai-automations/execute
 */
export async function POST() {
  try {
    console.log('[AI Automation] Execution started');
    
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get all enabled automation rules for this user
    const { data: rules, error: rulesError } = await supabase
      .from('ai_automation_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (rulesError) {
      console.error('[AI Automation] Error fetching rules:', rulesError);
      return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
    }

    if (!rules || rules.length === 0) {
      return NextResponse.json({ 
        message: 'No enabled automation rules found',
        executed: 0 
      });
    }

    console.log(`[AI Automation] Found ${rules.length} enabled rule(s)`);

    const results = [];

    // Process each rule
    for (const rule of rules) {
      try {
        // Check if within active hours (unless 24/7 mode)
        if (!rule.run_24_7) {
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          
          const startTimeInMinutes = rule.active_hours_start * 60 + (rule.active_hours_start_minutes || 0);
          const endTimeInMinutes = rule.active_hours_end * 60 + (rule.active_hours_end_minutes || 0);
          
          if (currentTimeInMinutes < startTimeInMinutes || currentTimeInMinutes >= endTimeInMinutes) {
            console.log(`[AI Automation] Rule ${rule.name} skipped - outside active hours (${rule.active_hours_start}:${String(rule.active_hours_start_minutes || 0).padStart(2, '0')}-${rule.active_hours_end}:${String(rule.active_hours_end_minutes || 0).padStart(2, '0')})`);
            continue;
          }
        } else {
          console.log(`[AI Automation] Rule ${rule.name} running in 24/7 mode`);
        }

        // Check daily limit
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count: todayCount } = await supabase
          .from('ai_automation_executions')
          .select('*', { count: 'exact', head: true })
          .eq('rule_id', rule.id)
          .gte('created_at', today.toISOString());

        if (todayCount && todayCount >= rule.max_messages_per_day) {
          console.log(`[AI Automation] Rule ${rule.name} hit daily limit (${todayCount}/${rule.max_messages_per_day})`);
          continue;
        }

        // Calculate time threshold
        const hoursAgo = new Date();
        const intervalHours = rule.time_interval_hours || (rule.time_interval_days * 24);
        hoursAgo.setHours(hoursAgo.getHours() - intervalHours);

        // Find conversations that match criteria
        let query = supabase
          .from('messenger_conversations')
          .select('id, sender_id, sender_name, page_id, last_message_time')
          .lte('last_message_time', hoursAgo.toISOString());

        // Filter by page if specified
        if (rule.page_id) {
          query = query.eq('page_id', rule.page_id);
        }

        const { data: conversations, error: convError } = await query;

        if (convError) {
          console.error(`[AI Automation] Error fetching conversations for rule ${rule.name}:`, convError);
          continue;
        }

        if (!conversations || conversations.length === 0) {
          console.log(`[AI Automation] No conversations match rule ${rule.name}`);
          continue;
        }

        console.log(`[AI Automation] Found ${conversations.length} conversations for rule ${rule.name}`);

        // Filter by tags if specified
        let filteredConversations = conversations;

        if (rule.include_tag_ids && rule.include_tag_ids.length > 0) {
          const { data: taggedConvs } = await supabase
            .from('conversation_tags')
            .select('conversation_id')
            .in('tag_id', rule.include_tag_ids);

          const taggedIds = new Set(taggedConvs?.map(t => t.conversation_id) || []);
          filteredConversations = conversations.filter(c => taggedIds.has(c.id));
        }

        if (rule.exclude_tag_ids && rule.exclude_tag_ids.length > 0) {
          const { data: excludeTaggedConvs } = await supabase
            .from('conversation_tags')
            .select('conversation_id')
            .in('tag_id', rule.exclude_tag_ids);

          const excludeIds = new Set(excludeTaggedConvs?.map(t => t.conversation_id) || []);
          filteredConversations = filteredConversations.filter(c => !excludeIds.has(c.id));
        }

        // Check which ones haven't been processed recently
        const { data: recentExecutions } = await supabase
          .from('ai_automation_executions')
          .select('conversation_id')
          .eq('rule_id', rule.id)
          .gte('created_at', hoursAgo.toISOString());

        const processedIds = new Set(recentExecutions?.map(e => e.conversation_id) || []);
        const toProcess = filteredConversations.filter(c => !processedIds.has(c.id));

        if (toProcess.length === 0) {
          console.log(`[AI Automation] All conversations already processed for rule ${rule.name}`);
          continue;
        }

        console.log(`[AI Automation] Processing ${toProcess.length} conversations for rule ${rule.name}`);

        // Limit to remaining daily quota
        const remainingQuota = rule.max_messages_per_day - (todayCount || 0);
        const conversationsToProcess = toProcess.slice(0, remainingQuota);

        // Generate AI messages for these conversations
        const ruleResult = {
          rule_id: rule.id,
          rule_name: rule.name,
          conversations_found: toProcess.length,
          conversations_processed: 0,
          messages_generated: 0,
          messages_sent: 0,
          errors: [] as Array<{ conversation_id: string; error: string }>
        };

        for (const conv of conversationsToProcess) {
          try {
            // Create execution record
            const { data: execution, error: execError } = await supabase
              .from('ai_automation_executions')
              .insert({
                rule_id: rule.id,
                conversation_id: conv.id,
                recipient_psid: conv.sender_id,
                recipient_name: conv.sender_name,
                ai_prompt_used: rule.custom_prompt,
                status: 'generating'
              })
              .select()
              .single();

            if (execError) {
              console.error(`[AI Automation] Error creating execution record:`, execError);
              continue;
            }

            // Fetch conversation messages for AI context
            const { data: page } = await supabase
              .from('facebook_pages')
              .select('access_token')
              .eq('facebook_page_id', conv.page_id)
              .single();

            if (!page) {
              console.error(`[AI Automation] No page found for conversation ${conv.id}`);
              continue;
            }

            // TODO: Fetch actual conversation messages from Facebook
            // For now, use basic context
            const context = {
              conversationId: conv.id,
              participantName: conv.sender_name || 'Customer',
              messages: [
                {
                  from: 'user' as const,
                  message: 'Previous conversation',
                  timestamp: conv.last_message_time
                }
              ]
            };

            // Generate AI message
            const generated = await openRouterService.generateFollowUpMessage(
              context,
              rule.custom_prompt
            );

            // Update execution with generated message
            await supabase
              .from('ai_automation_executions')
              .update({
                generated_message: generated.generatedMessage,
                ai_reasoning: generated.reasoning,
                status: 'sent',
                executed_at: new Date().toISOString()
              })
              .eq('id', execution.id);

            ruleResult.conversations_processed++;
            ruleResult.messages_generated++;

            console.log(`[AI Automation] Generated message for ${conv.sender_name}`);

            // Send the message via Facebook API
            try {
              const sendUrl = `https://graph.facebook.com/v18.0/me/messages?access_token=${page.access_token}`;
              const sendResponse = await fetch(sendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipient: { id: conv.sender_id },
                  message: { text: generated.generatedMessage },
                  messaging_type: rule.message_tag || 'MESSAGE_TAG',
                  tag: rule.message_tag || 'ACCOUNT_UPDATE'
                })
              });

              const sendResult = await sendResponse.json();

              if (sendResult.error) {
                console.error(`[AI Automation] Facebook send error:`, sendResult.error);
                await supabase
                  .from('ai_automation_executions')
                  .update({
                    status: 'failed',
                    error_message: sendResult.error.message
                  })
                  .eq('id', execution.id);
              } else {
                console.log(`[AI Automation] ✅ Message sent to ${conv.sender_name} - Message ID: ${sendResult.message_id}`);
                
                await supabase
                  .from('ai_automation_executions')
                  .update({
                    status: 'sent',
                    facebook_message_id: sendResult.message_id
                  })
                  .eq('id', execution.id);

                ruleResult.messages_sent++;
              }
            } catch (sendError) {
              console.error(`[AI Automation] Error sending message:`, sendError);
              await supabase
                .from('ai_automation_executions')
                .update({
                  status: 'failed',
                  error_message: sendError instanceof Error ? sendError.message : 'Send failed'
                })
                .eq('id', execution.id);
            }
            
          } catch (convError) {
            console.error(`[AI Automation] Error processing conversation ${conv.id}:`, convError);
            ruleResult.errors.push({
              conversation_id: conv.id,
              error: convError instanceof Error ? convError.message : 'Unknown error'
            });
          }
        }

        // Update rule execution stats
        await supabase
          .from('ai_automation_rules')
          .update({
            last_executed_at: new Date().toISOString(),
            execution_count: (rule.execution_count || 0) + 1,
            success_count: (rule.success_count || 0) + ruleResult.messages_sent,
            failure_count: (rule.failure_count || 0) + ruleResult.errors.length
          })
          .eq('id', rule.id);

        console.log(`[AI Automation] ✅ Rule ${rule.name} complete: ${ruleResult.messages_sent} sent, ${ruleResult.errors.length} errors`);

        results.push(ruleResult);

      } catch (ruleError) {
        console.error(`[AI Automation] Error processing rule ${rule.name}:`, ruleError);
      }
    }

    console.log(`[AI Automation] Execution complete. Processed ${results.length} rule(s)`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        rules_executed: results.length,
        total_messages_generated: results.reduce((sum, r) => sum + r.messages_generated, 0),
        total_messages_sent: results.reduce((sum, r) => sum + r.messages_sent, 0)
      }
    });

  } catch (error) {
    console.error('[AI Automation] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

