import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { resetAutomationStopsForTags } from '@/lib/automation/reset-stops';

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

    const { data: accessiblePages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('facebook_page_id')
      .eq('user_id', userId);

    if (pagesError) {
      console.error('[Conversation Tags API] Error fetching accessible pages:', pagesError);
      return NextResponse.json(
        { error: 'Failed to verify page access' },
        { status: 500 }
      );
    }

    const accessiblePageIds = (accessiblePages || []).map((p: { facebook_page_id: string }) => p.facebook_page_id);

    if (accessiblePageIds.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify conversation belongs to accessible pages
    const { data: conversation, error: convError } = await supabase
      .from('messenger_conversations')
      .select('id')
      .eq('id', conversationId)
      .in('page_id', accessiblePageIds)
      .maybeSingle();

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

      // 🔄 Reset automation stops if any of these tags are trigger tags
      // This allows automations to restart when tags are manually re-added
      await resetAutomationStopsForTags([conversationId], tagIds);
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
