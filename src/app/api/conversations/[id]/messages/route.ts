import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserIdFromCookies } from '@/lib/auth/cookies';
import { createClient } from '@/lib/supabase/server';

/**
 * Fetch conversation messages from Facebook
 * GET /api/conversations/[id]/messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get the conversation details
    const { data: conversation, error: convError } = await supabase
      .from('messenger_conversations')
      .select('id, sender_id, sender_name, page_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get the page access token
    const { data: accessiblePages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('facebook_page_id, access_token')
      .eq('user_id', userId);

    if (pagesError || !accessiblePages) {
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }

    const page = accessiblePages.find(p => p.facebook_page_id === conversation.page_id);
    if (!page) {
      return NextResponse.json({ error: 'Page not found or access denied' }, { status: 403 });
    }

    // Fetch actual conversation messages from Facebook Messenger
    // Try the conversations endpoint first (gets real chat history)
    let formattedMessages: Array<{
      id: string;
      from: string;
      fromName: string;
      message: string;
      timestamp: string;
      createdAt: string;
    }> = [];

    try {
      const conversationUrl = `https://graph.facebook.com/v18.0/me/conversations?user_id=${conversation.sender_id}&fields=messages.limit(10){id,from,message,created_time}&access_token=${page.access_token}`;
      
      const conversationResponse = await fetch(conversationUrl);
      
      if (conversationResponse.ok) {
        const conversationData = await conversationResponse.json();
        const conv = conversationData.data?.[0];
        
        if (conv?.messages?.data) {
          formattedMessages = conv.messages.data.map((msg: {
            id: string;
            from: { id: string; name?: string };
            message: string;
            created_time: string;
          }) => ({
            id: msg.id,
            from: msg.from?.id === conversation.sender_id ? 'user' : 'business',
            fromName: msg.from?.name || (msg.from?.id === conversation.sender_id ? conversation.sender_name || 'Customer' : 'Business'),
            message: msg.message || '(No text)',
            timestamp: msg.created_time,
            createdAt: new Date(msg.created_time).toISOString()
          }));
        }
      }
    } catch (err) {
      console.warn('[Messages API] Conversations endpoint failed, trying alternative:', err);
    }

    // If conversations endpoint didn't work, try alternative
    if (formattedMessages.length === 0) {
      const messagesUrl = `https://graph.facebook.com/v18.0/${conversation.sender_id}/messages?fields=id,from,message,created_time&access_token=${page.access_token}&limit=10`;
      
      const response = await fetch(messagesUrl);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        console.error('[Messages API] Facebook API error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch messages from Facebook', details: error },
          { status: response.status }
        );
      }

      const data = await response.json();
      const messages = data.data || [];

      formattedMessages = messages.map((msg: {
        id: string;
        from: { name?: string; id: string };
        message: string;
        created_time: string;
      }) => ({
        id: msg.id,
        from: msg.from?.id === conversation.sender_id ? 'user' : 'business',
        fromName: msg.from?.name || (msg.from?.id === conversation.sender_id ? conversation.sender_name || 'Customer' : 'Business'),
        message: msg.message || '(No text)',
        timestamp: msg.created_time,
        createdAt: new Date(msg.created_time).toISOString()
      }));
    }

    if (formattedMessages.length === 0) {
      return NextResponse.json(
        { 
          error: 'No messages found',
          details: 'This conversation may not have any message history accessible through the Facebook API. This can happen with very old conversations or due to permissions.'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conversationId: conversation.id,
      senderId: conversation.sender_id,
      senderName: conversation.sender_name,
      messages: formattedMessages,
      total: formattedMessages.length
    });

  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

