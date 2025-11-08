import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Enable streaming
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('fb-auth-user')?.value;

        if (!userId) {
          send({ error: 'Not authenticated', status: 'error' });
          controller.close();
          return;
        }

        const body = await request.json();
        const { pageId, facebookPageId } = body;

        if (!pageId || !facebookPageId) {
          send({ error: 'Page ID required', status: 'error' });
          controller.close();
          return;
        }

        send({ status: 'starting', message: 'Initializing sync...' });

        const supabase = await createClient();
        const { data: page, error: pageError } = await supabase
          .from('facebook_pages')
          .select('id, facebook_page_id, access_token, name')
          .eq('id', pageId)
          .single();

        if (pageError || !page) {
          send({ error: 'Page not found', status: 'error' });
          controller.close();
          return;
        }

        send({ 
          status: 'fetching', 
          message: `Fetching conversations from ${page.name}...`,
          pageName: page.name
        });

        const effectiveFacebookPageId = page.facebook_page_id;
        const syncedConversationIds = new Set<string>();
        let insertedCount = 0;
        let updatedCount = 0;
        let totalConversations = 0;
        let batchNumber = 0;
        
        let nextUrl = `https://graph.facebook.com/v18.0/${effectiveFacebookPageId}/conversations?fields=participants,updated_time&limit=50&access_token=${page.access_token}`;

        // Fetch and process conversations with real-time updates
        while (nextUrl) {
          batchNumber++;
          send({ 
            status: 'processing', 
            message: `Fetching batch ${batchNumber}...`,
            batch: batchNumber
          });

          const response = await fetch(nextUrl);
          
          if (!response.ok) {
            const error = await response.json();
            send({ 
              error: error.error?.message || 'Failed to fetch conversations',
              status: 'error'
            });
            controller.close();
            return;
          }

          const data = await response.json();
          const conversations = data.data || [];
          totalConversations += conversations.length;
          
          send({ 
            status: 'processing', 
            message: `Processing ${conversations.length} conversations from batch ${batchNumber}...`,
            batch: batchNumber,
            conversationsInBatch: conversations.length,
            totalFetched: totalConversations
          });

          // Process each conversation
          for (const conv of conversations) {
            const participants = conv.participants?.data || [];
            const lastTime = conv.updated_time || new Date().toISOString();

            for (const participant of participants) {
              if (participant.id === effectiveFacebookPageId) continue;

              try {
                const payload = {
                  user_id: userId,
                  page_id: effectiveFacebookPageId,
                  sender_id: participant.id,
                  sender_name: participant.name || 'Facebook User',
                  last_message_time: lastTime,
                  conversation_status: 'active'
                };

                const { data: upsertedRows, error: upsertError } = await supabase
                  .from('messenger_conversations')
                  .upsert(payload, { 
                    onConflict: 'page_id,sender_id',
                    ignoreDuplicates: false 
                  })
                  .select('id, created_at, updated_at');

                if (upsertError) {
                  console.error('[Sync Stream] Upsert error:', upsertError);
                  continue;
                }

                if (upsertedRows && upsertedRows.length > 0) {
                  for (const row of upsertedRows) {
                    syncedConversationIds.add(row.id);
                    const isNew = row.created_at === row.updated_at;
                    if (isNew) {
                      insertedCount++;
                    } else {
                      updatedCount++;
                    }
                  }
                  
                  // Send real-time update every few conversations
                  if ((insertedCount + updatedCount) % 10 === 0) {
                    send({
                      status: 'syncing',
                      message: `Synced ${insertedCount + updatedCount} conversations...`,
                      inserted: insertedCount,
                      updated: updatedCount,
                      total: insertedCount + updatedCount
                    });
                  }
                }
              } catch (error) {
                console.error('[Sync Stream] Error:', error);
              }
            }
          }

          // Update after each batch
          send({
            status: 'batch_complete',
            message: `Batch ${batchNumber} complete`,
            batch: batchNumber,
            inserted: insertedCount,
            updated: updatedCount,
            total: insertedCount + updatedCount
          });

          nextUrl = data.paging?.next || null;
        }

        // Final summary
        send({
          status: 'complete',
          message: 'Sync completed!',
          inserted: insertedCount,
          updated: updatedCount,
          total: insertedCount + updatedCount,
          totalConversationsFetched: totalConversations,
          batches: batchNumber
        });

        controller.close();
      } catch (error) {
        send({ 
          error: error instanceof Error ? error.message : 'Sync failed',
          status: 'error'
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}




