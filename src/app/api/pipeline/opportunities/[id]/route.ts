import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getUserIdFromCookies } from '@/lib/auth/cookies';

/**
 * GET /api/pipeline/opportunities/[id]
 * Get details of a specific opportunity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: opportunity, error } = await supabase
      .from('pipeline_opportunities')
      .select(`
        *,
        stage:pipeline_stages(*),
        conversation:messenger_conversations(*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      opportunity
    });
  } catch (error) {
    console.error('[Pipeline Opportunity API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunity' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pipeline/opportunities/[id]
 * Update an opportunity (e.g., move to different stage, add notes)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { stage_id, notes, custom_data, manually_assigned } = body;

    const supabase = await createClient();

    // Get current opportunity
    const { data: currentOpp, error: fetchError } = await supabase
      .from('pipeline_opportunities')
      .select('stage_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentOpp) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (custom_data !== undefined) updateData.custom_data = custom_data;

    // If moving to a new stage
    if (stage_id && stage_id !== currentOpp.stage_id) {
      updateData.stage_id = stage_id;
      updateData.moved_to_stage_at = new Date().toISOString();
      
      if (manually_assigned) {
        updateData.manually_assigned = true;
        updateData.manually_assigned_at = new Date().toISOString();
        updateData.manually_assigned_by = userId;
      }
    }

    // Update opportunity
    const { data: opportunity, error: updateError } = await supabase
      .from('pipeline_opportunities')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('[Pipeline Opportunity API] Error updating opportunity:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If stage changed, create history entry
    if (stage_id && stage_id !== currentOpp.stage_id) {
      await supabase
        .from('pipeline_stage_history')
        .insert({
          opportunity_id: id,
          from_stage_id: currentOpp.stage_id,
          to_stage_id: stage_id,
          moved_by: manually_assigned ? userId : null,
          moved_by_ai: !manually_assigned,
          reason: manually_assigned ? 'Manually moved by user' : 'Moved by AI analysis'
        });
    }

    return NextResponse.json({
      success: true,
      opportunity
    });
  } catch (error) {
    console.error('[Pipeline Opportunity API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pipeline/opportunities/[id]
 * Remove an opportunity from the pipeline
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('pipeline_opportunities')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[Pipeline Opportunity API] Error deleting opportunity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Opportunity removed from pipeline'
    });
  } catch (error) {
    console.error('[Pipeline Opportunity API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete opportunity' },
      { status: 500 }
    );
  }
}

