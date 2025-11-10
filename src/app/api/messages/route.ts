import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getUserIdFromCookies } from '@/lib/auth/cookies';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const pageId = searchParams.get('pageId');

    const supabase = await createClient();
    let query = supabase
      .from('messages')
      .select('*')
      .eq('created_by', userId);

    if (status) {
      query = query.eq('status', status);
    }

    if (pageId) {
      query = query.eq('page_id', pageId);
    }

    query = query.order('created_at', { ascending: false });

    const { data: messages, error } = await query;

    if (error) {
      console.error('[Messages API] Error fetching messages:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messages: messages || [],
      count: messages?.length || 0
    });
  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    console.log('[Messages API] POST request received');
    console.log('[Messages API] User ID from cookie:', userId);

    if (!userId) {
      console.error('[Messages API] No user ID found in cookie');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('[Messages API] Request body:', JSON.stringify(body, null, 2));
    console.log('[Messages API] Media attachments received:', body.media_attachments);

    const {
      title,
      content,
      page_id,
      recipient_type,
      recipient_count,
      status,
      scheduled_for,
      selected_recipients,
      // selected_contacts_data,
      message_tag,
      media_attachments,
      auto_fetch_enabled,
      auto_fetch_page_id,
      include_tag_ids,
      exclude_tag_ids,
      use_ai_bulk_send,
      ai_messages_map,
      ai_personalize_auto_fetch,
      ai_custom_instructions
    } = body;

    // Validation
    if (!title || !content || !page_id) {
      console.error('[Messages API] Validation failed:', { title: !!title, content: !!content, page_id: !!page_id });
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'Please provide title, content, and page_id',
          missing: {
            title: !title,
            content: !content,
            page_id: !page_id
          }
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Prepare message data
  // Log incoming scheduled_for value for debugging
  if (status === 'scheduled') {
    console.log('[Messages API] 🔍 Scheduled message data:');
    console.log('[Messages API]   - status:', status);
    console.log('[Messages API]   - scheduled_for from request:', scheduled_for);
    console.log('[Messages API]   - scheduled_for type:', typeof scheduled_for);
    console.log('[Messages API]   - scheduled_for is null?:', scheduled_for === null);
    console.log('[Messages API]   - scheduled_for is undefined?:', scheduled_for === undefined);
  }

  const messageData: {
    title: string;
    content: string;
    page_id: string;
    created_by: string;
    recipient_type: string;
    recipient_count: number;
    status: string;
    scheduled_for: string | null;
    message_tag: string | null;
    selected_recipients?: string[];
    selected_contacts_data?: Array<{ sender_id: string; sender_name: string | null }>;
    media_attachments?: Array<{
      url: string;
      filename: string;
      type: string;
      size?: number;
    }>;
    auto_fetch_enabled?: boolean;
    auto_fetch_page_id?: string | null;
    include_tag_ids?: string[];
    exclude_tag_ids?: string[];
    use_ai_bulk_send?: boolean;
    ai_messages_map?: Record<string, string>;
    ai_personalize_auto_fetch?: boolean;
    ai_custom_instructions?: string | null;
  } = {
    title,
    content,
    page_id,
    created_by: userId,
    recipient_type: recipient_type || 'all',
    recipient_count: recipient_count || 0,
    status: status || 'draft',
    scheduled_for: scheduled_for || null,
    message_tag: message_tag || null,
  };

  console.log('[Messages API] 📝 Message data being saved:', {
    title: messageData.title,
    status: messageData.status,
    scheduled_for: messageData.scheduled_for
  });

    // Add auto-fetch and tag filtering for scheduled messages
    if (status === 'scheduled' && auto_fetch_enabled) {
      messageData.auto_fetch_enabled = true;
      messageData.auto_fetch_page_id = auto_fetch_page_id || page_id;
      messageData.include_tag_ids = include_tag_ids || [];
      messageData.exclude_tag_ids = exclude_tag_ids || [];
      
      // Add AI personalization for auto-fetch if enabled
      if (ai_personalize_auto_fetch) {
        messageData.ai_personalize_auto_fetch = true;
        messageData.ai_custom_instructions = ai_custom_instructions || null;
        console.log('[Messages API] AI personalization enabled for auto-fetch');
        if (ai_custom_instructions) {
          console.log('[Messages API] Custom AI instructions:', ai_custom_instructions);
        }
      }
    }

    // Add AI bulk send data if enabled
    if (use_ai_bulk_send && ai_messages_map) {
      messageData.use_ai_bulk_send = true;
      messageData.ai_messages_map = ai_messages_map;
      console.log('[Messages API] AI Bulk Send enabled with', Object.keys(ai_messages_map).length, 'personalized messages');
    }

    // Add selected recipients if provided
    if (selected_recipients && Array.isArray(selected_recipients)) {
      console.log('[Messages API] Message includes', selected_recipients.length, 'selected recipients');
      messageData.selected_recipients = selected_recipients;
    }

    // Add media attachments if provided
    if (media_attachments && Array.isArray(media_attachments) && media_attachments.length > 0) {
      console.log('[Messages API] Message includes', media_attachments.length, 'media attachments');
      messageData.media_attachments = media_attachments;
    }

    // Add selected contacts data if provided (for personalization)
    // Temporarily disabled until database migration is complete
    // if (selected_contacts_data && Array.isArray(selected_contacts_data)) {
    //   console.log('[Messages API] Message includes', selected_contacts_data.length, 'contact names for personalization');
    //   messageData.selected_contacts_data = selected_contacts_data;
    // }

    if (message_tag) {
      console.log('[Messages API] Using message tag:', message_tag);
    }

    console.log('[Messages API] Inserting message into database...');
    console.log('[Messages API] Message data being inserted:', JSON.stringify(messageData, null, 2));

    const { data: message, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      console.error('[Messages API] Insert error:', error);
      console.error('[Messages API] Error code:', error.code);
      console.error('[Messages API] Error details:', error.details);
      console.error('[Messages API] Error hint:', error.hint);
      
      return NextResponse.json(
        { 
          error: 'Failed to create message',
          details: error.message,
          code: error.code,
          hint: error.hint
        },
        { status: 500 }
      );
    }

    console.log('[Messages API] Message created successfully:', message.id);

    // Create activity log
    try {
      await supabase
        .from('message_activity')
        .insert({
          message_id: message.id,
          activity_type: status === 'scheduled' ? 'scheduled' : status === 'sent' ? 'sent' : 'created',
          description: `Message "${title}" ${status === 'scheduled' ? 'scheduled' : status === 'sent' ? 'sent' : 'created'}`
        });
    } catch (activityError) {
      console.error('[Messages API] Activity log error:', activityError);
      // Don't fail the request if activity log fails
    }

    return NextResponse.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('[Messages API] Caught error:', error);
    console.error('[Messages API] Error type:', typeof error);
    console.error('[Messages API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to create message';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        type: typeof error
      },
      { status: 500 }
    );
  }
}

