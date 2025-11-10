import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';

/**
 * GET /api/pipeline/stages
 * Fetch all pipeline stages for the current user
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: stages, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('position', { ascending: true });

    if (error) {
      console.error('[Pipeline Stages API] Error fetching stages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      stages: stages || [] 
    });
  } catch (error) {
    console.error('[Pipeline Stages API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch pipeline stages' }, { status: 500 });
  }
}

/**
 * POST /api/pipeline/stages
 * Create a new pipeline stage
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, color, analysis_prompt, is_default, position } = body;

    if (!name || !analysis_prompt) {
      return NextResponse.json(
        { error: 'Name and analysis_prompt are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // If this is being marked as default, unmark any existing default stage
    if (is_default) {
      await supabase
        .from('pipeline_stages')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true);
    }

    // Get the max position if position not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const { data: maxStage } = await supabase
        .from('pipeline_stages')
        .select('position')
        .eq('user_id', userId)
        .order('position', { ascending: false })
        .limit(1)
        .single();
      
      finalPosition = maxStage ? maxStage.position + 1 : 0;
    }

    const { data: stage, error } = await supabase
      .from('pipeline_stages')
      .insert({
        user_id: userId,
        name,
        description: description || null,
        color: color || '#3b82f6',
        analysis_prompt,
        is_default: is_default || false,
        position: finalPosition
      })
      .select()
      .single();

    if (error) {
      console.error('[Pipeline Stages API] Error creating stage:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stage
    });
  } catch (error) {
    console.error('[Pipeline Stages API] Error:', error);
    return NextResponse.json({ error: 'Failed to create pipeline stage' }, { status: 500 });
  }
}

/**
 * PATCH /api/pipeline/stages
 * Update a pipeline stage
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, color, analysis_prompt, is_default, position, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // If this is being marked as default, unmark any existing default stage
    if (is_default) {
      await supabase
        .from('pipeline_stages')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true)
        .neq('id', id);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (analysis_prompt !== undefined) updateData.analysis_prompt = analysis_prompt;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (position !== undefined) updateData.position = position;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: stage, error } = await supabase
      .from('pipeline_stages')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Pipeline Stages API] Error updating stage:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stage
    });
  } catch (error) {
    console.error('[Pipeline Stages API] Error:', error);
    return NextResponse.json({ error: 'Failed to update pipeline stage' }, { status: 500 });
  }
}

/**
 * DELETE /api/pipeline/stages
 * Delete a pipeline stage (soft delete by setting is_active = false)
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stageId = searchParams.get('id');

    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if stage has opportunities
    const { data: opportunities, error: checkError } = await supabase
      .from('pipeline_opportunities')
      .select('id')
      .eq('stage_id', stageId)
      .limit(1);

    if (checkError) {
      console.error('[Pipeline Stages API] Error checking opportunities:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (opportunities && opportunities.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete stage with active opportunities. Move them first.' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('pipeline_stages')
      .update({ is_active: false })
      .eq('id', stageId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Pipeline Stages API] Error deleting stage:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Stage deleted successfully'
    });
  } catch (error) {
    console.error('[Pipeline Stages API] Error:', error);
    return NextResponse.json({ error: 'Failed to delete pipeline stage' }, { status: 500 });
  }
}

