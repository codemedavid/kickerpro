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
        console.log(`[AI Automation Trigger] Rule config - message_tag: ${rule.message_tag || 'NOT SET (will use ACCOUNT_UPDATE)'}`);
        console.log(`[AI Automation Trigger] Rule config - run_24_7: ${rule.run_24_7 ? 'YES (24/7 mode)' : 'NO'}`);

        // Check if within active hours (unless 24/7 mode)
        if (!rule.run_24_7) {
          const currentHour = new Date().getHours();
          if (currentHour < rule.active_hours_start || currentHour >= rule.active_hours_end) {
            console.log(`[AI Automation Trigger] Rule ${rule.name} skipped - outside active hours (current: ${currentHour}, allowed: ${rule.active_hours_start}-${rule.active_hours_end})`);
            results.push({
              rule_id: rule.id,
              rule_name: rule.name,
              status: 'skipped',
              reason: 'Outside active hours'
            });
            continue;
          }
        } else {
          console.log(`[AI Automation Trigger] Rule ${rule.name} running in 24/7 mode - skipping hour check`);
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

        // 🔒 STRICT TAG FILTERING - ONLY process conversations with matching tags
        let filteredConversations = [];

        if (rule.include_tag_ids && rule.include_tag_ids.length > 0) {
          console.log(`[AI Automation Trigger] 🏷️  REQUIRED TAGS: ${rule.include_tag_ids.join(', ')}`);
          
          const { data: taggedConvs } = await supabase
            .from('conversation_tags')
            .select('conversation_id')
            .in('tag_id', rule.include_tag_ids);

          const taggedIds = new Set(taggedConvs?.map(t => t.conversation_id) || []);
          filteredConversations = conversations.filter(c => taggedIds.has(c.id));
          
          console.log(`[AI Automation Trigger] ✅ MATCHED ${filteredConversations.length} out of ${conversations.length} WITH required tags`);
          console.log(`[AI Automation Trigger] 🚫 EXCLUDED ${conversations.length - filteredConversations.length} WITHOUT required tags`);
        } else {
          console.log(`[AI Automation Trigger] ⚠️  WARNING: No tags specified - processing ALL conversations`);
          filteredConversations = conversations;
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

        // Get ALL executions for these conversations to check timing and build history
        const { data: allExecutions } = await supabase
          .from('ai_automation_executions')
          .select('conversation_id, generated_message, previous_messages_shown, created_at, follow_up_number, status')
          .eq('rule_id', rule.id)
          .in('conversation_id', filteredConversations.map(c => c.id))
          .order('created_at', { ascending: false });

        // Check for stopped automations
        const { data: stoppedAutomations } = await supabase
          .from('ai_automation_stops')
          .select('conversation_id')
          .eq('rule_id', rule.id);

        const stoppedIds = new Set(stoppedAutomations?.map(s => s.conversation_id) || []);
        
        // Filter out stopped conversations
        filteredConversations = filteredConversations.filter(c => !stoppedIds.has(c.id));
        console.log(`[AI Automation Trigger] After stopped filter: ${filteredConversations.length}`);
        
        // Store previous messages, follow-up counts, and last execution times
        const previousMessagesMap = new Map<string, string[]>();
        const followUpCountMap = new Map<string, number>();
        const lastExecutionTimeMap = new Map<string, Date>();
        
        // Group executions by conversation
        const executionsByConv = new Map<string, typeof allExecutions>();
        allExecutions?.forEach(exec => {
          if (!executionsByConv.has(exec.conversation_id)) {
            executionsByConv.set(exec.conversation_id, []);
          }
          executionsByConv.get(exec.conversation_id)!.push(exec);
        });
        
        // Process each conversation's history
        executionsByConv.forEach((execs, convId) => {
          if (execs && execs.length > 0) {
            // Get previous messages
            const prevMessages = execs
              .map(e => e.generated_message)
              .filter(Boolean);
            previousMessagesMap.set(convId, prevMessages);
            
            // Count follow-ups
            followUpCountMap.set(convId, execs.length);
            
            // Get last execution time
            const lastExec = execs[0]; // Already sorted by created_at desc
            if (lastExec) {
              lastExecutionTimeMap.set(convId, new Date(lastExec.created_at));
            }
          }
        });
        
        // 🔧 DEDUPLICATION: Remove duplicate conversations by sender_id
        const seenSenders = new Set<string>();
        const uniqueConversations = filteredConversations.filter(c => {
          if (seenSenders.has(c.sender_id)) {
            console.log(`[AI Automation Trigger] 🚫 Removing duplicate conversation for ${c.sender_name} (sender_id: ${c.sender_id})`);
            return false;
          }
          seenSenders.add(c.sender_id);
          return true;
        });

        if (filteredConversations.length > uniqueConversations.length) {
          console.log(`[AI Automation Trigger] Removed ${filteredConversations.length - uniqueConversations.length} duplicate conversation(s)`);
        }

        // Filter conversations based on cooldown period and max follow-ups
        const toProcess = uniqueConversations.filter(c => {
          // Check max follow-ups
        if (rule.max_follow_ups) {
            const currentCount = followUpCountMap.get(c.id) || 0;
            if (currentCount >= rule.max_follow_ups) {
              return false;
            }
          }
          
          // Check if enough time has passed since last execution
          const lastExecTime = lastExecutionTimeMap.get(c.id);
          if (lastExecTime) {
            const timeSinceLastExec = Date.now() - lastExecTime.getTime();
            const cooldownMs = totalMinutes * 60 * 1000;
            
            // Skip if still in cooldown period
            if (timeSinceLastExec < cooldownMs) {
              const minutesSince = Math.floor(timeSinceLastExec / 60000);
              console.log(`[AI Automation Trigger] Skipping ${c.sender_name} - last processed ${minutesSince} minutes ago (needs ${totalMinutes - minutesSince} more)`);
              return false;
          }
        }
        
          return true;
        });
        
        const filteredOutCount = uniqueConversations.length - toProcess.length;
        if (filteredOutCount > 0) {
          console.log(`[AI Automation Trigger] Filtered out ${filteredOutCount} conversation(s) (cooldown period or max follow-ups reached)`);
        }

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

        // Store state IDs for tracking
        const stateIdMap = new Map<string, string>();

        // Process each conversation
        for (const conv of conversationsToProcess) {
          try {
            // 🔒 SAFETY CHECK: Double-verify contact has required tag before processing
            if (rule.include_tag_ids && rule.include_tag_ids.length > 0) {
              const { data: contactTags } = await supabase
                .from('conversation_tags')
                .select('tag_id')
                .eq('conversation_id', conv.id)
                .in('tag_id', rule.include_tag_ids);

              if (!contactTags || contactTags.length === 0) {
                console.log(`[AI Automation Trigger] 🚫 BLOCKED ${conv.sender_name} - NO required tag, skipping`);
                continue;
              }
              
              console.log(`[AI Automation Trigger] ✅ VERIFIED ${conv.sender_name} has required tag(s)`);
            }

            // 🔴 LIVE FACEBOOK CHECK: Fetch fresh conversation data before sending
            console.log(`[AI Automation Trigger] 🔍 Fetching live conversation data from Facebook...`);
            let shouldStopDueToReply = false;
            
            // Get page access token
            const { data: checkPage } = await supabase
              .from('facebook_pages')
              .select('access_token')
              .eq('facebook_page_id', conv.page_id)
              .single();
            
            if (checkPage?.access_token) {
              try {
                const fbConvoUrl = `https://graph.facebook.com/v18.0/me/conversations?user_id=${conv.sender_id}&fields=messages.limit(5){from,message,created_time}&access_token=${checkPage.access_token}`;
                const fbResponse = await fetch(fbConvoUrl);
                const fbData = await fbResponse.json();
                
                if (fbResponse.ok && fbData.data && fbData.data[0]?.messages?.data) {
                  const recentMessages = fbData.data[0].messages.data;
                  const userMessages = recentMessages.filter((msg: { from?: { id?: string }; created_time?: string }) => msg.from?.id === conv.sender_id);
                  
                  if (userMessages.length > 0) {
                    const lastUserMessage = userMessages[0];
                    const lastUserMessageTime = new Date(lastUserMessage.created_time);
                    const minutesSinceUserMessage = Math.floor((Date.now() - lastUserMessageTime.getTime()) / 60000);
                    
                    console.log(`[AI Automation Trigger] 📊 Last user message: ${minutesSinceUserMessage} minutes ago`);
                    
                    if (minutesSinceUserMessage < totalMinutes) {
                      console.log(`[AI Automation Trigger] ⏭️  User replied ${minutesSinceUserMessage} minutes ago (within ${totalMinutes} min interval)`);
                      console.log(`[AI Automation Trigger] 💬 Their message: "${lastUserMessage.message?.substring(0, 50)}..."`);
                      
                      // Update database with fresh timestamp
                      await supabase
                        .from('messenger_conversations')
                        .update({ last_message_time: lastUserMessageTime.toISOString() })
                        .eq('id', conv.id);
                      
                      // Stop automation permanently if stop_on_reply enabled
                      if (rule.stop_on_reply) {
                        console.log(`[AI Automation Trigger] 🛑 Stopping automation PERMANENTLY (detected reply)`);
                        
                        const { data: existingStop } = await supabase
                          .from('ai_automation_stops')
                          .select('id')
                          .eq('rule_id', rule.id)
                          .eq('conversation_id', conv.id)
                          .single();
                        
                        if (!existingStop) {
                          await supabase
                            .from('ai_automation_stops')
                            .insert({
                              rule_id: rule.id,
                              conversation_id: conv.id,
                              sender_id: conv.sender_id,
                              stopped_reason: 'contact_replied_live_check',
                              follow_ups_sent: 0
                            });
                          
                          console.log(`[AI Automation Trigger] ✅ Stop record created`);
                          
                          // Remove all trigger tags
                          if (rule.include_tag_ids && rule.include_tag_ids.length > 0) {
                            console.log(`[AI Automation Trigger] 🏷️  Removing ${rule.include_tag_ids.length} trigger tag(s)...`);
                            for (const tagId of rule.include_tag_ids) {
                              await supabase
                                .from('conversation_tags')
                                .delete()
                                .eq('conversation_id', conv.id)
                                .eq('tag_id', tagId);
                              console.log(`[AI Automation Trigger] 🏷️     ✓ Removed trigger tag: ${tagId}`);
                            }
                          }
                        }
                      }
                      
                      shouldStopDueToReply = true;
                    } else {
                      console.log(`[AI Automation Trigger] ✅ Live check OK - User inactive (${minutesSinceUserMessage} min ago)`);
                    }
                  }
                }
              } catch (fbError) {
                console.log(`[AI Automation Trigger] ⚠️  Facebook fetch error:`, fbError instanceof Error ? fbError.message : 'Unknown');
              }
            }
            
            if (shouldStopDueToReply) {
              continue; // Skip this contact
            }

            // Create monitoring state entry - QUEUED
            // 🔧 FIX: Delete old state records for this contact to prevent duplicates
            try {
              // First, delete any existing state records for this conversation + rule
              await supabase
                .from('ai_automation_contact_states')
                .delete()
                .eq('rule_id', rule.id)
                .eq('conversation_id', conv.id);

              // Now insert fresh state record
              const { data: stateRecord, error: stateError } = await supabase
                .from('ai_automation_contact_states')
                .insert({
                  rule_id: rule.id,
                  conversation_id: conv.id,
                  sender_id: conv.sender_id,
                  sender_name: conv.sender_name || 'Customer',
                  current_stage: 'queued',
                  status_message: 'Added to processing queue',
                  max_follow_ups: rule.max_follow_ups || 0,
                  follow_up_count: followUpCountMap.get(conv.id) || 0
                })
                .select()
                .single();

              if (!stateError && stateRecord?.id) {
                stateIdMap.set(conv.id, stateRecord.id);
              } else if (stateError) {
                console.warn('[Monitor] Could not create state entry:', stateError);
              }
            } catch (stateErr) {
              console.warn('[Monitor] Could not create state entry:', stateErr);
            }

            // Get page access token
            const { data: page } = await supabase
              .from('facebook_pages')
              .select('id, facebook_page_id, access_token, name')
              .eq('facebook_page_id', conv.page_id)
              .single();

            if (!page) {
              console.error(`[AI Automation Trigger] No page found for conversation ${conv.id}`);
              // Update monitoring state - FAILED
              const stateId = stateIdMap.get(conv.id);
              if (stateId) {
                await supabase
                  .from('ai_automation_contact_states')
                  .update({
                    current_stage: 'failed',
                    status_message: 'Page not found',
                    error_message: 'Facebook page configuration missing'
                  })
                  .eq('id', stateId);
              }
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
            
            // Enhance prompt with anti-repetition (concise to save tokens)
            let enhancedPrompt = rule.custom_prompt;
            if (previousMessages.length > 0) {
              // Only show last 2 messages, truncated to 100 chars each
              const recentPrevious = previousMessages.slice(0, 2);
              enhancedPrompt += `\n\nFollow-up #${currentFollowUpNumber}. Previous messages (be different):\n`;
              recentPrevious.forEach((msg, i) => {
                const truncated = msg.length > 100 ? msg.substring(0, 100) + '...' : msg;
                enhancedPrompt += `${i + 1}. "${truncated}"\n`;
              });
              enhancedPrompt += `Use different greeting & approach.`;
            } else {
              enhancedPrompt += `\n\nFollow-up #${currentFollowUpNumber} (first message)`;
            }

            // Update monitoring state - GENERATING
            const generationStartTime = Date.now();
            const stateId = stateIdMap.get(conv.id);
            if (stateId) {
              await supabase
                .from('ai_automation_contact_states')
                .update({
                  current_stage: 'generating',
                  status_message: `AI generating follow-up #${currentFollowUpNumber}...`,
                  last_stage_change_at: new Date().toISOString()
                })
                .eq('id', stateId);
            }

            // Generate AI message
            console.log(`[AI Automation Trigger] Generating follow-up #${currentFollowUpNumber} for ${conv.sender_name}... (${previousMessages.length} previous)`);
            const generated = await openRouterService.generateFollowUpMessage(
              context,
              enhancedPrompt
            );

            const generationTimeMs = Date.now() - generationStartTime;

            // Update monitoring state - READY TO SEND
            if (stateId) {
              await supabase
                .from('ai_automation_contact_states')
                .update({
                  current_stage: 'ready_to_send',
                  status_message: 'Message generated, preparing to send',
                  generated_message: generated.generatedMessage,
                  generation_time_ms: generationTimeMs,
                  last_stage_change_at: new Date().toISOString()
                })
                .eq('id', stateId);
            }

            // Create message record for sending
            const { data: message, error: messageError } = await supabase
              .from('messages')
              .insert({
                title: `AI Auto: ${rule.name} - ${conv.sender_name || 'Follow-up'}`,
                created_by: userId,
                page_id: page.id,
                content: generated.generatedMessage,
                status: 'scheduled',
                recipient_type: 'selected',
                selected_recipients: [conv.sender_id],
                recipient_count: 1,
                message_tag: rule.message_tag || 'ACCOUNT_UPDATE',
                scheduled_for: new Date().toISOString() // Send immediately
              })
              .select()
              .single();

            if (messageError) {
              console.error(`[AI Automation Trigger] Error creating message:`, messageError);
              // Update monitoring state - FAILED
              if (stateId) {
                await supabase
                  .from('ai_automation_contact_states')
                  .update({
                    current_stage: 'failed',
                    status_message: 'Failed to create message record',
                    error_message: messageError.message || 'Database error'
                  })
                  .eq('id', stateId);
              }
              ruleResult.errors.push({
                conversation_id: conv.id,
                error: 'Failed to create message'
              });
              continue;
            }

            // Update monitoring state - SENDING
            if (stateId) {
              await supabase
                .from('ai_automation_contact_states')
                .update({
                  current_stage: 'sending',
                  status_message: 'Sending via Facebook API...',
                  last_stage_change_at: new Date().toISOString()
                })
                .eq('id', stateId);
            }

            // Send immediately via Facebook API
            const messageTag = rule.message_tag || 'ACCOUNT_UPDATE';
            console.log(`[AI Automation Trigger] Sending message with tag: ${messageTag} to ${conv.sender_name}`);
            
            const sendResponse = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${page.access_token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { id: conv.sender_id },
                message: { text: generated.generatedMessage },
                messaging_type: 'MESSAGE_TAG',
                tag: messageTag
              })
            });

            const sendData = await sendResponse.json();

            if (sendResponse.ok) {
              // Update monitoring state - SENT
              if (stateId) {
                await supabase
                  .from('ai_automation_contact_states')
                  .update({
                    current_stage: 'sent',
                    status_message: 'Successfully delivered',
                    last_stage_change_at: new Date().toISOString()
                  })
                  .eq('id', stateId);
              }

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

              // Mark as completed if this was the last follow-up
              if (rule.max_follow_ups && currentFollowUpNumber >= rule.max_follow_ups) {
                if (stateId) {
                  await supabase
                    .from('ai_automation_contact_states')
                    .update({
                      current_stage: 'completed',
                      status_message: `All ${rule.max_follow_ups} follow-ups sent`,
                      last_stage_change_at: new Date().toISOString()
                    })
                    .eq('id', stateId);
                }
              }

              console.log(`[AI Automation Trigger] ✅ Sent message to ${conv.sender_name}`);
            } else {
              // Update monitoring state - FAILED
              if (stateId) {
                await supabase
                  .from('ai_automation_contact_states')
                  .update({
                    current_stage: 'failed',
                    status_message: 'Failed to send via Facebook',
                    error_message: sendData.error?.message || 'Unknown Facebook API error',
                    last_stage_change_at: new Date().toISOString()
                  })
                  .eq('id', stateId);
              }

              console.error(`[AI Automation Trigger] Facebook API error:`, sendData);
              ruleResult.errors.push({
                conversation_id: conv.id,
                error: sendData.error?.message || 'Failed to send'
              });
            }

          } catch (convError) {
            console.error(`[AI Automation Trigger] Error processing conversation ${conv.id}:`, convError);
            
            // Update monitoring state - FAILED
            const stateId = stateIdMap.get(conv.id);
            if (stateId) {
              await supabase
                .from('ai_automation_contact_states')
                .update({
                  current_stage: 'failed',
                  status_message: 'Unexpected error during processing',
                  error_message: convError instanceof Error ? convError.message : 'Unknown error',
                  last_stage_change_at: new Date().toISOString()
                })
                .eq('id', stateId);
            }

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

