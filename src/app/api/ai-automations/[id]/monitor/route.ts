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
            // Get active contacts - handle missing table gracefully
            const { data: activeContacts, error: contactsError } = await supabase
              .from('active_automation_contacts')
              .select('*')
              .eq('rule_id', ruleId)
              .order('updated_at', { ascending: false })
              .limit(100);

            // Check if monitoring tables don't exist (PGRST205 = relation not found)
            if (contactsError && contactsError.code === 'PGRST205') {
              console.warn('[Monitor] Monitoring tables not set up. Run fix-ai-automation-monitoring.sql');
              const setupUpdate = {
                type: 'update',
                timestamp: new Date().toISOString(),
                monitoring_disabled: true,
                message: 'Live monitoring not set up. Run fix-ai-automation-monitoring.sql in Supabase.',
                contacts: [],
                stageSummary: [],
                stats: { total: 0, byStage: {} }
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(setupUpdate)}\n\n`));
              return;
            }

            if (contactsError) {
              console.error('[Monitor] Error fetching contacts:', contactsError);
              return;
            }

            // Get stage summary - handle missing function gracefully
            const { data: stageSummary, error: summaryError } = await supabase
              .rpc('get_automation_stage_summary', { p_rule_id: ruleId });

            if (summaryError && summaryError.code === 'PGRST205') {
              console.warn('[Monitor] Monitoring functions not set up.');
            } else if (summaryError) {
              console.error('[Monitor] Error fetching summary:', summaryError);
            }

            // Send update
            const update = {
              type: 'update',
              timestamp: new Date().toISOString(),
              contacts: activeContacts || [],
              stageSummary: stageSummary || [],
              stats: {
                total: activeContacts?.length || 0,
                byStage: (stageSummary || []).reduce((acc: any, s: any) => {
                  acc[s.stage] = s.count;
                  return acc;
                }, {})
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

    // Get active contacts - handle missing table gracefully
    const { data: activeContacts, error: contactsError } = await supabase
      .from('active_automation_contacts')
      .select('*')
      .eq('rule_id', ruleId)
      .order('updated_at', { ascending: false })
      .limit(100);

    // Check if monitoring tables don't exist
    if (contactsError && contactsError.code === 'PGRST205') {
      return NextResponse.json({
        rule,
        monitoring_disabled: true,
        message: 'Live monitoring not set up. Run fix-ai-automation-monitoring.sql in Supabase SQL Editor.',
        contacts: [],
        stageSummary: [],
        liveStats: null
      });
    }

    // Get stage summary
    const { data: stageSummary } = await supabase
      .rpc('get_automation_stage_summary', { p_rule_id: ruleId });

    // Get live stats
    const { data: liveStats } = await supabase
      .from('automation_live_stats')
      .select('*')
      .eq('rule_id', ruleId)
      .single();

    return NextResponse.json({
      rule,
      contacts: activeContacts || [],
      stageSummary: stageSummary || [],
      liveStats: liveStats || null
    });

  } catch (error) {
    console.error('[Monitor] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



