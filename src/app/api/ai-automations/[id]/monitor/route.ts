import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Real-time monitoring endpoint for AI automation
 * GET /api/ai-automations/[id]/monitor
 * 
 * Returns live status of contacts being processed by this automation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('fb-user-id')?.value;
        const { id: ruleId } = await params;

        if (!userId) {
          controller.enqueue(encoder.encode('data: {"error":"Not authenticated"}\n\n'));
          controller.close();
          return;
        }

        const supabase = await createClient();

        // Verify rule belongs to user
        const { data: rule, error: ruleError } = await supabase
          .from('ai_automation_rules')
          .select('id, name, enabled')
          .eq('id', ruleId)
          .eq('user_id', userId)
          .single();

        if (ruleError || !rule) {
          controller.enqueue(encoder.encode('data: {"error":"Rule not found"}\n\n'));
          controller.close();
          return;
        }

        // Send initial status
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'init',
          rule: rule
        })}\n\n`));

        // Stream updates every 2 seconds for 60 seconds max
        const maxDuration = 60000; // 60 seconds
        const interval = 2000; // 2 seconds
        const startTime = Date.now();

        const sendUpdate = async () => {
          try {
            // Get active contacts (being processed)
            const { data: activeContacts, error: contactsError } = await supabase
              .from('active_automation_contacts')
              .select('*')
              .eq('rule_id', ruleId)
              .order('updated_at', { ascending: false })
              .limit(100);

            // Get eligible contacts (have matching tags)
            const { data: eligibleContacts, error: eligibleError } = await supabase
              .from('automation_eligible_contacts')
              .select('*')
              .eq('rule_id', ruleId)
              .order('last_message_time', { ascending: false })
              .limit(100);

            // Get monitor summary (combined stats)
            const { data: monitorSummary } = await supabase
              .from('automation_monitor_summary')
              .select('*')
              .eq('rule_id', ruleId)
              .single();

            // Check if monitoring tables don't exist (PGRST205 = relation not found)
            if (contactsError && contactsError.code === 'PGRST205') {
              console.warn('[Monitor] Monitoring tables not set up. Run fix-ai-automation-monitoring.sql');
              const setupUpdate = {
                type: 'update',
                timestamp: new Date().toISOString(),
                monitoring_disabled: true,
                message: 'Live monitoring not set up. Run fix-ai-automation-monitoring.sql in Supabase.',
                activeContacts: [],
                eligibleContacts: [],
                stageSummary: [],
                stats: { total: 0, byStage: {}, eligible: 0, withTags: 0 }
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(setupUpdate)}\n\n`));
              return;
            }

            if (contactsError) {
              console.error('[Monitor] Error fetching active contacts:', contactsError);
              return;
            }

            if (eligibleError && eligibleError.code !== 'PGRST116') { // PGRST116 = no rows returned
              console.error('[Monitor] Error fetching eligible contacts:', eligibleError);
            }

            // Get stage summary - handle missing function gracefully
            const { data: stageSummary, error: summaryError } = await supabase
              .rpc('get_automation_stage_summary', { p_rule_id: ruleId });

            if (summaryError && summaryError.code === 'PGRST205') {
              console.warn('[Monitor] Monitoring functions not set up.');
            } else if (summaryError) {
              console.error('[Monitor] Error fetching summary:', summaryError);
            }

            // Send update with BOTH active and eligible contacts
            const update = {
              type: 'update',
              timestamp: new Date().toISOString(),
              // Active contacts (currently being processed)
              activeContacts: activeContacts || [],
              // Eligible contacts (have matching tags)
              eligibleContacts: eligibleContacts || [],
              stageSummary: stageSummary || [],
              stats: {
                // Active processing count
                active: activeContacts?.length || 0,
                // Eligible contacts with tags
                eligible: monitorSummary?.eligible_count || 0,
                // Total with matching tags
                withTags: monitorSummary?.total_with_tags || 0,
                // Recently sent
                recentlySent: monitorSummary?.recently_sent_count || 0,
                // Stopped
                stopped: monitorSummary?.stopped_count || 0,
                // Stage breakdown
                byStage: (stageSummary || []).reduce((acc: Record<string, number>, s: { stage: string; count: number }) => {
                  acc[s.stage] = s.count;
                  return acc;
                }, {} as Record<string, number>),
                // Detailed counts from summary
                queued: monitorSummary?.queued_count || 0,
                generating: monitorSummary?.generating_count || 0,
                sending: monitorSummary?.sending_count || 0,
                sentToday: monitorSummary?.sent_today_count || 0,
                failed: monitorSummary?.failed_count || 0
              }
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));

          } catch (error) {
            console.error('[Monitor] Error in sendUpdate:', error);
          }
        };

        // Send first update immediately
        await sendUpdate();

        // Set up interval for updates
        const intervalId = setInterval(async () => {
          if (Date.now() - startTime > maxDuration) {
            clearInterval(intervalId);
            controller.enqueue(encoder.encode('data: {"type":"complete"}\n\n'));
            controller.close();
            return;
          }
          await sendUpdate();
        }, interval);

        // Clean up on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
          controller.close();
        });

      } catch (error) {
        console.error('[Monitor] Error:', error);
        controller.enqueue(encoder.encode(`data: {"error":"${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`));
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}

