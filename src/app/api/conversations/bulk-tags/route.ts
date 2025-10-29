import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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
    const { conversationIds, tagIds, action = 'assign' } = body;

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: 'conversationIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: 'tagIds must be an array' },
        { status: 400 }
      );
    }

    if (!['assign', 'remove', 'replace'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be assign, remove, or replace' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: accessiblePages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('facebook_page_id')
      .eq('user_id', userId);

    if (pagesError) {
      console.error('[Bulk Tags API] Error fetching accessible pages:', pagesError);
      return NextResponse.json(
        { error: 'Failed to verify page access' },
        { status: 500 }
      );
    }

    const accessiblePageIds = (accessiblePages || []).map((p: { facebook_page_id: string }) => p.facebook_page_id);

    if (accessiblePageIds.length === 0) {
      return NextResponse.json(
        { error: 'No accessible pages found for user' },
        { status: 403 }
      );
    }

    // Verify all conversations belong to accessible pages
    const { data: conversations, error: convError } = await supabase
      .from('messenger_conversations')
      .select('id, page_id')
      .in('id', conversationIds)
      .in('page_id', accessiblePageIds);

    if (convError) {
      console.error('[Bulk Tags API] Error verifying conversations:', convError);
      return NextResponse.json(
        { error: 'Failed to verify conversations' },
        { status: 500 }
      );
    }

    if ((conversations || []).length !== conversationIds.length) {
      return NextResponse.json(
        { error: 'Some conversations not found or not accessible' },
        { status: 404 }
      );
    }

    // Verify all tags belong to user (if any tags specified)
    if (tagIds.length > 0) {
      const { data: tags, error: tagError } = await supabase
        .from('tags')
        .select('id')
        .eq('created_by', userId)
        .in('id', tagIds);

      if (tagError) {
        console.error('[Bulk Tags API] Error verifying tags:', tagError);
        return NextResponse.json(
          { error: 'Failed to verify tags' },
          { status: 500 }
        );
      }

      if (tags.length !== tagIds.length) {
        return NextResponse.json(
          { error: 'Some tags not found or not accessible' },
          { status: 404 }
        );
      }
    }

    let result;

    if (action === 'assign') {
      // Add tags to conversations (don't remove existing)
      if (tagIds.length > 0) {
        const assignments = [];
        for (const conversationId of conversationIds) {
          for (const tagId of tagIds) {
            assignments.push({
              conversation_id: conversationId,
              tag_id: tagId
            });
          }
        }

        const { error: insertError } = await supabase
          .from('conversation_tags')
          .upsert(assignments, { 
            onConflict: 'conversation_id,tag_id',
            ignoreDuplicates: true 
          });

        if (insertError) {
          console.error('[Bulk Tags API] Error assigning tags:', insertError);
          return NextResponse.json(
            { error: 'Failed to assign tags' },
            { status: 500 }
          );
        }
      }

      result = { 
        success: true, 
        message: `Assigned ${tagIds.length} tag(s) to ${conversationIds.length} conversation(s)` 
      };

    } else if (action === 'remove') {
      // Remove specific tags from conversations
      if (tagIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('conversation_tags')
          .delete()
          .in('conversation_id', conversationIds)
          .in('tag_id', tagIds);

        if (deleteError) {
          console.error('[Bulk Tags API] Error removing tags:', deleteError);
          return NextResponse.json(
            { error: 'Failed to remove tags' },
            { status: 500 }
          );
        }
      } else {
        // Remove all tags from conversations
        const { error: deleteError } = await supabase
          .from('conversation_tags')
          .delete()
          .in('conversation_id', conversationIds);

        if (deleteError) {
          console.error('[Bulk Tags API] Error removing all tags:', deleteError);
          return NextResponse.json(
            { error: 'Failed to remove tags' },
            { status: 500 }
          );
        }
      }

      result = { 
        success: true, 
        message: `Removed ${tagIds.length > 0 ? tagIds.length : 'all'} tag(s) from ${conversationIds.length} conversation(s)` 
      };

    } else if (action === 'replace') {
      // Replace all tags with new ones
      // First remove all existing tags
      await supabase
        .from('conversation_tags')
        .delete()
        .in('conversation_id', conversationIds);

      // Then add new tags
      if (tagIds.length > 0) {
        const assignments = [];
        for (const conversationId of conversationIds) {
          for (const tagId of tagIds) {
            assignments.push({
              conversation_id: conversationId,
              tag_id: tagId
            });
          }
        }

        const { error: insertError } = await supabase
          .from('conversation_tags')
          .insert(assignments);

        if (insertError) {
          console.error('[Bulk Tags API] Error replacing tags:', insertError);
          return NextResponse.json(
            { error: 'Failed to replace tags' },
            { status: 500 }
          );
        }
      }

      result = { 
        success: true, 
        message: `Replaced tags with ${tagIds.length} tag(s) for ${conversationIds.length} conversation(s)` 
      };
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Bulk Tags API] Caught error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process bulk tag operation' },
      { status: 500 }
    );
  }
}
