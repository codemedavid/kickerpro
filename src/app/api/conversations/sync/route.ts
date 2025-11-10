import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Facebook API settings
const FACEBOOK_API_LIMIT = 100;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pageId, facebookPageId } = body;

    if (!pageId || !facebookPageId) {
      return NextResponse.json(
        { error: 'Page ID required' },
        { status: 400 }
      );
    }

    console.log('[Sync Conversations] Syncing for page:', facebookPageId);

    // Get page access token and last sync time from database
    const supabase = await createClient();
    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('id, facebook_page_id, access_token, last_synced_at')
      .eq('id', pageId)
      .single();

    if (pageError || !page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const effectiveFacebookPageId = page.facebook_page_id;
    if (effectiveFacebookPageId !== facebookPageId) {
      console.warn('[Sync Conversations] Provided Facebook page ID does not match stored value. Using stored value instead.', {
        provided: facebookPageId,
        stored: effectiveFacebookPageId
      });
    }

      const syncedConversationIds = new Set<string>();
      let insertedCount = 0;
      let updatedCount = 0;
      const skippedCount = 0;
    let totalConversations = 0;
    let totalEventsCreated = 0;
    
    // Incremental sync: only fetch conversations updated since last sync
    const lastSyncTime = page.last_synced_at;
    const sinceParam = lastSyncTime ? `&since=${Math.floor(new Date(lastSyncTime).getTime() / 1000)}` : '';
    
    let nextUrl = `https://graph.facebook.com/v18.0/${effectiveFacebookPageId}/conversations?fields=participants,updated_time,messages{message,created_time,from}&limit=${FACEBOOK_API_LIMIT}${sinceParam}&access_token=${page.access_token}`;

    const syncMode = lastSyncTime ? 'incremental' : 'full';
    console.log(`[Sync Conversations] Starting ${syncMode} sync for page:`, facebookPageId);
    if (lastSyncTime) {
      console.log('[Sync Conversations] Only fetching conversations updated since:', lastSyncTime);
    }

    // Fetch all pages of conversations from Facebook
    while (nextUrl) {
      console.log('[Sync Conversations] Fetching batch...');
      const response = await fetch(nextUrl);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[Sync Conversations] Facebook API error:', error);
        throw new Error(error.error?.message || 'Failed to fetch conversations');
      }

      const data = await response.json();
      const conversations = data.data || [];
      totalConversations += conversations.length;
      
      console.log('[Sync Conversations] Processing batch of', conversations.length, 'conversations');

      // Prepare all conversation payloads and events in bulk
      const conversationPayloads: Array<{
        user_id: string;
        page_id: string;
        sender_id: string;
        sender_name: string;
        last_message_time: string;
        conversation_status: string;
      }> = [];
      
      const conversationToMessages = new Map<string, {
        messages: Array<{ message?: string; created_time?: string; from?: { id?: string } }>;
        lastTime: string;
        participantId: string;
      }>();

      // Extract all valid participants and their messages
      for (const conv of conversations) {
        const participants = conv.participants?.data || [];
        const lastTime = conv.updated_time || new Date().toISOString();
        const messages = conv.messages?.data || [];

        for (const participant of participants) {
          // Skip the page itself
          if (participant.id === effectiveFacebookPageId) continue;

          conversationPayloads.push({
            user_id: userId,
            page_id: effectiveFacebookPageId,
            sender_id: participant.id,
            sender_name: participant.name || 'Facebook User',
            last_message_time: lastTime,
            conversation_status: 'active'
          });

          // Store messages for later event creation
          conversationToMessages.set(`${effectiveFacebookPageId}-${participant.id}`, {
            messages,
            lastTime,
            participantId: participant.id
          });
        }
      }

      // Bulk upsert all conversations
      if (conversationPayloads.length > 0) {
        const attemptUpsert = async (onConflict: string) =>
          supabase
            .from('messenger_conversations')
            .upsert(conversationPayloads, { onConflict, ignoreDuplicates: false })
            .select('id, sender_id, page_id, created_at, updated_at');

        let { data: upsertedRows, error: upsertError } = await attemptUpsert('page_id,sender_id');

        if (upsertError && upsertError.code === '42P10') {
          console.warn('[Sync Conversations] Missing unique constraint for new key. Retrying with legacy key.');
          ({ data: upsertedRows, error: upsertError } = await attemptUpsert('user_id,page_id,sender_id'));
        }

        if (upsertError) {
          console.error('[Sync Conversations] Error bulk upserting conversations:', upsertError);
        } else if (upsertedRows) {
          // Collect all events for bulk insert
          const allEventsToInsert: Array<{
            user_id: string;
            conversation_id: string;
            sender_id: string;
            event_type: string;
            event_timestamp: string;
            channel: string;
            is_outbound: boolean;
            is_success: boolean;
            success_weight: number;
            metadata: Record<string, unknown>;
          }> = [];

          for (const row of upsertedRows) {
            syncedConversationIds.add(row.id);
            const isNewConversation = row.created_at === row.updated_at;
            
            if (isNewConversation) {
              insertedCount++;
              
              // Get messages for this conversation
              const key = `${row.page_id}-${row.sender_id}`;
              const messageData = conversationToMessages.get(key);
              
              if (messageData) {
                const { messages, lastTime, participantId } = messageData;
                
                // Process up to 25 most recent messages to establish activity patterns
                const recentMessages = messages.slice(0, 25);
                
                for (const msg of recentMessages) {
                  if (!msg.created_time) continue;
                  
                  const isFromPage = msg.from?.id === effectiveFacebookPageId;
                  const isFromContact = msg.from?.id === participantId;
                  
                  // Skip messages from unknown participants
                  if (!isFromPage && !isFromContact) continue;
                  
                  allEventsToInsert.push({
                    user_id: userId,
                    conversation_id: row.id,
                    sender_id: participantId,
                    event_type: isFromContact ? 'message_replied' : 'message_sent',
                    event_timestamp: msg.created_time,
                    channel: 'messenger',
                    is_outbound: isFromPage,
                    is_success: isFromContact,
                    success_weight: isFromContact ? 1.0 : 0.0,
                    metadata: {
                      source: 'initial_sync',
                      message_id: (msg as { id?: string }).id,
                      synced_at: new Date().toISOString()
                    }
                  });
                }
                
                // If no messages, create one default event
                if (recentMessages.length === 0) {
                  allEventsToInsert.push({
                    user_id: userId,
                    conversation_id: row.id,
                    sender_id: participantId,
                    event_type: 'message_replied',
                    event_timestamp: lastTime,
                    channel: 'messenger',
                    is_outbound: false,
                    is_success: true,
                    success_weight: 1.0,
                    metadata: {
                      source: 'initial_sync_fallback',
                      synced_at: new Date().toISOString()
                    }
                  });
                }
              }
            } else {
              updatedCount++;
            }
          }

          // Bulk insert all events at once
          if (allEventsToInsert.length > 0) {
            // Insert in chunks to avoid payload size limits
            const EVENTS_CHUNK_SIZE = 500;
            for (let i = 0; i < allEventsToInsert.length; i += EVENTS_CHUNK_SIZE) {
              const chunk = allEventsToInsert.slice(i, i + EVENTS_CHUNK_SIZE);
              const { error: eventsError } = await supabase
                .from('contact_interaction_events')
                .insert(chunk);
              
              if (eventsError) {
                console.error('[Sync Conversations] Error inserting events chunk:', eventsError);
              } else {
                totalEventsCreated += chunk.length;
              }
            }
          }
        }
      }

      // Check if there's a next page
      nextUrl = data.paging?.next || null;
      
      if (nextUrl) {
        console.log('[Sync Conversations] More conversations available, fetching next batch...');
      }
    }

    // Update last sync timestamp
    await supabase
      .from('facebook_pages')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', pageId);

    const uniqueSynced = syncedConversationIds.size;
    console.log(`[Sync Conversations] ${syncMode.toUpperCase()} sync completed! Total conversations from Facebook:`, totalConversations);
    console.log('[Sync Conversations] Successfully synced:', uniqueSynced, 'conversations', {
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
      eventsCreated: totalEventsCreated,
      mode: syncMode
    });

    return NextResponse.json({
      success: true,
      synced: uniqueSynced,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: totalConversations,
      eventsCreated: totalEventsCreated,
      syncMode: syncMode,
      computeContactTiming: insertedCount > 0,
      message: `${syncMode === 'incremental' ? 'Incremental' : 'Full'} sync: ${uniqueSynced} conversation(s) with ${totalEventsCreated} events`
    });
  } catch (error) {
    console.error('[Sync Conversations] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to sync conversations'
      },
      { status: 500 }
    );
  }
}
