import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserIdFromCookies } from '@/lib/auth/cookies';
import { createClient } from '@/lib/supabase/server';
import { openRouterService } from '@/lib/ai/openrouter';

/**
 * Generate AI follow-up messages for conversations
 * POST /api/ai/generate-follow-ups
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[AI Generate] API called');
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      console.error('[AI Generate] No user ID');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationIds, senderIds, pageId, customInstructions } = body;

    // Accept either conversationIds (from Conversations page) or senderIds (from Compose page)
    const idsToUse = senderIds || conversationIds;
    const usesSenderIds = !!senderIds;

    console.log('[AI Generate] Request:', { 
      conversationIds: conversationIds?.length,
      senderIds: senderIds?.length,
      pageId,
      hasCustomInstructions: !!customInstructions,
      usesSenderIds
    });

    if (!idsToUse || !Array.isArray(idsToUse) || idsToUse.length === 0) {
      return NextResponse.json(
        { error: 'conversationIds or senderIds array is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get page access token
    // pageId can be either the internal UUID (id) or facebook_page_id
    let pageQuery = supabase
      .from('facebook_pages')
      .select('facebook_page_id, access_token, name, id')
      .eq('user_id', userId);

    if (pageId) {
      // Try both id and facebook_page_id to handle both cases
      pageQuery = pageQuery.or(`id.eq.${pageId},facebook_page_id.eq.${pageId}`);
    }

    const { data: pages, error: pageError } = await pageQuery;

    console.log('[AI Generate] Page query result:', { 
      pageId, 
      pages: pages?.length, 
      error: pageError,
      foundPageIds: pages?.map(p => ({ id: p.id, fbId: p.facebook_page_id }))
    });

    if (pageError) {
      console.error('[AI Generate] Page error:', pageError);
      return NextResponse.json({ error: 'Failed to fetch page', details: pageError.message }, { status: 500 });
    }

    if (!pages || pages.length === 0) {
      console.error('[AI Generate] No pages found for user. Query pageId:', pageId);
      return NextResponse.json({ 
        error: 'No pages found. Please ensure a Facebook page is connected and selected.',
        details: `Searched for page: ${pageId}`
      }, { status: 404 });
    }

    const page = pages[0];
    console.log('[AI Generate] Using page:', { id: page.id, facebook_page_id: page.facebook_page_id, name: page.name });

    // Get conversations - query by sender_id or id depending on what was passed
    let conversationsQuery = supabase
      .from('messenger_conversations')
      .select('id, sender_id, sender_name, page_id')
      .eq('page_id', page.facebook_page_id);

    if (usesSenderIds) {
      conversationsQuery = conversationsQuery.in('sender_id', idsToUse);
      console.log('[AI Generate] Looking up conversations by sender_ids (PSIDs)');
    } else {
      conversationsQuery = conversationsQuery.in('id', idsToUse);
      console.log('[AI Generate] Looking up conversations by conversation IDs');
    }

    const { data: conversations, error: convError } = await conversationsQuery;

    console.log('[AI Generate] Conversations query:', { 
      usesSenderIds,
      idsCount: idsToUse.length,
      found: conversations?.length, 
      error: convError 
    });

    if (convError) {
      console.error('[AI Generate] Conversation error:', convError);
      return NextResponse.json({ error: 'Failed to fetch conversations', details: convError.message }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      console.error('[AI Generate] No conversations found. Page:', page.facebook_page_id, 'IDs:', idsToUse.slice(0, 3));
      return NextResponse.json({ 
        error: 'No conversations found for the selected contacts.',
        details: 'Ensure conversations are synced from Facebook first.',
        suggestion: 'Go to Conversations page, select the page, and click "Sync from Facebook"'
      }, { status: 404 });
    }

    console.log(`[AI Generate] Processing ${conversations.length} conversations`);

    // Fetch messages for each conversation from Facebook
    const conversationContexts = await Promise.all(
      conversations.map(async (conv) => {
        try {
          // Try to fetch messages from Facebook, but don't fail if it doesn't work
          let messages: Array<{ from: string; message: string; timestamp: string }> = [];
          
          try {
            // Fetch actual conversation messages from Facebook Messenger
            // Request 10 most recent messages explicitly
            const conversationUrl = `https://graph.facebook.com/v18.0/me/conversations?user_id=${conv.sender_id}&fields=messages.limit(10){from,message,created_time}&access_token=${page.access_token}`;
            console.log(`[AI Generate] Fetching up to 10 recent conversation messages for ${conv.sender_name} (${conv.id})`);
            
            const conversationResponse = await fetch(conversationUrl, {
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (conversationResponse.ok) {
              const conversationData = await conversationResponse.json();
              const conversation = conversationData.data?.[0];
              
              if (conversation?.messages?.data) {
                const messagesList = conversation.messages.data;
                console.log(`[AI Generate] ✅ Got ${messagesList.length} conversation messages for ${conv.sender_name}`);
                
                // Facebook returns messages in reverse chronological order (newest first)
                // Take up to 10 and reverse so oldest is first (better for AI to read chronologically)
                const recentMessages = messagesList.slice(0, 10);
                messages = recentMessages.reverse().map((msg: {
                  from: { id: string; name?: string };
                  message: string;
                  created_time: string;
                }) => ({
                  from: msg.from?.id === conv.sender_id ? 'user' : 'business',
                  message: msg.message || '(No text)',
                  timestamp: msg.created_time
                }));
                
                console.log(`[AI Generate] ✅ Prepared ${messages.length} messages in chronological order (oldest → newest) for AI to read`);
              }
            }
            
            // If conversations endpoint didn't work, try alternative approach
            if (messages.length === 0) {
              console.log(`[AI Generate] 🔄 Trying alternative API approach for ${conv.id}`);
              
              // Try getting messages directly from the PSID's messages endpoint
              // This gets the 10 most recent messages
              const messagesUrl = `https://graph.facebook.com/v18.0/${conv.sender_id}/messages?fields=from,message,created_time&access_token=${page.access_token}&limit=10`;
              const messagesResponse = await fetch(messagesUrl);
              
              if (messagesResponse.ok) {
                const messagesData = await messagesResponse.json();
                console.log(`[AI Generate] ✅ Alternative API got ${messagesData.data?.length || 0} messages`);
                
                if (messagesData.data && Array.isArray(messagesData.data) && messagesData.data.length > 0) {
                  // Facebook returns messages in reverse chronological order (newest first)
                  // Reverse to get chronological order (oldest → newest) for better AI reading
                  messages = messagesData.data.reverse().map((msg: {
                    from: { id: string; name?: string };
                    message: string;
                    created_time: string;
                  }) => ({
                    from: msg.from?.id === conv.sender_id ? 'user' : 'business',
                    message: msg.message || '(No text)',
                    timestamp: msg.created_time
                  }));
                  
                  console.log(`[AI Generate] ✅ Prepared ${messages.length} messages (alternative method) in chronological order`);
                }
              } else {
                const errorData = await messagesResponse.json().catch(() => ({}));
                console.warn(`[AI Generate] ⚠️ Alternative API returned ${messagesResponse.status}:`, errorData);
              }
            }
          } catch (fetchError) {
            console.warn(`[AI Generate] Could not fetch conversation messages for ${conv.id}:`, fetchError);
          }

          // If no messages fetched from Facebook, use our database info
          if (messages.length === 0) {
            console.log(`[AI Generate] Using database info for ${conv.id} - no Facebook history available`);
            
            // Use conversation data from our database
            messages = [
              {
                from: 'user',
                message: `Hi, I'm interested in your business`,
                timestamp: new Date().toISOString()
              },
              {
                from: 'business',
                message: `Hello! Thanks for reaching out. How can I help you today?`,
                timestamp: new Date().toISOString()
              }
            ];
            
            return {
              conversationId: conv.id,
              participantName: conv.sender_name || 'Customer',
              messages: messages,
              isFallback: true
            };
          }

          return {
            conversationId: conv.id,
            participantName: conv.sender_name || 'Customer',
            messages
          };
        } catch (error) {
          console.error(`[AI Generate] Error fetching messages for ${conv.id}:`, error);
          
          // Fallback: Generate something useful anyway
          return {
            conversationId: conv.id,
            participantName: conv.sender_name || 'Customer',
            messages: [
              {
                from: 'user',
                message: `Previous conversation with ${conv.sender_name || 'this customer'}`,
                timestamp: new Date().toISOString()
              }
            ],
            isFallback: true
          };
        }
      })
    );

    // Filter out null values, but include fallback contexts
    const validContexts = conversationContexts.filter((ctx): ctx is NonNullable<typeof ctx> => ctx !== null);

    // This should never happen now, but create manual fallbacks just in case
    if (validContexts.length === 0) {
      console.error('[AI Generate] No contexts - creating manual fallbacks for all conversations');
      
      // Create contexts from conversations directly
      conversations.forEach(conv => {
        validContexts.push({
          conversationId: conv.id,
          participantName: conv.sender_name || 'Customer',
          messages: [
            {
              from: 'user',
              message: 'Hi, I have a question about your services',
              timestamp: new Date().toISOString()
            },
            {
              from: 'business',
              message: 'Hello! I\'d be happy to help. What would you like to know?',
              timestamp: new Date().toISOString()
            }
          ],
          isFallback: true
        });
      });
      
      console.log(`[AI Generate] Created ${validContexts.length} manual fallback contexts`);
    }

    const fallbackCount = validContexts.filter((ctx: { isFallback?: boolean }) => ctx.isFallback).length;
    if (fallbackCount > 0) {
      console.warn(`[AI Generate] ${fallbackCount} conversations using fallback mode (limited history)`);
    }

    console.log(`[AI Generate] About to generate messages for ${validContexts.length} conversations`);
    console.log('[AI Generate] Sample context:', JSON.stringify(validContexts[0], null, 2));

    // Generate AI messages
    let generatedMessages;
    try {
      generatedMessages = await openRouterService.generateBatchMessages(
        validContexts,
        customInstructions || undefined
      );
      console.log(`[AI Generate] Successfully generated ${generatedMessages.length} messages`);
    } catch (aiError) {
      console.error('[AI Generate] OpenRouter API error:', aiError);
      
      // If AI completely fails, create simple messages
      generatedMessages = validContexts.map(ctx => ({
        conversationId: ctx.conversationId,
        participantName: ctx.participantName,
        generatedMessage: `Hi ${ctx.participantName}! I wanted to follow up with you. I'd love to help answer any questions you might have about our products or services. Is there anything I can assist you with today?`,
        reasoning: 'Fallback message due to AI service unavailability',
        timestamp: new Date().toISOString()
      }));
      
      console.log(`[AI Generate] Using ${generatedMessages.length} fallback messages due to AI error`);
    }

    // Store generated messages in database for reference
    const messagesToStore = generatedMessages.map(msg => ({
      conversation_id: msg.conversationId,
      generated_message: msg.generatedMessage,
      reasoning: msg.reasoning || null,
      created_by: userId,
      created_at: msg.timestamp
    }));

    const { error: insertError } = await supabase
      .from('ai_generated_messages')
      .insert(messagesToStore);

    if (insertError) {
      console.error('[AI Generate] Failed to store messages:', insertError);
      // Continue anyway - messages were generated
    }

    // Return conversation mapping for easier sender_id lookup
    const conversationMapping = conversations.map(c => ({ id: c.id, sender_id: c.sender_id }));

    return NextResponse.json({
      success: true,
      generated: generatedMessages.length,
      requested: idsToUse.length,
      fallbackCount,
      usesSenderIds,
      conversations: conversationMapping,
      messages: generatedMessages.map(msg => {
        // If using sender_ids, return sender_id as conversationId for easier mapping in frontend
        const conv = conversations.find(c => c.id === msg.conversationId);
        return {
          conversationId: usesSenderIds && conv ? conv.sender_id : msg.conversationId,
          participantName: msg.participantName,
          message: msg.generatedMessage,
          reasoning: msg.reasoning
        };
      }),
      ...(fallbackCount > 0 && {
        warning: `${fallbackCount} message(s) generated without full conversation history. These may be more generic.`
      })
    });

  } catch (error) {
    console.error('[AI Generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate messages' },
      { status: 500 }
    );
  }
}

/**
 * Get generated messages for conversations
 * GET /api/ai/generate-follow-ups?conversationId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: messages, error } = await supabase
      .from('ai_generated_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    return NextResponse.json({ messages: messages || [] });

  } catch (error) {
    console.error('[AI Generate GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

