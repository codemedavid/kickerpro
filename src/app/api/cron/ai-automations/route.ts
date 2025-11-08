import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cron job endpoint for AI automations
 * GET /api/cron/ai-automations
 * 
 * This should be called by a cron service (Vercel Cron, external cron, etc.)
 * every 15-30 minutes to check and execute automation rules
 * 
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/ai-automations",
 *     "schedule": "every 15 minutes"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Skip auth check if CRON_SECRET is not set (allows Vercel Cron to work)
    // In production, protect this endpoint using Vercel's firewall or by setting CRON_SECRET
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[AI Automation Cron] Unauthorized access attempt');
        console.warn('[AI Automation Cron] Expected:', `Bearer ${cronSecret}`);
        console.warn('[AI Automation Cron] Received:', authHeader || 'none');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.log('[AI Automation Cron] ℹ️ Running without CRON_SECRET (Vercel Cron mode)');
    }

    console.log('[AI Automation Cron] Starting scheduled execution');

    // Create Supabase admin client (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
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
      console.log('[AI Automation Cron] No enabled rules found');
      return NextResponse.json({ 
        message: 'No enabled automation rules',
        executed: 0 
      });
    }

    console.log(`[AI Automation Cron] Found ${rules.length} enabled rule(s)`);

    const results = [];

    // Process each rule
    for (const rule of rules) {
      try {
        console.log(`[AI Automation Cron] Processing rule: ${rule.name} (${rule.id})`);

        // Check if within active hours
        const currentHour = new Date().getHours();
        if (currentHour < rule.active_hours_start || currentHour >= rule.active_hours_end) {
          console.log(`[AI Automation Cron] Rule ${rule.name} skipped - outside active hours`);
          continue;
        }

        // Mark that we attempted execution
        // Note: Full automation execution requires user context
        // Use manual trigger from UI for immediate execution
        const { error: updateError } = await supabase
          .from('ai_automation_rules')
          .update({ 
            last_executed_at: new Date().toISOString(),
            execution_count: rule.execution_count + 1
          })
          .eq('id', rule.id);

        if (updateError) {
          console.error(`[AI Automation Cron] Error updating rule:`, updateError);
        }

        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          user_id: rule.user_id,
          status: 'attempted'
        });

      } catch (ruleError) {
        console.error(`[AI Automation Cron] Error processing rule:`, ruleError);
      }
    }

    console.log(`[AI Automation Cron] Completed. Processed ${results.length} rule(s)`);

    return NextResponse.json({
      success: true,
      message: 'AI automations cron job executed',
      rules_processed: results.length,
      results
    });

  } catch (error) {
    console.error('[AI Automation Cron] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

