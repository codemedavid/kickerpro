import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Auto-Cleanup Monitoring States Cron
 * GET /api/cron/cleanup-monitoring
 * 
 * Runs every hour to clean up old/stale monitoring state records
 * - Removes completed/failed states older than 24 hours
 * - Removes stuck processing states older than 1 hour
 * 
 * Configured in vercel.json to run every hour
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cleanup Monitoring Cron] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('='.repeat(80));
    console.log('[Cleanup Monitoring Cron] 🧹 Starting monitoring states cleanup');
    console.log('='.repeat(80));

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      console.error('[Cleanup Monitoring Cron] Missing Supabase configuration');
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get count before cleanup
    const { count: beforeCount } = await supabase
      .from('ai_automation_contact_states')
      .select('*', { count: 'exact', head: true });

    console.log(`[Cleanup Monitoring Cron] Total records before cleanup: ${beforeCount || 0}`);

    // Cleanup 1: Delete completed/failed/sent states older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { error: cleanupCompletedError, count: deletedCompleted } = await supabase
      .from('ai_automation_contact_states')
      .delete({ count: 'exact' })
      .in('current_stage', ['completed', 'failed', 'sent'])
      .lt('updated_at', oneDayAgo);

    if (cleanupCompletedError) {
      console.error('[Cleanup Monitoring Cron] Error cleaning completed states:', cleanupCompletedError);
    } else {
      console.log(`[Cleanup Monitoring Cron] 🗑️  Deleted ${deletedCompleted || 0} old completed/failed/sent records`);
    }

    // Cleanup 2: Delete stuck processing states older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { error: cleanupStuckError, count: deletedStuck } = await supabase
      .from('ai_automation_contact_states')
      .delete({ count: 'exact' })
      .in('current_stage', ['queued', 'generating', 'sending', 'processing', 'ready_to_send', 'checking', 'eligible'])
      .lt('updated_at', oneHourAgo);

    if (cleanupStuckError) {
      console.error('[Cleanup Monitoring Cron] Error cleaning stuck states:', cleanupStuckError);
    } else {
      console.log(`[Cleanup Monitoring Cron] 🗑️  Deleted ${deletedStuck || 0} stuck processing records`);
    }

    // Get count after cleanup
    const { count: afterCount } = await supabase
      .from('ai_automation_contact_states')
      .select('*', { count: 'exact', head: true });

    console.log(`[Cleanup Monitoring Cron] Total records after cleanup: ${afterCount || 0}`);

    // Get breakdown by stage
    const { data: breakdown } = await supabase
      .from('ai_automation_contact_states')
      .select('current_stage')
      .order('current_stage');

    const stageCount: Record<string, number> = {};
    breakdown?.forEach(record => {
      stageCount[record.current_stage] = (stageCount[record.current_stage] || 0) + 1;
    });

    console.log('[Cleanup Monitoring Cron] Remaining records by stage:', stageCount);

    console.log('='.repeat(80));
    console.log('[Cleanup Monitoring Cron] ✅ Cleanup completed');
    console.log(`  Before: ${beforeCount || 0}`);
    console.log(`  Deleted: ${(deletedCompleted || 0) + (deletedStuck || 0)}`);
    console.log(`  After: ${afterCount || 0}`);
    console.log('='.repeat(80));

    return NextResponse.json({
      success: true,
      message: 'Monitoring states cleanup completed',
      before_count: beforeCount || 0,
      deleted_completed: deletedCompleted || 0,
      deleted_stuck: deletedStuck || 0,
      after_count: afterCount || 0,
      remaining_by_stage: stageCount
    });

  } catch (error) {
    console.error('[Cleanup Monitoring Cron] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

