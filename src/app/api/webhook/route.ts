import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Webhook verification (GET request from Facebook)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'Token123';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error('Webhook verification failed');
    return new NextResponse('Verification token mismatch', { status: 403 });
  }
}

// Webhook events (POST request from Facebook)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Webhook event received:', JSON.stringify(body, null, 2));

    // Process webhook events
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        const messaging = entry.messaging || [];

        for (const event of messaging) {
          if (event.message && event.message.text) {
            await handleMessage(event);
          }
        }
      }
    }

    // Always return 200 OK to Facebook
    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent Facebook from retrying
    return NextResponse.json({ status: 'ERROR' }, { status: 200 });
  }
}

interface WebhookEvent {
  sender?: { id: string };
  recipient?: { id: string };
  message?: { text: string };
  timestamp: number;
}

async function handleMessage(event: WebhookEvent) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const messageText = event.message?.text;
  const timestamp = event.timestamp;

  console.log(`Message from ${senderId} to ${recipientId}: ${messageText}`);

  try {
    const supabase = await createClient();

    // Find the user who owns this page
    const { data: page } = await supabase
      .from('facebook_pages')
      .select('user_id')
      .eq('facebook_page_id', recipientId)
      .single();

    if (!page) {
      console.log(`No page found for Facebook page ID: ${recipientId}`);
      return;
    }

    // Save or update conversation
    const payload = {
      user_id: page.user_id,
      page_id: recipientId,
      sender_id: senderId,
      sender_name: 'Facebook User', // We'd need to fetch this from Facebook Graph API
      last_message: messageText,
      last_message_time: new Date(timestamp).toISOString(),
      conversation_status: 'active'
    };

    const attemptUpsert = async (onConflict: string) =>
      supabase
        .from('messenger_conversations')
        .upsert(payload, {
          onConflict,
          ignoreDuplicates: false
        });

    let { error } = await attemptUpsert('page_id,sender_id');

    if (error && error.code === '42P10') {
      console.warn('[Webhook] Missing unique constraint for new key. Retrying with legacy key.');
      ({ error } = await attemptUpsert('user_id,page_id,sender_id'));
    }

    if (error) {
      console.error('Error saving conversation:', error);
    } else {
      console.log('Conversation saved successfully');
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
}
