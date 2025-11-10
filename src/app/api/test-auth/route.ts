import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const tests: any = {
    timestamp: new Date().toISOString(),
    environment: {},
    supabase: {},
    adminClient: {}
  };

  try {
    // Test 1: Check environment variables
    tests.environment = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasFacebookAppId: !!process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
      hasFacebookSecret: !!process.env.FACEBOOK_APP_SECRET,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40) + '...',
      anonKeyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
      serviceRoleKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...'
    };

    // Test 2: Create Supabase client
    tests.supabase.clientCreated = false;
    const supabase = await createClient();
    tests.supabase.clientCreated = true;

    // Test 3: Query users table
    tests.supabase.tableQuery = 'attempting';
    const { data: users, error: queryError } = await supabase
      .from('users')
      .select('id, name')
      .limit(1);
    
    if (queryError) {
      tests.supabase.tableQuery = 'failed';
      tests.supabase.queryError = queryError.message;
    } else {
      tests.supabase.tableQuery = 'success';
      tests.supabase.userCount = users?.length || 0;
    }

    // Test 4: Create admin client
    tests.adminClient.attempting = true;
    const { createClient: createAdminClient } = require('@supabase/supabase-js');
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    tests.adminClient.created = true;

    // Test 5: Try admin API call
    tests.adminClient.apiTest = 'attempting';
    const { data: testUser, error: adminError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });

    if (adminError) {
      tests.adminClient.apiTest = 'failed';
      tests.adminClient.apiError = adminError.message;
    } else {
      tests.adminClient.apiTest = 'success';
      tests.adminClient.userCount = testUser?.users?.length || 0;
    }

    return NextResponse.json({
      status: 'All tests completed',
      tests,
      overall: tests.adminClient.apiTest === 'success' ? 'READY' : 'HAS_ISSUES'
    });

  } catch (error) {
    return NextResponse.json({
      status: 'Error during testing',
      error: error instanceof Error ? error.message : String(error),
      tests
    }, { status: 500 });
  }
}






