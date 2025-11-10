import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Full comprehensive test of entire message sending pipeline
 * GET /api/messages/full-test
 */
export async function GET(_request: NextRequest) {
  const results: { 
    timestamp: string; 
    tests: Array<Record<string, unknown>>;
    summary?: Record<string, unknown>;
  } = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    // Test 1: Authentication
    results.tests.push({
      name: 'Authentication',
      status: userId ? 'pass' : 'fail',
      details: userId ? `User ID: ${userId}` : 'Not authenticated',
      error: userId ? null : 'No fb-user-id cookie found'
    });

    if (!userId) {
      return NextResponse.json(results);
    }

    const supabase = await createClient();

    // Test 2: Get User
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    results.tests.push({
      name: 'User Record',
      status: user ? 'pass' : 'fail',
      details: user ? `Email: ${user.email}` : 'User not found',
      error: userError?.message || null
    });

    // Test 3: Get Pages
    const { data: pages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('user_id', userId);

    results.tests.push({
      name: 'Facebook Pages',
      status: pages && pages.length > 0 ? 'pass' : 'fail',
      details: pages ? `Found ${pages.length} page(s)` : 'No pages found',
      error: pagesError?.message || null,
      pages: pages?.map(p => ({
        name: p.name,
        id: p.facebook_page_id,
        has_token: !!p.access_token,
        token_length: p.access_token?.length || 0,
        token_preview: p.access_token ? `${p.access_token.substring(0, 30)}...` : 'MISSING'
      }))
    });

    if (!pages || pages.length === 0) {
      return NextResponse.json(results);
    }

    const page = pages[0];

    // Test 4: Access Token
    results.tests.push({
      name: 'Access Token',
      status: page.access_token ? 'pass' : 'fail',
      details: page.access_token 
        ? `Token length: ${page.access_token.length} characters`
        : 'No access token',
      error: !page.access_token ? 'Access token missing from database' : null
    });

    if (!page.access_token) {
      return NextResponse.json(results);
    }

    // Test 5: Get Conversations
    const { data: conversations, error: convError } = await supabase
      .from('messenger_conversations')
      .select('*')
      .eq('page_id', page.facebook_page_id)
      .limit(5);

    results.tests.push({
      name: 'Conversations/Recipients',
      status: conversations && conversations.length > 0 ? 'pass' : 'fail',
      details: conversations 
        ? `Found ${conversations.length} conversation(s)`
        : 'No conversations found',
      error: convError?.message || null,
      sample_recipients: conversations?.slice(0, 3).map(c => ({
        name: c.sender_name,
        id: c.sender_id.substring(0, 20) + '...'
      }))
    });

    if (!conversations || conversations.length === 0) {
      results.tests.push({
        name: 'RECOMMENDATION',
        status: 'warning',
        details: 'No recipients found. Sync conversations from Facebook first.',
        error: null
      });
      return NextResponse.json(results);
    }

    const testRecipient = conversations[0];

    // Test 6: Test Facebook API - Get Page Info
    console.log('[Full Test] Testing Facebook API - Page Info...');
    
    try {
      const pageInfoResponse = await fetch(
        `https://graph.facebook.com/v18.0/${page.facebook_page_id}?fields=name,access_token&access_token=${page.access_token}`,
        { method: 'GET' }
      );

      const pageInfoData = await pageInfoResponse.json();

      results.tests.push({
        name: 'Facebook API - Page Info',
        status: pageInfoResponse.ok ? 'pass' : 'fail',
        details: pageInfoResponse.ok 
          ? `Page Name: ${pageInfoData.name}`
          : `Error: ${pageInfoData.error?.message}`,
        error: pageInfoData.error || null,
        http_status: pageInfoResponse.status
      });

      if (!pageInfoResponse.ok) {
        // Token is invalid
        if (pageInfoData.error?.code === 190) {
          results.tests.push({
            name: 'DIAGNOSIS',
            status: 'fail',
            details: 'ACCESS TOKEN IS INVALID OR EXPIRED',
            error: 'Your Facebook access token is not working. This usually happens when:\n1. Token expired (they expire after 60 days)\n2. User changed Facebook password\n3. User revoked app permissions\n4. App was disconnected from page',
            recommendation: 'You need to FULLY disconnect and reconnect:\n1. Go to Pages in dashboard\n2. Click disconnect\n3. Clear browser cookies\n4. Log in again with Facebook\n5. Reconnect the page'
          });
        }
        return NextResponse.json(results);
      }
    } catch (apiError) {
      results.tests.push({
        name: 'Facebook API - Page Info',
        status: 'fail',
        details: 'Network error',
        error: apiError instanceof Error ? apiError.message : String(apiError)
      });
      return NextResponse.json(results);
    }

    // Test 7: Test Sending Message
    console.log('[Full Test] Testing message send to:', testRecipient.sender_name);

    const testMessage = `🧪 Test message from KickerPro - ${new Date().toLocaleTimeString()}`;

    const sendPayload: Record<string, unknown> = {
      recipient: { id: testRecipient.sender_id },
      message: { text: testMessage },
      access_token: page.access_token,
      messaging_type: 'MESSAGE_TAG',
      tag: 'ACCOUNT_UPDATE'
    };

    console.log('[Full Test] Sending to Facebook API...');

    const sendResponse = await fetch(
      'https://graph.facebook.com/v18.0/me/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendPayload)
      }
    );

    const sendData = await sendResponse.json();

    console.log('[Full Test] Send response:', sendResponse.status, sendData);

    results.tests.push({
      name: 'Facebook API - Send Message',
      status: sendResponse.ok ? 'pass' : 'fail',
      details: sendResponse.ok
        ? `✅ MESSAGE SENT! Message ID: ${sendData.message_id}`
        : `❌ SEND FAILED: ${sendData.error?.message}`,
      error: sendData.error || null,
      http_status: sendResponse.status,
      recipient: {
        name: testRecipient.sender_name,
        id: testRecipient.sender_id.substring(0, 20) + '...'
      },
      message_sent: testMessage
    });

    if (!sendResponse.ok) {
      // Analyze the specific error
      const errorCode = sendData.error?.code;
      const errorMessage = sendData.error?.message;

      let diagnosis = '';
      let recommendation = '';

      switch (errorCode) {
        case 190:
          diagnosis = 'TOKEN INVALID/EXPIRED';
          recommendation = 'Reconnect Facebook page completely';
          break;
        case 200:
          diagnosis = 'PERMISSION DENIED';
          recommendation = 'Check Facebook app has pages_messaging permission';
          break;
        case 10:
          diagnosis = 'PERMISSION NOT GRANTED';
          recommendation = 'User needs to grant messaging permission';
          break;
        case 551:
          diagnosis = 'USER CANNOT RECEIVE MESSAGES';
          recommendation = 'User blocked page or opted out. Try different recipient.';
          break;
        case 2018109:
          diagnosis = 'MESSAGE TAG NOT ALLOWED';
          recommendation = 'Try without tag or use different tag';
          break;
        case 100:
          diagnosis = 'INVALID PARAMETER';
          recommendation = 'Message content or format invalid';
          break;
        case 613:
          diagnosis = 'RATE LIMIT EXCEEDED';
          recommendation = 'Wait 10 minutes before trying again';
          break;
        default:
          diagnosis = `UNKNOWN ERROR (Code: ${errorCode})`;
          recommendation = 'Check Facebook Graph API documentation';
      }

      results.tests.push({
        name: 'DIAGNOSIS',
        status: 'fail',
        details: diagnosis,
        error: errorMessage,
        recommendation: recommendation,
        facebook_error_code: errorCode,
        facebook_trace_id: sendData.error?.fbtrace_id
      });
    }

    // Final Summary
    const passed = results.tests.filter(t => (t as { status: string }).status === 'pass').length;
    const failed = results.tests.filter(t => (t as { status: string }).status === 'fail').length;

    results.summary = {
      total_tests: results.tests.length,
      passed,
      failed,
      overall_status: failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failed} TEST(S) FAILED`
    };

    return NextResponse.json(results);

  } catch (error) {
    results.tests.push({
      name: 'Fatal Error',
      status: 'fail',
      details: 'Unexpected error occurred',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(results, { status: 500 });
  }
}



