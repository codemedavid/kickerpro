import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Create a test scheduled message
 * POST /api/messages/create-test-scheduled
 * 
 * This will create a message scheduled for 2 minutes from now
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        message: 'Please login first'
      }, { status: 401 });
    }

    const supabase = await createClient();

    // Get user's first Facebook page
    const { data: pages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('id, page_name, facebook_page_id')
      .eq('user_id', userId)
      .limit(1);

    if (pagesError || !pages || pages.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook pages found',
        message: 'Please connect a Facebook page first at /dashboard/pages'
      }, { status: 400 });
    }

    const page = pages[0];

    // Get some recipients (conversations)
    const { data: conversations } = await supabase
      .from('messenger_conversations')
      .select('sender_id, sender_name')
      .eq('page_id', page.facebook_page_id)
      .limit(5);

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ 
        error: 'No conversations found',
        message: 'Please sync conversations first at /dashboard/conversations'
      }, { status: 400 });
    }

    const recipientIds = conversations.map(c => c.sender_id);

    // Create scheduled message for 2 minutes from now
    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + 2);

    const { data: message, error: createError } = await supabase
      .from('messages')
      .insert({
        title: `Test Scheduled Message - ${new Date().toLocaleTimeString()}`,
        content: 'Hello! This is a test scheduled message from your KickerPro app. 🚀',
        page_id: page.id,
        created_by: userId,
        recipient_type: 'selected',
        recipient_count: recipientIds.length,
        status: 'scheduled',
        scheduled_for: scheduledFor.toISOString(),
        selected_recipients: recipientIds,
        message_tag: 'ACCOUNT_UPDATE'
      })
      .select()
      .single();

    if (createError) {
      console.error('[Create Test Scheduled] Error:', createError);
      return NextResponse.json({ 
        error: 'Failed to create message',
        details: createError.message
      }, { status: 500 });
    }

    const now = new Date();
    const minutesUntil = Math.floor((scheduledFor.getTime() - now.getTime()) / 60000);

    return NextResponse.json({
      success: true,
      message: '✅ Test scheduled message created!',
      details: {
        id: message.id,
        title: message.title,
        status: message.status,
        page: page.page_name,
        recipients: recipientIds.length,
        scheduled_for: scheduledFor.toISOString(),
        scheduled_for_readable: scheduledFor.toLocaleString(),
        current_time: now.toISOString(),
        current_time_readable: now.toLocaleString(),
        sends_in_minutes: minutesUntil,
        next_steps: [
          `✅ Message created with status='scheduled'`,
          `⏰ Scheduled to send at: ${scheduledFor.toLocaleString()}`,
          `🕐 That's in approximately ${minutesUntil} minutes`,
          `🔄 Cron job runs every 1 minute`,
          `📊 Check Vercel logs after ${scheduledFor.toLocaleTimeString()} to see it send`,
          `📱 Recipients: ${conversations.map(c => c.sender_name).join(', ')}`
        ]
      }
    });
  } catch (error) {
    console.error('[Create Test Scheduled] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to create test message',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

