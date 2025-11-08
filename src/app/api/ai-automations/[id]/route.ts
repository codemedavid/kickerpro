import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Get a specific AI automation rule
 * GET /api/ai-automations/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: rule, error } = await supabase
      .from('ai_automation_rules')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ rule });

  } catch (error) {
    console.error('[AI Automations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Update an AI automation rule
 * PATCH /api/ai-automations/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const supabase = await createClient();

    const { data: rule, error } = await supabase
      .from('ai_automation_rules')
      .update(body)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[AI Automations] Error updating rule:', error);
      return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
    }

    console.log('[AI Automations] Updated rule:', id);

    return NextResponse.json({ rule });

  } catch (error) {
    console.error('[AI Automations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Delete an AI automation rule
 * DELETE /api/ai-automations/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('ai_automation_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[AI Automations] Error deleting rule:', error);
      return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
    }

    console.log('[AI Automations] Deleted rule:', id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[AI Automations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



