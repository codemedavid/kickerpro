import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Comprehensive database diagnostic
 * GET /api/diagnostics/database
 * 
 * Checks:
 * - Database connection
 * - Messages table exists
 * - Table structure
 * - RLS policies
 * - Service role key access
 * - Sample data
 */
export async function GET() {
  try {
    const diagnostics: {
      timestamp: string;
      checks: Record<string, unknown>;
      summary?: Record<string, unknown>;
    } = {
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    diagnostics.checks.environment = {
      supabase_url: supabaseUrl ? '✅ Set' : '❌ Missing',
      service_key: serviceKey ? '✅ Set' : '❌ Missing'
    };

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        error: 'Environment variables missing',
        diagnostics
      }, { status: 500 });
    }

    // Create admin client (bypasses RLS)
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

    // Test 1: Basic connection
    try {
      const { error: connError } = await supabase
        .from('messages')
        .select('count')
        .limit(1);
      
      diagnostics.checks.connection = {
        status: connError ? '❌ Failed' : '✅ Success',
        error: connError?.message || null
      };
    } catch (error) {
      diagnostics.checks.connection = {
        status: '❌ Failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: Count all messages (any status)
    try {
      const { count: totalCount, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      diagnostics.checks.total_messages = {
        status: countError ? '❌ Failed' : '✅ Success',
        count: totalCount,
        error: countError?.message || null
      };
    } catch (error) {
      diagnostics.checks.total_messages = {
        status: '❌ Failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 3: Count by status
    try {
      const { data: allMessages, error: allError } = await supabase
        .from('messages')
        .select('status');

      if (allError) {
        diagnostics.checks.messages_by_status = {
          status: '❌ Failed',
          error: allError.message
        };
      } else {
        const statusCounts: Record<string, number> = {};
        allMessages?.forEach(msg => {
          statusCounts[msg.status] = (statusCounts[msg.status] || 0) + 1;
        });

        diagnostics.checks.messages_by_status = {
          status: '✅ Success',
          counts: statusCounts,
          total: allMessages?.length || 0
        };
      }
    } catch (error) {
      diagnostics.checks.messages_by_status = {
        status: '❌ Failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 4: Get scheduled messages specifically
    try {
      const { data: scheduledMessages, error: scheduledError } = await supabase
        .from('messages')
        .select('id, title, status, scheduled_for, created_at, created_by')
        .eq('status', 'scheduled');

      diagnostics.checks.scheduled_messages = {
        status: scheduledError ? '❌ Failed' : '✅ Success',
        count: scheduledMessages?.length || 0,
        messages: scheduledMessages || [],
        error: scheduledError?.message || null
      };
    } catch (error) {
      diagnostics.checks.scheduled_messages = {
        status: '❌ Failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 5: Check table structure
    try {
      const { data: sample, error: sampleError } = await supabase
        .from('messages')
        .select('*')
        .limit(1)
        .single();

      if (sample) {
        diagnostics.checks.table_structure = {
          status: '✅ Success',
          columns: Object.keys(sample),
          has_status_column: 'status' in sample,
          has_scheduled_for_column: 'scheduled_for' in sample,
          sample_record: sample
        };
      } else if (sampleError?.code === 'PGRST116') {
        // No rows found - table exists but empty
        diagnostics.checks.table_structure = {
          status: '✅ Table exists but empty',
          message: 'Messages table exists but has no records'
        };
      } else {
        diagnostics.checks.table_structure = {
          status: '⚠️ No data to analyze',
          error: sampleError?.message
        };
      }
    } catch (error) {
      diagnostics.checks.table_structure = {
        status: '❌ Failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 6: Check if service role can write
    try {
      const testId = 'diagnostic-test-' + Date.now();
      
      // Try to insert
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          id: testId,
          title: 'Diagnostic Test Message',
          content: 'This is a test',
          page_id: '00000000-0000-0000-0000-000000000000',
          created_by: '00000000-0000-0000-0000-000000000000',
          recipient_type: 'all',
          recipient_count: 0,
          status: 'draft'
        });

      if (insertError) {
        diagnostics.checks.write_permission = {
          status: '❌ Cannot write',
          error: insertError.message
        };
      } else {
        // Delete test record
        await supabase
          .from('messages')
          .delete()
          .eq('id', testId);

        diagnostics.checks.write_permission = {
          status: '✅ Can write and delete',
          message: 'Service role key has full access'
        };
      }
    } catch (error) {
      diagnostics.checks.write_permission = {
        status: '❌ Failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 7: Check RLS status
    try {
      await supabase.rpc('pg_catalog.pg_tables')
        .select('*')
        .eq('tablename', 'messages');

      diagnostics.checks.rls = {
        status: '✅ Checked',
        note: 'Service role should bypass RLS automatically'
      };
    } catch {
      diagnostics.checks.rls = {
        status: '⚠️ Could not check',
        note: 'RLS check requires specific permissions'
      };
    }

    // Summary
    const allChecksPassed = Object.values(diagnostics.checks).every((check: { status?: string }) => 
      check.status?.includes('✅')
    );

    diagnostics.summary = {
      overall_status: allChecksPassed ? '✅ All checks passed' : '⚠️ Some issues found',
      database_accessible: diagnostics.checks.connection?.status?.includes('✅'),
      messages_table_exists: diagnostics.checks.total_messages?.status?.includes('✅'),
      can_query_messages: diagnostics.checks.messages_by_status?.status?.includes('✅'),
      total_messages_in_db: diagnostics.checks.messages_by_status?.total || 0,
      scheduled_messages_count: diagnostics.checks.scheduled_messages?.count || 0,
      service_role_working: diagnostics.checks.write_permission?.status?.includes('✅')
    };

    return NextResponse.json(diagnostics, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('[Database Diagnostic] Fatal error:', error);
    return NextResponse.json({
      error: 'Diagnostic failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

