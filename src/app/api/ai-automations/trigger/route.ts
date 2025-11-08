import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { openRouterService } from '@/lib/ai/openrouter';

/**
 * Manually trigger AI automations (for testing or manual execution)
 * POST /api/ai-automations/trigger
 */
// GET endpoint for easy testing in browser
export async function GET() {
  return POST({} as NextRequest);
}

export async function POST(request: NextRequest) {
  try {
    console.log('[AI Automation Trigger] Manual trigger started');
    
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { ruleId } = body;

    const supabase = await createClient();

    // Get the specific rule or all enabled rules
    let rulesQuery = supabase
      .from('ai_automation_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (ruleId) {
      rulesQuery = rulesQuery.eq('id', ruleId);
    }

    const { data: rules, error: rulesError } = await rulesQuery;

    if (rulesError) {
      console.error('[AI Automation Trigger] Error fetching rules:', rulesError);
      return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
    }

    if (!rules || rules.length === 0) {
      return NextResponse.json({ 
        message: 'No enabled automation rules found',
        executed: 0 
      });
    }

    console.log(`[AI Automation Trigger] Processing ${rules.length} rule(s)`);

    const results = [];

    // Process each rule
    for (const rule of rules) {
      try {
        console.log(`[AI Automation Trigger] Processing rule: ${rule.name}`);

        // Check if within active hours
        const currentHour = new Date().getHours();
        if (currentHour < rule.active_hours_start || currentHour >= rule.active_hours_end) {
          console.log(`[AI Automation Trigger] Rule ${rule.name} skipped - outside active hours`);
          results.push({
            rule_id: rule.id,
            rule_name: rule.name,
            status: 'skipped',
            reason: 'Outside active hours'
          });
          continue;
        }

        // Check daily limit
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count: todayCount } = await supabase
          .from('ai_automation_executions')
          .select('*', { count: 'exact', head: true })
          .eq('rule_id', rule.id)
          .gte('created_at', today.toISOString())
          .eq('status', 'sent');

        const remainingQuota = rule.max_messages_per_day - (todayCount || 0);

        if (remainingQuota <= 0) {
          console.log(`[AI Automation Trigger] Rule ${rule.name} hit daily limit`);
          results.push({
            rule_id: rule.id,
            rule_name: rule.name,
            status: 'skipped',
            reason: 'Daily limit reached'
          });
          continue;
        }

        // Calculate time threshold based on minutes, hours, or days
        const timeThreshold = new Date();
        let totalMinutes = 0;
        
        if (rule.time_interval_minutes) {
          totalMinutes = rule.time_interval_minutes;
        } else if (rule.time_interval_hours) {
          totalMinutes = rule.time_interval_hours * 60;
        } else if (rule.time_interval_days) {
          totalMinutes = rule.time_interval_days * 24 * 60;
        }
        
        timeThreshold.setMinutes(timeThreshold.getMinutes() - totalMinutes);
        
        const intervalDisplay = rule.time_interval_minutes 
          ? `${rule.time_interval_minutes} minutes`
          : rule.time_interval_hours 
            ? `${rule.time_interval_hours} hours`
            : `${rule.time_interval_days} days`;
        
        console.log(`[AI Automation Trigger] Time interval: ${intervalDisplay} (${totalMinutes} minutes)`);

        console.log(`[AI Automation Trigger] Looking for conversations inactive since ${timeThreshold.toISOString()}`);

        // Find conversations that match criteria
        let conversationsQuery = supabase
          .from('messenger_conversations')
          .select('id, sender_id, sender_name, page_id, last_message_time')
          .lte('last_message_time', timeThreshold.toISOString())
          .order('last_message_time', { ascending: true });

        // Filter by page if specified
        if (rule.page_id) {
          conversationsQuery = conversationsQuery.eq('page_id', rule.page_id);
        }

        const { data: conversations, error: convError } = await conversationsQuery;

        if (convError) {
          console.error(`[AI Automation Trigger] Error fetching conversations:`, convError);
          continue;
        }

        if (!conversations || conversations.length === 0) {
          console.log(`[AI Automation Trigger] No conversations match rule ${rule.name}`);
          results.push({
            rule_id: rule.id,
            rule_name: rule.name,
            status: 'no_matches',
            conversations_found: 0
          });
          continue;
        }

        console.log(`[AI Automation Trigger] Found ${conversations.length} candidate conversations`);

        // Filter by tags if specified
        let filteredConversations = conversations;

        if (rule.include_tag_ids && rule.include_tag_ids.length > 0) {
          const { data: taggedConvs } = await supabase
            .from('conversation_tags')
            .select('conversation_id')
            .in('tag_id', rule.include_tag_ids);

          const taggedIds = new Set(taggedConvs?.map(t => t.conversation_id) || []);
          filteredConversations = conversations.filter(c => taggedIds.has(c.id));
          console.log(`[AI Automation Trigger] After include tags filter: ${filteredConversations.length}`);
        }

        if (rule.exclude_tag_ids && rule.exclude_tag_ids.length > 0) {
          const { data: excludeTaggedConvs } = await supabase
            .from('conversation_tags')
            .select('conversation_id')
            .in('tag_id', rule.exclude_tag_ids);

          const excludeIds = new Set(excludeTaggedConvs?.map(t => t.conversation_id) || []);
          filteredConversations = filteredConversations.filter(c => !excludeIds.has(c.id));
          console.log(`[AI Automation Trigger] After exclude tags filter: ${filteredConversations.length}`);
        }

        // Check which ones haven't been processed by this rule recently
        // Get recent executions WITH their previous messages to ensure uniqueness
        const { data: recentExecutions } = await supabase
          .from('ai_automation_executions')
          .select('conversation_id, generated_message, previous_messages_shown, created_at, follow_up_number')
          .eq('rule_id', rule.id)
          .gte('created_at', timeThreshold.toISOString());

        // Check for stopped automations
        const { data: stoppedAutomations } = await supabase
          .from('ai_automation_stops')
          .select('conversation_id')
          .eq('rule_id', rule.id);

        const stoppedIds = new Set(stoppedAutomations?.map(s => s.conversation_id) || []);
        
        // Filter out stopped conversations
        filteredConversations = filteredConversations.filter(c => !stoppedIds.has(c.id));
        console.log(`[AI Automation Trigger] After stopped filter: ${filteredConversations.length}`);
        
        // Store previous messages and follow-up counts
        const previousMessagesMap = new Map<string, string[]>();
        const followUpCountMap = new Map<string, number>();
        
        // Group executions by conversation to count follow-ups
        const executionsByConv = new Map<string, typeof recentExecutions>();
        recentExecutions?.forEach(exec => {
          if (!executionsByConv.has(exec.conversation_id)) {
            executionsByConv.set(exec.conversation_id, []);
          }
          executionsByConv.get(exec.conversation_id)!.push(exec);
        });
        
        // Process each conversation's history
        executionsByConv.forEach((execs, convId) => {
          if (execs && execs.length > 0) {
            const prevMessages = execs
              .map(e => e.generated_message)
              .filter(Boolean);
            previousMessagesMap.set(convId, prevMessages);
            followUpCountMap.set(convId, execs.length);
          }
        });
        
        // Filter out conversations that reached max follow-ups
        let toProcess = filteredConversations;
        
        if (rule.max_follow_ups) {
          toProcess = filteredConversations.filter(c => {
            const currentCount = followUpCountMap.get(c.id) || 0;
            return currentCount < rule.max_follow_ups!;
          });
          
          const reachedMax = filteredConversations.length - toProcess.length;
          if (reachedMax > 0) {
            console.log(`[AI Automation Trigger] ${reachedMax} conversation(s) reached max follow-ups (${rule.max_follow_ups})`);
          }
        }
        
        // Check which ones need processing based on time threshold
        const processedRecentlyIds = new Set(
          recentExecutions
            ?.filter(e => new Date(e.created_at) > timeThreshold)
            .map(e => e.conversation_id) || []
        );
        toProcess = toProcess.filter(c => !processedRecentlyIds.has(c.id));

        if (toProcess.length === 0) {
          console.log(`[AI Automation Trigger] All matching conversations already processed`);
          results.push({
            rule_id: rule.id,
            rule_name: rule.name,
            status: 'all_processed',
            conversations_found: filteredConversations.length
          });
          continue;
        }

        // Limit to remaining quota
        const conversationsToProcess = toProcess.slice(0, remainingQuota);

        console.log(`[AI Automation Trigger] Processing ${conversationsToProcess.length} conversations (quota: ${remainingQuota})`);

        const ruleResult = {
          rule_id: rule.id,
          rule_name: rule.name,
          status: 'executed',
          conversations_found: toProcess.length,
          conversations_processed: 0,
          messages_generated: 0,
          messages_sent: 0,
            errors: [] as Array<{ conversation_id: string; error: string }>
        };

        // Process each conversation
        for (const conv of conversationsToProcess) {
          try {
            // Get page access token
            const { data: page } = await supabase
              .from('facebook_pages')
              .select('id, facebook_page_id, access_token, name')
              .eq('facebook_page_id', conv.page_id)
              .single();

            if (!page) {
              console.error(`[AI Automation Trigger] No page found for conversation ${conv.id}`);
              continue;
            }

            // Fetch conversation messages from Facebook for AI context
            const conversationUrl = `https://graph.facebook.com/v18.0/me/conversations?user_id=${conv.sender_id}&fields=messages.limit(10){from,message,created_time}&access_token=${page.access_token}`;
            
            let messages: Array<{ from: string; message: string; timestamp: string }> = [];

            try {
              const conversationResponse = await fetch(conversationUrl);
              if (conversationResponse.ok) {
                const conversationData = await conversationResponse.json();
                const conversation = conversationData.data?.[0];
                
                if (conversation?.messages?.data) {
                  const messagesList = conversation.messages.data;
                  const recentMessages = messagesList.slice(0, 10);
                  messages = recentMessages.reverse().map((msg: { from: { id: string }; message: string; created_time: string }) => ({
                    from: msg.from?.id === conv.sender_id ? 'user' : 'business',
                    message: msg.message || '(No text)',
                    timestamp: msg.created_time
                  }));
                }
              }
            } catch {
              console.warn(`[AI Automation Trigger] Could not fetch messages for ${conv.id}`);
            }

            // Use fallback if no messages fetched
            if (messages.length === 0) {
              messages = [
                {
                  from: 'user',
                  message: 'Previous conversation',
                  timestamp: conv.last_message_time
                }
              ];
            }

            const context = {
              conversationId: conv.id,
              participantName: conv.sender_name || 'Customer',
              messages
            };

            // Get previous AI messages and follow-up count
            const previousMessages = previousMessagesMap.get(conv.id) || [];
            const currentFollowUpNumber = (followUpCountMap.get(conv.id) || 0) + 1;
            
            // Check if this would exceed max follow-ups
            if (rule.max_follow_ups && currentFollowUpNumber > rule.max_follow_ups) {
              console.log(`[AI Automation Trigger] Skipping ${conv.sender_name} - reached max follow-ups (${rule.max_follow_ups})`);
              
              // Stop this automation for this conversation
              await supabase
                .from('ai_automation_stops')
                .upsert({
                  rule_id: rule.id,
                  conversation_id: conv.id,
                  sender_id: conv.sender_id,
                  stopped_reason: 'max_follow_ups_reached',
                  follow_ups_sent: currentFollowUpNumber - 1
                });
              
              continue;
            }
            
            // Enhance prompt with anti-repetition and follow-up number
            let enhancedPrompt = rule.custom_prompt;
            if (previousMessages.length > 0) {
              enhancedPrompt = `${rule.custom_prompt}

🚨 CRITICAL UNIQUENESS REQUIREMENT:
This is FOLLOW-UP #${currentFollowUpNumber} to this person.
You have sent ${previousMessages.length} previous message(s).

PREVIOUS MESSAGES YOU SENT (DO NOT REPEAT):
${previousMessages.map((msg, i) => `Message #${i + 1}: "${msg}"`).join('\n\n')}

⚠️ MANDATORY FOR FOLLOW-UP #${currentFollowUpNumber}:
- Your message MUST be COMPLETELY DIFFERENT from ALL ${previousMessages.length} previous messages
- Use DIFFERENT greeting (vary: Kumusta/Hey/Hi/Uy/Hello)
- Use DIFFERENT sentence structure
- Reference DIFFERENT aspects of their conversation
- Use DIFFERENT approach (don't repeat same angle)
- Use DIFFERENT call-to-action
- This is follow-up #${currentFollowUpNumber}, so adjust tone accordingly

EXAMPLES OF VARIETY:
Follow-up #1: Direct reference + offer
Follow-up #2: Checking in + reminder
Follow-up #3: Different angle + new info
Follow-up #4: Casual + no pressure

VERIFICATION BEFORE RESPONDING:
1. Does it use different greeting? YES/NO
2. Is sentence structure different? YES/NO
3. Is approach/angle different? YES/NO
4. Is it substantially different from ALL previous? YES/NO

If ANY NO → REWRITE until ALL YES`;
            } else {
              enhancedPrompt = `${rule.custom_prompt}

📝 This is FOLLOW-UP #${currentFollowUpNumber} (first automated message to this person)`;
            }

            // Generate AI message
            console.log(`[AI Automation Trigger] Generating follow-up #${currentFollowUpNumber} for ${conv.sender_name}... (${previousMessages.length} previous)`);
            const generated = await openRouterService.generateFollowUpMessage(
              context,
              enhancedPrompt
            );

            // Create message record for sending
            const { data: message, error: messageError } = await supabase
              .from('messages')
              .insert({
                user_id: userId,
                page_id: page.id,
                content: generated.generatedMessage,
                status: 'pending',
                recipient_type: 'selected',
                selected_recipients: [conv.sender_id],
                recipient_count: 1,
                message_tag: rule.message_tag, // Auto-select ACCOUNT_UPDATE
                batch_size: 1,
                scheduled_for: new Date().toISOString() // Send immediately
              })
              .select()
              .single();

            if (messageError) {
              console.error(`[AI Automation Trigger] Error creating message:`, messageError);
              ruleResult.errors.push({
                conversation_id: conv.id,
                error: 'Failed to create message'
              });
              continue;
            }

            // Send immediately via Facebook API
            const sendResponse = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${page.access_token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { id: conv.sender_id },
                message: { text: generated.generatedMessage },
                messaging_type: 'MESSAGE_TAG',
                tag: rule.message_tag
              })
            });

            const sendData = await sendResponse.json();

            if (sendResponse.ok) {
              // Update execution record with follow-up number and previous messages
              await supabase
                .from('ai_automation_executions')
                .insert({
                  rule_id: rule.id,
                  conversation_id: conv.id,
                  recipient_psid: conv.sender_id,
                  recipient_name: conv.sender_name,
                  ai_prompt_used: rule.custom_prompt,
                  generated_message: generated.generatedMessage,
                  ai_reasoning: generated.reasoning,
                  previous_messages_shown: previousMessages,
                  follow_up_number: currentFollowUpNumber,
                  status: 'sent',
                  message_id: message.id,
                  facebook_message_id: sendData.message_id,
                  executed_at: new Date().toISOString()
                });
              
              // If this was the last follow-up, stop the automation
              if (rule.max_follow_ups && currentFollowUpNumber >= rule.max_follow_ups) {
                await supabase
                  .from('ai_automation_stops')
                  .upsert({
                    rule_id: rule.id,
                    conversation_id: conv.id,
                    sender_id: conv.sender_id,
                    stopped_reason: 'max_follow_ups_reached',
                    follow_ups_sent: currentFollowUpNumber
                  });
                
                console.log(`[AI Automation Trigger] 🛑 Stopped automation for ${conv.sender_name} - reached max (${rule.max_follow_ups})`);
              }

              // Update message status
              await supabase
                .from('messages')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', message.id);

              ruleResult.conversations_processed++;
              ruleResult.messages_generated++;
              ruleResult.messages_sent++;

              console.log(`[AI Automation Trigger] ✅ Sent message to ${conv.sender_name}`);
            } else {
              console.error(`[AI Automation Trigger] Facebook API error:`, sendData);
              ruleResult.errors.push({
                conversation_id: conv.id,
                error: sendData.error?.message || 'Failed to send'
              });
            }

          } catch (convError) {
            console.error(`[AI Automation Trigger] Error processing conversation ${conv.id}:`, convError);
            ruleResult.errors.push({
              conversation_id: conv.id,
              error: convError instanceof Error ? convError.message : 'Unknown error'
            });
          }
        }

        // Update rule stats
        await supabase
          .from('ai_automation_rules')
          .update({
            last_executed_at: new Date().toISOString(),
            execution_count: rule.execution_count + 1,
            success_count: rule.success_count + ruleResult.messages_sent
          })
          .eq('id', rule.id);

        results.push(ruleResult);

      } catch (ruleError) {
        console.error(`[AI Automation Trigger] Error processing rule:`, ruleError);
      }
    }

    const summary = {
      rules_executed: results.filter(r => r.status === 'executed').length,
      rules_skipped: results.filter(r => r.status === 'skipped').length,
      total_messages_generated: results.reduce((sum, r) => sum + ('messages_generated' in r ? r.messages_generated : 0), 0),
      total_messages_sent: results.reduce((sum, r) => sum + ('messages_sent' in r ? r.messages_sent : 0), 0),
      total_errors: results.reduce((sum, r) => sum + ('errors' in r && r.errors ? r.errors.length : 0), 0)
    };

    console.log(`[AI Automation Trigger] Complete:`, summary);

    return NextResponse.json({
      success: true,
      results,
      summary
    });

  } catch (error) {
    console.error('[AI Automation Trigger] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

