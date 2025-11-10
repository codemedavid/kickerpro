import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';

/**
 * FORCE SEND all scheduled messages RIGHT NOW
 * GET /api/messages/send-all-scheduled
 * 
 * Ignores scheduled time - sends everything immediately
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('[Send All Scheduled] Force sending all scheduled messages...');

    const supabase = await createClient();

    // Get ALL scheduled messages for this user
    const { data: scheduledMessages, error: queryError } = await supabase
      .from('messages')
      .select('*')
      .eq('created_by', userId)
      .eq('status', 'scheduled')
      .order('created_at', { ascending: true });

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!scheduledMessages || scheduledMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled messages found',
        sent: 0
      });
    }

    console.log(`[Send All Scheduled] Found ${scheduledMessages.length} message(s) to send`);

    const results = [];
    let sent = 0;
    let failed = 0;

    for (const msg of scheduledMessages) {
      console.log(`[Send All Scheduled] Processing: ${msg.id} - ${msg.title}`);

      try {
        // Update to sending status
        await supabase
          .from('messages')
          .update({ 
            status: 'sent',
            scheduled_for: null 
          })
          .eq('id', msg.id);

        // Trigger send-now
        const origin = request.nextUrl.origin;
        const sendResponse = await fetch(
          `${origin}/api/messages/${msg.id}/send-now`,
          {
            method: 'GET',
            headers: {
              Cookie: request.headers.get('cookie') || ''
            }
          }
        );

        if (sendResponse.ok) {
          const sendResult = await sendResponse.json();
          console.log(`[Send All Scheduled] ✅ ${msg.title}: ${sendResult.stats?.sent || 0} sent`);
          
          sent++;
          results.push({
            id: msg.id,
            title: msg.title,
            status: 'sent',
            sent: sendResult.stats?.sent || 0,
            failed: sendResult.stats?.failed || 0
          });
        } else {
          const errorText = await sendResponse.text();
          console.error(`[Send All Scheduled] ❌ ${msg.title} failed:`, errorText);
          
          failed++;
          results.push({
            id: msg.id,
            title: msg.title,
            status: 'failed',
            error: errorText
          });
        }

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`[Send All Scheduled] Exception for ${msg.title}:`, error);
        failed++;
        results.push({
          id: msg.id,
          title: msg.title,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: scheduledMessages.length,
      sent,
      failed,
      results
    });

  } catch (error) {
    console.error('[Send All Scheduled] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send' },
      { status: 500 }
    );
  }
}






