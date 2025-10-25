import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tagId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, color } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify tag belongs to user
    const { data: existingTag, error: fetchError } = await supabase
      .from('tags')
      .select('id')
      .eq('id', tagId)
      .eq('created_by', userId)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Update tag
    const { data: tag, error } = await supabase
      .from('tags')
      .update({
        name: name.trim(),
        color: color || '#3B82F6'
      })
      .eq('id', tagId)
      .eq('created_by', userId)
      .select()
      .single();

    if (error) {
      console.error('[Tags API] Error updating tag:', error);
      return NextResponse.json(
        { error: 'Failed to update tag' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tag });

  } catch (error) {
    console.error('[Tags API] Caught error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update tag' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tagId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Verify tag belongs to user
    const { data: existingTag, error: fetchError } = await supabase
      .from('tags')
      .select('id')
      .eq('id', tagId)
      .eq('created_by', userId)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Delete tag (this will cascade delete conversation_tags due to foreign key)
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('created_by', userId);

    if (error) {
      console.error('[Tags API] Error deleting tag:', error);
      return NextResponse.json(
        { error: 'Failed to delete tag' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Tags API] Caught error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete tag' },
      { status: 500 }
    );
  }
}
