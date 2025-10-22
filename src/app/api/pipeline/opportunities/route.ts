import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// GET all opportunities for user
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'open', 'won', 'lost'
    const stageId = searchParams.get('stageId');

    const supabase = await createClient();

    let query = supabase
      .from('opportunities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (stageId) {
      query = query.eq('stage_id', stageId);
    }

    const { data: opportunities, error } = await query;

    if (error) {
      console.error('[Opportunities API] Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      opportunities: opportunities || []
    });
  } catch (error) {
    console.error('[Opportunities API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunities' },
      { status: 500 }
    );
  }
}

// POST - Create new opportunity
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
    const {
      conversation_id,
      page_id,
      contact_name,
      contact_id,
      stage_id,
      title,
      description,
      value,
      currency,
      probability,
      expected_close_date
    } = body;

    if (!contact_name || !contact_id || !stage_id || !title || !page_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert({
        user_id: userId,
        conversation_id: conversation_id || null,
        page_id,
        contact_name,
        contact_id,
        stage_id,
        title,
        description: description || null,
        value: value || 0,
        currency: currency || 'USD',
        probability: probability || 0,
        expected_close_date: expected_close_date || null,
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      console.error('[Opportunities API] Error creating opportunity:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase
      .from('opportunity_activities')
      .insert({
        opportunity_id: opportunity.id,
        activity_type: 'created',
        description: `Opportunity "${title}" created`,
        created_by: userId
      });

    return NextResponse.json({
      success: true,
      opportunity
    });
  } catch (error) {
    console.error('[Opportunities API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create opportunity' },
      { status: 500 }
    );
  }
}

