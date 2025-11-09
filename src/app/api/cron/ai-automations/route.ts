import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { openRouterService } from '@/lib/ai/openrouter';

/**
 * Cron job endpoint for AI automations
 * GET /api/cron/ai-automations
 * 
 * This endpoint is called by Vercel Cron every 15 minutes
 * It executes ALL enabled automation rules across ALL users
 * 
 * Configured in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/ai-automations",
 *     "schedule": "every 15 minutes"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Skip auth check if CRON_SECRET is not set (allows Vercel Cron to work)
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[AI Automation Cron] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('='.repeat(80));
    console.log('[AI Automation Cron] 🚀 Starting scheduled execution at', new Date().toISOString());
    console.log('='.repeat(80));

    // Create Supabase admin client (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      console.error('[AI Automation Cron] Missing Supabase configuration');
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
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

    // Get all enabled automation rules
    const { data: rules, error: rulesError } = await supabase
      .from('ai_automation_rules')
      .select('*')
      .eq('enabled', true);

    if (rulesError) {
      console.error('[AI Automation Cron] Error fetching rules:', rulesError);
      return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
    }

    if (!rules || rules.length === 0) {
      console.log('[AI Automation Cron] ℹ️ No enabled rules found');
      return NextResponse.json({ 
        message: 'No enabled automation rules',
        executed: 0 
      });
    }

    console.log(`[AI Automation Cron] Found ${rules.length} enabled rule(s)`);

    const results = [];
    let totalMessagesProcessed = 0;
    let totalMessagesSent = 0;
    let totalMessagesFailed = 0;

    // Process each rule
    for (const rule of rules) {
      const ruleStartTime = Date.now();
      
      try {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`[AI Automation Cron] Processing rule: ${rule.name} (${rule.id})`);
        console.log(`  User: ${rule.user_id}`);
        console.log(`  Time Interval: ${rule.time_interval_minutes || rule.time_interval_hours * 60 || rule.time_interval_days * 1440} minutes`);
        console.log(`  Max Per Day: ${rule.max_messages_per_day}`);
        console.log(`  24/7 Mode: ${rule.run_24_7 ? 'YES' : 'NO'}`);
        console.log(`  Include Tags: ${rule.include_tag_ids && rule.include_tag_ids.length > 0 ? rule.include_tag_ids.join(', ') : 'NONE (all conversations)'}`);
        console.log(`  Exclude Tags: ${rule.exclude_tag_ids && rule.exclude_tag_ids.length > 0 ? rule.exclude_tag_ids.join(', ') : 'NONE'}`);

        // Check if within active hours (unless 24/7 mode)
        if (!rule.run_24_7) {
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          
          const startTimeInMinutes = rule.active_hours_start * 60 + (rule.active_hours_start_minutes || 0);
          const endTimeInMinutes = rule.active_hours_end * 60 + (rule.active_hours_end_minutes || 0);
          
          if (currentTimeInMinutes < startTimeInMinutes || currentTimeInMinutes >= endTimeInMinutes) {
            console.log(`  ⏰ Skipped - outside active hours (${rule.active_hours_start}:${String(rule.active_hours_start_minutes || 0).padStart(2, '0')}-${rule.active_hours_end}:${String(rule.active_hours_end_minutes || 0).padStart(2, '0')})`);
            results.push({
              rule_id: rule.id,
              rule_name: rule.name,
              user_id: rule.user_id,
              status: 'skipped',
              reason: 'Outside active hours'
            });
            continue;
          }
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
          console.log(`  🚫 Skipped - daily limit reached (${todayCount}/${rule.max_messages_per_day})`);
          results.push({
            rule_id: rule.id,
            rule_name: rule.name,
            user_id: rule.user_id,
            status: 'skipped',
            reason: 'Daily limit reached'
          });
          continue;
        }

        console.log(`  📊 Remaining quota: ${remainingQuota}/${rule.max_messages_per_day}`);

        // Calculate time threshold based on minutes, hours, or days
        const timeThreshold = new Date();
        let totalMinutes = 0;
        
        if (rule.time_interval_minutes) {
          totalMinutes = rule.time_interval_minutes;
        } else if (rule.time_interval_hours) {
          totalMinutes = rule.time_interval_hours * 60;
        } else if (rule.time_interval_days) {
          totalMinutes = rule.time_interval_days * 1440;
        } else {
          totalMinutes = 1440; // Default: 1 day
        }
        
        timeThreshold.setMinutes(timeThreshold.getMinutes() - totalMinutes);
        console.log(`  ⏱️  Looking for conversations inactive since: ${timeThreshold.toISOString()}`);

        // Get Facebook pages for this user
        const { data: pages, error: pagesError } = await supabase
          .from('facebook_pages')
          .select('*')
          .eq('user_id', rule.user_id);

        if (pagesError || !pages || pages.length === 0) {
          console.log(`  ⚠️  No Facebook pages found for user`);
          continue;
        }

        // Filter pages if rule has specific page_id
        const targetPages = rule.page_id 
          ? pages.filter(p => p.id === rule.page_id)
          : pages;

        if (targetPages.length === 0) {
          console.log(`  ⚠️  No matching pages found`);
          continue;
        }

        console.log(`  📱 Processing ${targetPages.length} page(s)`);

        // Process each page
        let ruleMessagesProcessed = 0;
        let ruleMessagesSent = 0;
        let ruleMessagesFailed = 0;

        for (const page of targetPages) {
          console.log(`    Page: ${page.page_name} (${page.page_id})`);

          // Build conversation query
          let conversationsQuery = supabase
            .from('messenger_conversations')
            .select('*')
            .eq('user_id', rule.user_id)
            .eq('page_id', page.id)
            .lte('last_message_time', timeThreshold.toISOString())
            .order('last_message_time', { ascending: false })
            .limit(remainingQuota);

          const { data: allConversations, error: convsError } = await conversationsQuery;

          if (convsError) {
            console.error(`    ❌ Error fetching conversations:`, convsError);
            continue;
          }

          if (!allConversations || allConversations.length === 0) {
            console.log(`    ℹ️  No conversations found for time threshold`);
            continue;
          }

          console.log(`    📊 Found ${allConversations.length} conversation(s) past time threshold`);

          // 🔒 STRICT TAG FILTERING - ONLY process conversations with matching tags
          let conversations = [];

          if (rule.include_tag_ids && rule.include_tag_ids.length > 0) {
            console.log(`    🏷️  REQUIRED TAGS: Filtering for conversations with tag IDs: ${rule.include_tag_ids.join(', ')}`);
            
            // Query conversation_tags table to get IDs of conversations with required tags
            const { data: taggedConvs } = await supabase
              .from('conversation_tags')
              .select('conversation_id')
              .in('tag_id', rule.include_tag_ids);

            if (taggedConvs && taggedConvs.length > 0) {
              const taggedIds = new Set(taggedConvs.map(t => t.conversation_id));
              
              // ONLY include conversations that have the required tags
              conversations = allConversations.filter(c => taggedIds.has(c.id));
              
              console.log(`    ✅ MATCHED ${conversations.length} out of ${allConversations.length} conversation(s) WITH required tags`);
              console.log(`    🚫 EXCLUDED ${allConversations.length - conversations.length} conversation(s) WITHOUT required tags`);
            } else {
              console.log(`    ⚠️  ZERO conversations have the required tags - skipping this page`);
              conversations = [];
            }
          } else {
            console.log(`    ⚠️  WARNING: No include tags specified - will process ALL conversations`);
            console.log(`    💡 TIP: Set include_tag_ids to only process specific tagged contacts`);
            conversations = allConversations;
          }

          if (rule.exclude_tag_ids && rule.exclude_tag_ids.length > 0 && conversations.length > 0) {
            // Query conversation_tags table to get IDs of conversations with excluded tags
            const { data: excludeTaggedConvs } = await supabase
              .from('conversation_tags')
              .select('conversation_id')
              .in('tag_id', rule.exclude_tag_ids);

            if (excludeTaggedConvs && excludeTaggedConvs.length > 0) {
              const excludeIds = new Set(excludeTaggedConvs.map(t => t.conversation_id));
              conversations = conversations.filter(c => !excludeIds.has(c.id));
              console.log(`    🏷️  After EXCLUDE tags filter: ${conversations.length} conversation(s)`);
            }
          }

          if (conversations.length === 0) {
            console.log(`    ℹ️  No eligible conversations after tag filtering`);
            continue;
          }

          console.log(`    ✅ Final eligible conversations: ${conversations.length}`);

          // Process each conversation
          for (const conv of conversations) {
            if (ruleMessagesSent >= remainingQuota) {
              console.log(`    🛑 Stopping - daily quota reached`);
              break;
            }

            try {
              ruleMessagesProcessed++;
              console.log(`      Processing: ${conv.sender_name || conv.sender_id}`);

              // 🔒 SAFETY CHECK: Verify contact has required tag before processing
              if (rule.include_tag_ids && rule.include_tag_ids.length > 0) {
                const { data: contactTags } = await supabase
                  .from('conversation_tags')
                  .select('tag_id')
                  .eq('conversation_id', conv.id)
                  .in('tag_id', rule.include_tag_ids);

                if (!contactTags || contactTags.length === 0) {
                  console.log(`      🚫 BLOCKED - Contact does NOT have required tag(s), skipping`);
                  continue;
                }
                
                console.log(`      ✅ VERIFIED - Contact has required tag(s)`);
              }

              // Check if automation has been stopped for this conversation
              const { data: stoppedAutomation } = await supabase
                .from('ai_automation_stops')
                .select('id, stopped_reason')
                .eq('rule_id', rule.id)
                .eq('conversation_id', conv.id)
                .single();

              if (stoppedAutomation) {
                console.log(`      🛑 Skipped - automation stopped (reason: ${stoppedAutomation.stopped_reason})`);
                continue;
              }

              // Check if the LAST execution was MORE than the time interval ago
              // This ensures we re-process contacts every time the interval finishes
              const { data: lastExecution } = await supabase
                .from('ai_automation_executions')
                .select('id, created_at, status')
                .eq('rule_id', rule.id)
                .eq('conversation_id', conv.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (lastExecution) {
                const timeSinceLastExecution = Date.now() - new Date(lastExecution.created_at).getTime();
                const minutesSinceLastExecution = Math.floor(timeSinceLastExecution / 60000);
                const cooldownMs = totalMinutes * 60 * 1000;

                // If last execution was LESS than the interval time, skip (cooldown period)
                if (timeSinceLastExecution < cooldownMs) {
                  console.log(`      ⏭️  Skipped - last processed ${minutesSinceLastExecution} minutes ago (interval: ${totalMinutes} minutes, needs ${totalMinutes - minutesSinceLastExecution} more minutes)`);
                  continue;
                }
                
                // If last execution was MORE than the interval time ago, process it!
                console.log(`      ✅ Ready to process - last execution was ${minutesSinceLastExecution} minutes ago (interval: ${totalMinutes} minutes)`);
              } else {
                console.log(`      ✅ Ready to process - never processed before`);
              }

              // Create execution record
              const { data: execution, error: execError } = await supabase
                .from('ai_automation_executions')
                .insert({
                  rule_id: rule.id,
                  user_id: rule.user_id,
                  conversation_id: conv.id,
                  page_id: page.id,
                  status: 'processing'
                })
                .select()
                .single();

              if (execError || !execution) {
                console.error(`      ❌ Failed to create execution record:`, execError);
                ruleMessagesFailed++;
                continue;
              }

              // Fetch conversation messages for context
              const { data: messages } = await supabase
                .from('messenger_messages')
                .select('*')
                .eq('conversation_id', conv.id)
                .order('timestamp', { ascending: false })
                .limit(20);

              // Build context for AI (matching ConversationContext interface)
              const context = {
                conversationId: conv.id,
                participantName: conv.sender_name || 'Customer',
                messages: (messages || []).map(m => ({
                  from: m.from_user ? 'business' : 'user',
                  message: m.message_text || '',
                  timestamp: m.timestamp || new Date().toISOString()
                })),
                isFallback: !messages || messages.length === 0
              };

              // Get previous AI messages to ensure uniqueness
              const { data: previousMessages } = await supabase
                .from('ai_automation_executions')
                .select('generated_message')
                .eq('rule_id', rule.id)
                .eq('conversation_id', conv.id)
                .eq('status', 'sent')
                .not('generated_message', 'is', null)
                .order('created_at', { ascending: false })
                .limit(5);

              const previousMessageTexts = (previousMessages || [])
                .map(m => m.generated_message)
                .filter(Boolean);

              // Build enhanced prompt with uniqueness check
              let enhancedPrompt = rule.custom_prompt;
              
              if (previousMessageTexts.length > 0) {
                enhancedPrompt += `\n\n⚠️ CRITICAL - AVOID REPETITION:\n`;
                enhancedPrompt += `You previously sent these messages. Create something COMPLETELY DIFFERENT:\n`;
                previousMessageTexts.forEach((msg, idx) => {
                  enhancedPrompt += `${idx + 1}. "${msg}"\n`;
                });
                enhancedPrompt += `\nDO NOT use similar greetings, structure, or phrases. Be creative and unique!`;
              }

              // Generate AI message
              console.log(`      🤖 Generating AI message...`);
              const generated = await openRouterService.generateFollowUpMessage(
                context,
                enhancedPrompt
              );

              if (!generated || !generated.generatedMessage) {
                console.error(`      ❌ Failed to generate message`);
                await supabase
                  .from('ai_automation_executions')
                  .update({
                    status: 'failed',
                    error_message: 'AI generation failed',
                    executed_at: new Date().toISOString()
                  })
                  .eq('id', execution.id);
                ruleMessagesFailed++;
                continue;
              }

              // Update execution with generated message
              await supabase
                .from('ai_automation_executions')
                .update({
                  generated_message: generated.generatedMessage,
                  ai_reasoning: generated.reasoning,
                  previous_messages_shown: previousMessageTexts
                })
                .eq('id', execution.id);

              // Send message via Facebook API
              const messageTag = rule.message_tag || 'ACCOUNT_UPDATE';
              const sendUrl = `https://graph.facebook.com/v18.0/me/messages?access_token=${page.access_token}`;
              
              const sendResponse = await fetch(sendUrl, {
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

              if (sendResponse.ok && sendData.message_id) {
                // Success!
                console.log(`      ✅ Message sent successfully (ID: ${sendData.message_id})`);
                
                await supabase
                  .from('ai_automation_executions')
                  .update({
                    status: 'sent',
                    facebook_message_id: sendData.message_id,
                    executed_at: new Date().toISOString()
                  })
                  .eq('id', execution.id);

                ruleMessagesSent++;
                totalMessagesSent++;
              } else {
                // Failed to send
                console.error(`      ❌ Failed to send message:`, sendData.error || sendData);
                
                await supabase
                  .from('ai_automation_executions')
                  .update({
                    status: 'failed',
                    error_message: JSON.stringify(sendData.error || sendData),
                    executed_at: new Date().toISOString()
                  })
                  .eq('id', execution.id);

                ruleMessagesFailed++;
              }

            } catch (convError) {
              console.error(`      ❌ Error processing conversation:`, convError);
              ruleMessagesFailed++;
              totalMessagesFailed++;
            }
          }
        }

        // Update rule statistics
        await supabase
          .from('ai_automation_rules')
          .update({ 
            last_executed_at: new Date().toISOString(),
            execution_count: (rule.execution_count || 0) + 1,
            success_count: (rule.success_count || 0) + ruleMessagesSent,
            failure_count: (rule.failure_count || 0) + ruleMessagesFailed
          })
          .eq('id', rule.id);

        totalMessagesProcessed += ruleMessagesProcessed;

        const ruleTimeMs = Date.now() - ruleStartTime;
        console.log(`  ⏱️  Rule completed in ${ruleTimeMs}ms`);
        console.log(`  📊 Results: ${ruleMessagesSent} sent, ${ruleMessagesFailed} failed`);

        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          user_id: rule.user_id,
          status: 'executed',
          messages_processed: ruleMessagesProcessed,
          messages_sent: ruleMessagesSent,
          messages_failed: ruleMessagesFailed,
          execution_time_ms: ruleTimeMs
        });

      } catch (ruleError) {
        console.error(`[AI Automation Cron] Error processing rule:`, ruleError);
        totalMessagesFailed++;
        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          user_id: rule.user_id,
          status: 'error',
          error: ruleError instanceof Error ? ruleError.message : 'Unknown error'
        });
      }
    }

    const totalTimeMs = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('[AI Automation Cron] ✅ Execution completed');
    console.log(`  Rules Processed: ${results.length}`);
    console.log(`  Messages Processed: ${totalMessagesProcessed}`);
    console.log(`  Messages Sent: ${totalMessagesSent}`);
    console.log(`  Messages Failed: ${totalMessagesFailed}`);
    console.log(`  Total Time: ${totalTimeMs}ms (${(totalTimeMs / 1000).toFixed(2)}s)`);
    console.log('='.repeat(80));

    return NextResponse.json({
      success: true,
      message: 'AI automations cron job executed',
      rules_processed: results.length,
      messages_processed: totalMessagesProcessed,
      messages_sent: totalMessagesSent,
      messages_failed: totalMessagesFailed,
      execution_time_ms: totalTimeMs,
      results
    });

  } catch (error) {
    const totalTimeMs = Date.now() - startTime;
    console.error('[AI Automation Cron] ❌ Unexpected error:', error);
    console.error('  Time before error:', totalTimeMs, 'ms');
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: totalTimeMs
      },
      { status: 500 }
    );
  }
}

