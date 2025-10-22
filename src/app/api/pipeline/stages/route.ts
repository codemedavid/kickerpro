import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// GET all pipeline stages for user
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { data: stages, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('stage_order', { ascending: true });

    if (error) {
      console.error('[Pipeline Stages API] Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // If no stages exist, create default ones
    if (!stages || stages.length === 0) {
      console.log('[Pipeline Stages API] No stages found, creating defaults for user:', userId);
      
      const defaultStages = [
        { user_id: userId, name: 'New Lead', description: 'Fresh leads from Facebook Messenger', stage_order: 1, color: '#6366f1' },
        { user_id: userId, name: 'Contacted', description: 'Initial contact made', stage_order: 2, color: '#3b82f6' },
        { user_id: userId, name: 'Qualified', description: 'Lead is qualified and interested', stage_order: 3, color: '#06b6d4' },
        { user_id: userId, name: 'Proposal Sent', description: 'Proposal or quote sent', stage_order: 4, color: '#8b5cf6' },
        { user_id: userId, name: 'Negotiation', description: 'In negotiation phase', stage_order: 5, color: '#f59e0b' },
        { user_id: userId, name: 'Closed Won', description: 'Successfully closed deal', stage_order: 6, color: '#10b981' },
        { user_id: userId, name: 'Closed Lost', description: 'Lost the opportunity', stage_order: 7, color: '#ef4444' }
      ];

      const { data: createdStages, error: createError } = await supabase
        .from('pipeline_stages')
        .insert(defaultStages)
        .select();

      if (createError) {
        console.error('[Pipeline Stages API] Error creating defaults:', createError);
        return NextResponse.json(
          { error: createError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        stages: createdStages,
        created: true
      });
    }

    return NextResponse.json({
      success: true,
      stages: stages || []
    });
  } catch (error) {
    console.error('[Pipeline Stages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline stages' },
      { status: 500 }
    );
  }
}

// POST - Create new stage
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
    const { name, description, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Stage name is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get max stage_order
    const { data: maxStage } = await supabase
      .from('pipeline_stages')
      .select('stage_order')
      .eq('user_id', userId)
      .order('stage_order', { ascending: false })
      .limit(1)
      .single();

    const newOrder = (maxStage?.stage_order || 0) + 1;

    const { data: stage, error } = await supabase
      .from('pipeline_stages')
      .insert({
        user_id: userId,
        name,
        description: description || null,
        stage_order: newOrder,
        color: color || '#3b82f6'
      })
      .select()
      .single();

    if (error) {
      console.error('[Pipeline Stages API] Error creating stage:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stage
    });
  } catch (error) {
    console.error('[Pipeline Stages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create pipeline stage' },
      { status: 500 }
    );
  }
}

