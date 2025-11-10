import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message_id, tag_id } = body;

    if (!message_id || !tag_id) {
      return NextResponse.json(
        { error: 'message_id and tag_id are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify message belongs to user
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id')
      .eq('id', message_id)
      .eq('created_by', userId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Verify tag belongs to user
    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('id')
      .eq('id', tag_id)
      .eq('created_by', userId)
      .single();

    if (tagError || !tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Create or update auto-tag
    const { data: autoTag, error: insertError } = await supabase
      .from('message_auto_tags')
      .upsert({
        message_id,
        tag_id
      }, {
        onConflict: 'message_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Message Auto-tags API] Error creating auto-tag:', insertError);
      return NextResponse.json(
        { error: 'Failed to create auto-tag' },
        { status: 500 }
      );
    }

    return NextResponse.json({ autoTag });

  } catch (error) {
    console.error('[Message Auto-tags API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create auto-tag' },
      { status: 500 }
    );
  }
}
