import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { data: tags, error } = await supabase
      .from('tags')
      .select('*')
      .eq('created_by', userId)
      .order('name');

    if (error) {
      console.error('[Tags API] Error fetching tags:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tags' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tags });

  } catch (error) {
    console.error('[Tags API] Caught error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

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
    const { name, color = '#3B82F6' } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        name: name.trim(),
        color,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('[Tags API] Error creating tag:', error);
      return NextResponse.json(
        { error: 'Failed to create tag' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tag });

  } catch (error) {
    console.error('[Tags API] Caught error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create tag' },
      { status: 500 }
    );
  }
}
