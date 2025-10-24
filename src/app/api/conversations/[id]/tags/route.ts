import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { data: tags, error } = await supabase
      .from('conversation_tags')
      .select(`
        id,
        tag:tags(id, name, color)
      `)
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('[Conversation Tags API] Error fetching tags:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversation tags' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tags });

  } catch (error) {
    console.error('[Conversation Tags API] Caught error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch conversation tags' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tagIds } = body;

    if (!Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: 'tagIds must be an array' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('messenger_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Remove existing tags
    await supabase
      .from('conversation_tags')
      .delete()
      .eq('conversation_id', conversationId);

    // Add new tags
    if (tagIds.length > 0) {
      const tagAssignments = tagIds.map(tagId => ({
        conversation_id: conversationId,
        tag_id: tagId
      }));

      const { error: insertError } = await supabase
        .from('conversation_tags')
        .insert(tagAssignments);

      if (insertError) {
        console.error('[Conversation Tags API] Error assigning tags:', insertError);
        return NextResponse.json(
          { error: 'Failed to assign tags' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Conversation Tags API] Caught error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign tags' },
      { status: 500 }
    );
  }
}
