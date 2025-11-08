import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('[Scheduled Dispatch] ========== START ==========');
  console.log('[Scheduled Dispatch] Time:', new Date().toISOString());
  
  try {
    const cookieStore = await cookies();
    console.log('[Scheduled Dispatch] Checking cookies...');
    
    const userId = cookieStore.get('fb-user-id')?.value;
    console.log('[Scheduled Dispatch] User ID from cookie:', userId || 'NOT FOUND');

    if (!userId) {
      console.error('[Scheduled Dispatch] ❌ Not authenticated - no fb-user-id cookie');
      console.error('[Scheduled Dispatch] Available cookies:', cookieStore.getAll().map(c => c.name));
      return NextResponse.json({ 
        error: 'Not authenticated',
        details: 'No fb-user-id cookie found',
        available_cookies: cookieStore.getAll().map(c => c.name)
      }, { status: 401 });
    }

    console.log('[Scheduled Dispatch] ✅ Authenticated, user:', userId);

    const supabase = await createClient();
    console.log('[Scheduled Dispatch] Supabase client created');

    // Find due scheduled messages for this user
    const nowIso = new Date().toISOString();
    console.log('[Scheduled Dispatch] Looking for messages with scheduled_for <=', nowIso);
    
    const { data: dueMessages, error: queryError } = await supabase
      .from('messages')
      .select('*') // Select all columns to avoid column not found errors
      .eq('created_by', userId)
      .eq('status', 'scheduled')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(5);
    
    console.log('[Scheduled Dispatch] Query result:', dueMessages?.length || 0, 'messages found');

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!dueMessages || dueMessages.length === 0) {
      return NextResponse.json({ success: true, dispatched: 0 });
    }

    let dispatched = 0;

    for (const msg of dueMessages) {
      try {
        console.log('[Scheduled Dispatch] Processing message:', msg.id, '-', msg.title);
        
        // Skip auto-fetch for now (columns don't exist yet)
        // TODO: Add auto_fetch_enabled, auto_fetch_page_id, include_tag_ids, exclude_tag_ids columns to messages table
        
        // Mark ready to send (clear schedule to avoid double-run) and move to 'sent' entry point
        const { error: updateError } = await supabase
          .from('messages')
          .update({ status: 'sent', scheduled_for: null })
          .eq('id', msg.id)
          .eq('created_by', userId);

        if (updateError) {
          console.error('[Scheduled Dispatch] Error updating message status:', updateError);
          continue;
        }

        // Trigger direct send (bypasses unreliable batch system)
        const origin = request.nextUrl.origin;
        const sendResponse = await fetch(
          `${origin}/api/messages/${msg.id}/send-now`,
          {
            method: 'GET', // send-now uses GET
            headers: {
              Cookie: request.headers.get('cookie') || ''
            }
          }
        );

        if (sendResponse.ok) {
          dispatched++;
          console.log('[Scheduled Dispatch] ✅ Message sent successfully:', msg.id);
        } else {
          const errorText = await sendResponse.text();
          console.error('[Scheduled Dispatch] ❌ Failed to send:', msg.id, errorText);
        }
      } catch (error) {
        console.error('[Scheduled Dispatch] Error processing message:', msg.id, error);
        continue;
      }
    }

    console.log('[Scheduled Dispatch] ========== COMPLETE ==========');
    console.log('[Scheduled Dispatch] Total dispatched:', dispatched);
    
    return NextResponse.json({ success: true, dispatched });
  } catch (error) {
    console.error('[Scheduled Dispatch] ========== ERROR ==========');
    console.error('[Scheduled Dispatch] Fatal error:', error);
    console.error('[Scheduled Dispatch] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[Scheduled Dispatch] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[Scheduled Dispatch] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json({ 
      error: 'Failed to dispatch scheduled messages',
      details: error instanceof Error ? error.message : String(error),
      type: error instanceof Error ? error.constructor.name : typeof error
    }, { status: 500 });
  }
}


