import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;
    const supabase = await createClient();

    const checks: any = {
      cookies: {
        userId: userId ? 'Present' : 'Missing',
        accessToken: cookieStore.get('fb-access-token')?.value ? 'Present' : 'Missing'
      },
      tests: {}
    };

    // Test 1: Can we query users table?
    try {
      const { data, error } = await supabase.from('users').select('id').limit(1);
      checks.tests.users_select = error ? `❌ ${error.message}` : '✅ OK';
    } catch (e: any) {
      checks.tests.users_select = `❌ ${e.message}`;
    }

    // Test 2: Can we insert into users table?
    try {
      const testId = 'test_' + Date.now();
      const { error } = await supabase.from('users').insert({
        facebook_id: testId,
        name: 'Test User',
        email: 'test@test.com',
        role: 'member'
      });
      
      if (!error) {
        // Delete the test record
        await supabase.from('users').delete().eq('facebook_id', testId);
        checks.tests.users_insert = '✅ OK';
      } else {
        checks.tests.users_insert = `❌ ${error.message}`;
      }
    } catch (e: any) {
      checks.tests.users_insert = `❌ ${e.message}`;
    }

    // Test 3: Can we query facebook_pages?
    try {
      const { data, error } = await supabase.from('facebook_pages').select('id').limit(1);
      checks.tests.facebook_pages_select = error ? `❌ ${error.message}` : '✅ OK';
    } catch (e: any) {
      checks.tests.facebook_pages_select = `❌ ${e.message}`;
    }

    // Test 4: Can we query messenger_conversations?
    try {
      const { data, error } = await supabase.from('messenger_conversations').select('id').limit(1);
      checks.tests.messenger_conversations_select = error ? `❌ ${error.message}` : '✅ OK';
    } catch (e: any) {
      checks.tests.messenger_conversations_select = `❌ ${e.message}`;
    }

    // Test 5: Can we insert into messenger_conversations?
    try {
      if (userId) {
        const testId = 'test_' + Date.now();
        const { error } = await supabase.from('messenger_conversations').insert({
          user_id: userId,
          page_id: testId,
          sender_id: testId,
          sender_name: 'Test',
          last_message: 'Test',
          last_message_time: new Date().toISOString()
        });
        
        if (!error) {
          // Delete test record
          await supabase.from('messenger_conversations').delete().eq('sender_id', testId);
          checks.tests.messenger_conversations_insert = '✅ OK';
        } else {
          checks.tests.messenger_conversations_insert = `❌ ${error.message}`;
        }
      } else {
        checks.tests.messenger_conversations_insert = '⚠️ No userId to test';
      }
    } catch (e: any) {
      checks.tests.messenger_conversations_insert = `❌ ${e.message}`;
    }

    // Overall status
    const hasErrors = Object.values(checks.tests).some(v => String(v).includes('❌'));
    checks.overall = hasErrors ? '❌ RLS STILL BLOCKING' : '✅ ALL GOOD';

    return NextResponse.json(checks);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 });
  }
}



