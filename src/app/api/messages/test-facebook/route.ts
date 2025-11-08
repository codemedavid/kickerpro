import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Test Facebook API connection and message sending
 * GET /api/messages/test-facebook?messageId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get message
    const { data: message } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Get page
    const { data: page } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', message.page_id)
      .single();

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Get first recipient from selected_recipients or fetch one
    let testRecipient = null;
    if (message.selected_recipients && message.selected_recipients.length > 0) {
      testRecipient = message.selected_recipients[0];
    } else {
      const { data: conv } = await supabase
        .from('messenger_conversations')
        .select('sender_id, sender_name')
        .eq('page_id', page.facebook_page_id)
        .limit(1)
        .single();
      
      testRecipient = conv?.sender_id;
    }

    if (!testRecipient) {
      return NextResponse.json({ error: 'No recipient found to test' }, { status: 400 });
    }

    console.log('[Test Facebook] Testing message send...');
    console.log('[Test Facebook] Page:', page.name);
    console.log('[Test Facebook] Page ID:', page.facebook_page_id);
    console.log('[Test Facebook] Recipient:', testRecipient);
    console.log('[Test Facebook] Message content:', message.content.substring(0, 100));
    console.log('[Test Facebook] Message tag:', message.message_tag || 'none');
    console.log('[Test Facebook] Has access token:', !!page.access_token);

    // Test Facebook API call
    const url = `https://graph.facebook.com/v18.0/me/messages`;

    const postData: any = {
      recipient: { id: testRecipient },
      message: { text: message.content },
      access_token: page.access_token
    };

    if (message.message_tag) {
      postData.messaging_type = 'MESSAGE_TAG';
      postData.tag = message.message_tag;
    }

    console.log('[Test Facebook] Sending to Facebook API...');
    console.log('[Test Facebook] URL:', url);
    console.log('[Test Facebook] Data:', JSON.stringify({
      ...postData,
      access_token: page.access_token ? `${page.access_token.substring(0, 20)}...` : 'missing'
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });

    const responseText = await response.text();
    console.log('[Test Facebook] Response status:', response.status);
    console.log('[Test Facebook] Response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Facebook API error',
        status: response.status,
        facebook_error: responseData.error,
        details: {
          message: responseData.error?.message,
          type: responseData.error?.type,
          code: responseData.error?.code,
          error_subcode: responseData.error?.error_subcode,
          fbtrace_id: responseData.error?.fbtrace_id
        },
        recommendations: getFacebookErrorRecommendations(responseData.error)
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Test message sent successfully!',
      message_id: responseData.message_id,
      recipient_id: responseData.recipient_id,
      page: {
        name: page.name,
        id: page.facebook_page_id
      }
    });

  } catch (error) {
    console.error('[Test Facebook] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

function getFacebookErrorRecommendations(error: any): string[] {
  if (!error) return [];

  const recommendations: string[] = [];

  // Common Facebook errors
  switch (error.code) {
    case 190:
      recommendations.push('Access token expired or invalid');
      recommendations.push('Reconnect your Facebook page in settings');
      break;
    
    case 200:
      recommendations.push('Permission denied - check page permissions');
      recommendations.push('Make sure your app has "pages_messaging" permission');
      break;
    
    case 10:
      recommendations.push('Permission not granted by user');
      recommendations.push('User needs to grant message permissions');
      break;
    
    case 551:
      recommendations.push('User cannot receive messages from this page');
      recommendations.push('User may have blocked the page or opted out');
      break;
    
    case 2018109:
      recommendations.push('Message tag not allowed for this recipient');
      recommendations.push('Try sending without a tag, or use a different tag');
      break;
    
    case 100:
      recommendations.push('Invalid parameter - check message content');
      recommendations.push('Message may be too long or contain invalid characters');
      break;
    
    case 613:
      recommendations.push('Rate limit exceeded');
      recommendations.push('Wait a few minutes before sending more messages');
      break;
    
    default:
      recommendations.push('Check Facebook Graph API documentation for error code: ' + error.code);
      recommendations.push('Error type: ' + error.type);
  }

  if (error.message) {
    recommendations.push('Facebook says: ' + error.message);
  }

  return recommendations;
}