/**
 * Get snapshot of current automation state (non-streaming)
 * Useful for initial load or polling
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;
    const { id: ruleId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Verify rule belongs to user
    const { data: rule, error: ruleError } = await supabase
      .from('ai_automation_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('user_id', userId)
      .single();

    if (ruleError || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Get active contacts (being processed)
    const { data: activeContacts, error: contactsError } = await supabase
      .from('active_automation_contacts')
      .select('*')
      .eq('rule_id', ruleId)
      .order('updated_at', { ascending: false })
      .limit(100);

    // Get eligible contacts (have matching tags)
    const { data: eligibleContacts, error: eligibleError } = await supabase
      .from('automation_eligible_contacts')
      .select('*')
      .eq('rule_id', ruleId)
      .order('last_message_time', { ascending: false })
      .limit(100);

    // Get monitor summary (combined stats)
    const { data: monitorSummary } = await supabase
      .from('automation_monitor_summary')
      .select('*')
      .eq('rule_id', ruleId)
      .single();

    // Check if monitoring tables don't exist
    if (contactsError && contactsError.code === 'PGRST205') {
      return NextResponse.json({
        rule,
        monitoring_disabled: true,
        message: 'Live monitoring not set up. Run fix-monitoring-data-alignment.sql in Supabase SQL Editor.',
        activeContacts: [],
        eligibleContacts: [],
        stageSummary: [],
        stats: { active: 0, eligible: 0, withTags: 0 }
      });
    }

    if (contactsError) {
      return NextResponse.json({
        error: 'Failed to fetch contacts',
        details: contactsError.message
      }, { status: 500 });
    }

    if (eligibleError && eligibleError.code !== 'PGRST116') {
      console.error('[Monitor] Error fetching eligible contacts:', eligibleError);
    }

    // Get stage summary
    const { data: stageSummary } = await supabase
      .rpc('get_automation_stage_summary', { p_rule_id: ruleId });

    return NextResponse.json({
      rule,
      // Active contacts (currently being processed)
      activeContacts: activeContacts || [],
      // Eligible contacts (have matching tags)
      eligibleContacts: eligibleContacts || [],
      stageSummary: stageSummary || [],
      stats: {
        // Active processing count
        active: activeContacts?.length || 0,
        // Eligible contacts with tags
        eligible: monitorSummary?.eligible_count || 0,
        // Total with matching tags
        withTags: monitorSummary?.total_with_tags || 0,
        // Recently sent
        recentlySent: monitorSummary?.recently_sent_count || 0,
        // Stopped
        stopped: monitorSummary?.stopped_count || 0,
        // Stage breakdown
        byStage: (stageSummary || []).reduce((acc: Record<string, number>, s: { stage: string; count: number }) => {
          acc[s.stage] = s.count;
          return acc;
        }, {} as Record<string, number>),
        // Detailed counts from summary
        queued: monitorSummary?.queued_count || 0,
        generating: monitorSummary?.generating_count || 0,
        sending: monitorSummary?.sending_count || 0,
        sentToday: monitorSummary?.sent_today_count || 0,
        failed: monitorSummary?.failed_count || 0
      }
    });

  } catch (error) {
    console.error('[Monitor] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



