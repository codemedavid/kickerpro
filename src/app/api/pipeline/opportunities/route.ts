import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * GET /api/pipeline/opportunities
 * Fetch all opportunities in the pipeline
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stageId = searchParams.get('stage_id');

    const supabase = await createClient();

    let query = supabase
      .from('pipeline_opportunities')
      .select(`
        *,
        stage:pipeline_stages(*),
        conversation:messenger_conversations(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (stageId) {
      query = query.eq('stage_id', stageId);
    }

    const { data: opportunities, error } = await query;

    if (error) {
      console.error('[Pipeline Opportunities API] Error fetching opportunities:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      opportunities: opportunities || []
    });
  } catch (error) {
    console.error('[Pipeline Opportunities API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunities' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipeline/opportunities
 * Add a conversation to the pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, stageId } = body;

    if (!conversationId || !stageId) {
      return NextResponse.json(
        { error: 'conversationId and stageId are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if conversation exists and belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('messenger_conversations')
      .select('id, sender_id, sender_name')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if conversation is already in pipeline
    const { data: existing } = await supabase
      .from('pipeline_opportunities')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'This contact is already in the pipeline' },
        { status: 400 }
      );
    }

    // Check if stage exists and belongs to user
    const { data: stage, error: stageError } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('id', stageId)
      .eq('user_id', userId)
      .single();

    if (stageError || !stage) {
      return NextResponse.json(
        { error: 'Stage not found' },
        { status: 404 }
      );
    }

    // Create opportunity
    const { data: opportunity, error: createError } = await supabase
      .from('pipeline_opportunities')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        stage_id: stageId,
        sender_id: conversation.sender_id,
        sender_name: conversation.sender_name,
        manually_assigned: true,
        manually_assigned_at: new Date().toISOString(),
        manually_assigned_by: userId,
        moved_to_stage_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('[Pipeline Opportunities API] Error creating opportunity:', createError);
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      opportunity
    });
  } catch (error) {
    console.error('[Pipeline Opportunities API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add contact to pipeline' },
      { status: 500 }
    );
  }
}

