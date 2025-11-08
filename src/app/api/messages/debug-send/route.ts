import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Debug send - shows EVERY step of message sending
 * GET /api/messages/debug-send
 */
export async function GET(_request: NextRequest) {
  const log: Array<{ step: string; status: string; message: string; data?: unknown; timestamp: string }> = [];
  
  const addLog = (step: string, status: 'info' | 'success' | 'error', message: string, data?: unknown) => {
    console.log(`[Debug Send] ${step}: ${message}`, data || '');
    log.push({
      step,
      status,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  };

  try {
    addLog('START', 'info', 'Starting debug send test');

    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      addLog('AUTH', 'error', 'Not authenticated');
      return NextResponse.json({ log, error: 'Not authenticated' });
    }

    addLog('AUTH', 'success', 'Authenticated', { userId });

    const supabase = await createClient();

    // Step 1: Check conversations
    addLog('CONVERSATIONS', 'info', 'Checking for conversations...');
    
    const { data: allConversations, error: convError } = await supabase
      .from('messenger_conversations')
      .select('*')
      .limit(10);

    if (convError) {
      addLog('CONVERSATIONS', 'error', 'Failed to query conversations', { error: convError.message });
      return NextResponse.json({ log, error: convError.message });
    }

    addLog('CONVERSATIONS', allConversations && allConversations.length > 0 ? 'success' : 'error', 
      `Found ${allConversations?.length || 0} conversation(s)`, 
      { 
        count: allConversations?.length,
        sample: allConversations?.slice(0, 3).map(c => ({
          name: c.sender_name,
          id: c.sender_id,
          page_id: c.page_id
        }))
      }
    );

    if (!allConversations || allConversations.length === 0) {
      addLog('ERROR', 'error', 'NO CONVERSATIONS FOUND IN DATABASE');
      addLog('RECOMMENDATION', 'info', 'You MUST sync conversations first!');
      addLog('RECOMMENDATION', 'info', 'Visit: /api/conversations/sync?pageId=656646850875530');
      return NextResponse.json({ 
        log, 
        error: 'No conversations found',
        action_required: 'Sync conversations from Facebook first'
      });
    }

    // Step 2: Get page for first conversation
    const testConv = allConversations[0];
    addLog('TEST_RECIPIENT', 'info', 'Using test recipient', {
      name: testConv.sender_name,
      id: testConv.sender_id,
      page_id: testConv.page_id
    });

    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('facebook_page_id', testConv.page_id)
      .single();

    if (pageError || !page) {
      addLog('PAGE', 'error', 'Page not found', { error: pageError?.message });
      return NextResponse.json({ log, error: 'Page not found' });
    }

    addLog('PAGE', 'success', 'Page found', {
      name: page.name,
      id: page.facebook_page_id,
      has_token: !!page.access_token,
      token_length: page.access_token?.length
    });

    if (!page.access_token) {
      addLog('TOKEN', 'error', 'No access token for page');
      return NextResponse.json({ log, error: 'No access token' });
    }

    addLog('TOKEN', 'success', 'Access token present', {
      length: page.access_token.length,
      preview: page.access_token.substring(0, 30) + '...'
    });

    // Step 3: Test Facebook API - Send actual message
    addLog('FB_API', 'info', 'Preparing to send test message to Facebook...');

    const testMessage = `🧪 Debug test at ${new Date().toLocaleTimeString()}`;
    
    const payload = {
      recipient: { id: testConv.sender_id },
      message: { text: testMessage },
      access_token: page.access_token,
      messaging_type: 'MESSAGE_TAG',
      tag: 'ACCOUNT_UPDATE'
    };

    addLog('FB_API', 'info', 'Payload prepared', {
      recipient_id: testConv.sender_id,
      recipient_name: testConv.sender_name,
      message: testMessage,
      tag: 'ACCOUNT_UPDATE',
      has_token: true
    });

    addLog('FB_API', 'info', 'Calling Facebook Graph API...');

    const fbResponse = await fetch('https://graph.facebook.com/v18.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const fbResponseText = await fbResponse.text();
    addLog('FB_API', 'info', 'Facebook API responded', {
      status: fbResponse.status,
      statusText: fbResponse.statusText
    });

    let fbData;
    try {
      fbData = JSON.parse(fbResponseText);
    } catch {
      fbData = { raw: fbResponseText };
    }

    if (fbResponse.ok) {
      addLog('FB_API', 'success', '✅ MESSAGE SENT TO FACEBOOK!', {
        message_id: fbData.message_id,
        recipient_id: fbData.recipient_id
      });

      addLog('SUCCESS', 'success', '🎉 TEST SUCCESSFUL!');
      addLog('SUCCESS', 'success', `Message delivered to ${testConv.sender_name}`);

      return NextResponse.json({
        log,
        result: 'SUCCESS',
        message: 'Message sent successfully!',
        details: {
          recipient: testConv.sender_name,
          message_id: fbData.message_id,
          sent_at: new Date().toISOString()
        }
      });
    } else {
      addLog('FB_API', 'error', '❌ FACEBOOK API ERROR', {
        error: fbData.error,
        error_code: fbData.error?.code,
        error_message: fbData.error?.message,
        error_type: fbData.error?.type
      });

      // Analyze error
      const errorCode = fbData.error?.code;
      let diagnosis = '';
      let fix = '';

      switch (errorCode) {
        case 190:
          diagnosis = 'TOKEN EXPIRED/INVALID';
          fix = 'Your access token is not valid. Token might be expired or revoked.';
          break;
        case 200:
          diagnosis = 'PERMISSION DENIED';
          fix = 'Missing pages_messaging permission. Check Facebook app settings.';
          break;
        case 10:
          diagnosis = 'USER PERMISSION REQUIRED';
          fix = 'User has not granted permission to receive messages.';
          break;
        case 551:
          diagnosis = 'RECIPIENT UNAVAILABLE';
          fix = 'User cannot receive messages (blocked page or opted out). Try different recipient.';
          break;
        case 2018109:
          diagnosis = 'MESSAGE TAG ERROR';
          fix = 'ACCOUNT_UPDATE tag not allowed for this recipient. Need to send within 24h window without tag.';
          break;
        case 613:
          diagnosis = 'RATE LIMIT';
          fix = 'Too many messages sent. Wait 10-15 minutes.';
          break;
        default:
          diagnosis = `UNKNOWN ERROR (Code ${errorCode})`;
          fix = 'Check Facebook Graph API documentation.';
      }

      addLog('DIAGNOSIS', 'error', diagnosis);
      addLog('FIX', 'info', fix);

      return NextResponse.json({
        log,
        result: 'FAILED',
        error: fbData.error,
        diagnosis,
        fix
      });
    }

  } catch (error) {
    addLog('FATAL', 'error', 'Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      log,
      result: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}



