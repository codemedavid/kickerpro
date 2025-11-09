import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { refreshExpiringTokens } from '@/lib/facebook/token-refresh';

/**
 * Cron job to automatically refresh Facebook tokens before they expire
 * GET /api/cron/refresh-tokens
 * 
 * Runs daily to check and refresh tokens that are expiring in < 7 days
 * 
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/refresh-tokens",
 *     "schedule": "0 0 * * *"  // Daily at midnight
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    console.log('='.repeat(80));
    console.log('[Token Refresh Cron] 🔄 Starting automatic token refresh...');
    console.log('[Token Refresh Cron] Time:', new Date().toISOString());
    console.log('='.repeat(80));

    // Verify cron secret (optional security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Token Refresh Cron] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      console.error('[Token Refresh Cron] Missing Supabase configuration');
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Refresh expiring tokens
    const stats = await refreshExpiringTokens(supabase);

    console.log('='.repeat(80));
    console.log('[Token Refresh Cron] ✅ Completed');
    console.log('[Token Refresh Cron] Summary:', stats);
    console.log('='.repeat(80));

    return NextResponse.json({
      success: true,
      stats,
      message: 'Token refresh completed'
    });

  } catch (error) {
    console.error('[Token Refresh Cron] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Token refresh failed'
      },
      { status: 500 }
    );
  }
}

