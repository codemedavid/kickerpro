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
    const { conversationIds, tagIds } = body;

    if (!Array.isArray(conversationIds) || !Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: 'conversationIds and tagIds must be arrays' },
        { status: 400 }
      );
    }

    if (conversationIds.length === 0 || tagIds.length === 0) {
      return NextResponse.json(
        { error: 'conversationIds and tagIds cannot be empty' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify all conversations belong to the user
    const { data: conversations, error: convError } = await supabase
      .from('messenger_conversations')
      .select('id')
      .in('id', conversationIds)
      .eq('user_id', userId);

    if (convError) {
      console.error('[Auto-tag API] Error verifying conversations:', convError);
      return NextResponse.json(
        { error: 'Failed to verify conversations' },
        { status: 500 }
      );
    }

    if (conversations.length !== conversationIds.length) {
      return NextResponse.json(
        { error: 'Some conversations not found or not accessible' },
        { status: 404 }
      );
    }

    // Verify all tags belong to the user
    const { data: tags, error: tagError } = await supabase
      .from('tags')
      .select('id')
      .in('id', tagIds)
      .eq('created_by', userId);

    if (tagError) {
      console.error('[Auto-tag API] Error verifying tags:', tagError);
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

    // Create tag assignments for all conversations
    const tagAssignments = [];
    for (const conversationId of conversationIds) {
      for (const tagId of tagIds) {
        tagAssignments.push({
          conversation_id: conversationId,
          tag_id: tagId
        });
      }
    }

    // Insert tag assignments (ignore conflicts for existing assignments)
    const { error: insertError } = await supabase
      .from('conversation_tags')
      .upsert(tagAssignments, {
        onConflict: 'conversation_id,tag_id',
        ignoreDuplicates: true
      });

    if (insertError) {
      console.error('[Auto-tag API] Error assigning tags:', insertError);
      return NextResponse.json(
        { error: 'Failed to assign tags' },
        { status: 500 }
      );
    }

    console.log('[Auto-tag API] Successfully tagged', conversationIds.length, 'conversations with', tagIds.length, 'tags');

    return NextResponse.json({
      success: true,
      tagged: conversationIds.length,
      tags: tagIds.length
    });

  } catch (error) {
    console.error('[Auto-tag API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto-tag conversations' },
      { status: 500 }
    );
  }
}
