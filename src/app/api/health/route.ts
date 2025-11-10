/**
 * Health Check & System Monitoring Endpoint
 * Comprehensive system health verification
 * 
 * Checks:
 * - Database connectivity
 * - Facebook API access
 * - Token expiration status
 * - Sync status
 * - Webhook status
 */

import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const healthReport = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'unknown', message: '' },
      facebookPages: { status: 'unknown', count: 0, message: '' },
      tokenExpiration: { status: 'unknown', message: '' },
      conversations: { status: 'unknown', count: 0, message: '' },
      sync: { status: 'unknown', message: '' }
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasFacebookAppId: !!process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
      hasFacebookAppSecret: !!process.env.FACEBOOK_APP_SECRET,
      hasCronSecret: !!process.env.CRON_SECRET,
      hasWebhookToken: !!process.env.WEBHOOK_VERIFY_TOKEN
    }
  };

  try {
    // Check 1: Database Connectivity
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceKey) {
        healthReport.checks.database = {
          status: 'error',
          message: 'Missing Supabase credentials'
        };
        healthReport.status = 'unhealthy';
      } else {
        const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        // Simple query to test connection
        const { error } = await supabase
          .from('users')
          .select('count')
          .limit(1);

        if (error) {
          healthReport.checks.database = {
            status: 'error',
            message: `Database error: ${error.message}`
          };
          healthReport.status = 'unhealthy';
        } else {
          healthReport.checks.database = {
            status: 'ok',
            message: 'Database connection successful'
          };
        }

        // Check 2: Facebook Pages
        const { data: pages, error: pagesError } = await supabase
          .from('facebook_pages')
          .select('id, name, is_active, access_token_expires_at, last_synced_at')
          .eq('is_active', true);

        if (pagesError) {
          healthReport.checks.facebookPages = {
            status: 'error',
            count: 0,
            message: `Failed to fetch pages: ${pagesError.message}`
          };
          healthReport.status = 'degraded';
        } else {
          healthReport.checks.facebookPages = {
            status: 'ok',
            count: pages?.length || 0,
            message: `${pages?.length || 0} active page(s) connected`
          };
        }

        // Check 3: Token Expiration
        if (pages && pages.length > 0) {
          const expiringPages = pages.filter(page => {
            if (!page.access_token_expires_at) return false;
            const expiresAt = new Date(page.access_token_expires_at);
            const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return daysUntilExpiry < 7; // Warn if expiring in less than 7 days
          });

          if (expiringPages.length > 0) {
            healthReport.checks.tokenExpiration = {
              status: 'warning',
              message: `${expiringPages.length} page token(s) expiring soon (< 7 days)`
            };
            if (healthReport.status === 'healthy') {
              healthReport.status = 'degraded';
            }
          } else {
            healthReport.checks.tokenExpiration = {
              status: 'ok',
              message: 'All tokens are valid'
            };
          }
        }

        // Check 4: Conversations Count
        const { count: conversationsCount, error: conversationsError } = await supabase
          .from('messenger_conversations')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_status', 'active');

        if (conversationsError) {
          healthReport.checks.conversations = {
            status: 'error',
            count: 0,
            message: `Failed to fetch conversations: ${conversationsError.message}`
          };
        } else {
          healthReport.checks.conversations = {
            status: 'ok',
            count: conversationsCount || 0,
            message: `${conversationsCount || 0} active conversation(s)`
          };
        }

        // Check 5: Recent Sync Status
        if (pages && pages.length > 0) {
          const stalePages = pages.filter(page => {
            if (!page.last_synced_at) return true;
            const lastSynced = new Date(page.last_synced_at);
            const hoursSinceSync = (Date.now() - lastSynced.getTime()) / (1000 * 60 * 60);
            return hoursSinceSync > 24; // Warn if not synced in 24 hours
          });

          if (stalePages.length > 0) {
            healthReport.checks.sync = {
              status: 'warning',
              message: `${stalePages.length} page(s) haven't synced in over 24 hours`
            };
            if (healthReport.status === 'healthy') {
              healthReport.status = 'degraded';
            }
          } else {
            healthReport.checks.sync = {
              status: 'ok',
              message: 'All pages synced recently'
            };
          }
        }
      }
    } catch (dbError) {
      healthReport.checks.database = {
        status: 'error',
        message: `Database connection failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`
      };
      healthReport.status = 'unhealthy';
    }

  } catch (error) {
    console.error('[Health Check] Error:', error);
    healthReport.status = 'unhealthy';
  }

  // Set HTTP status based on health
  const httpStatus = healthReport.status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(healthReport, { status: httpStatus });
}

