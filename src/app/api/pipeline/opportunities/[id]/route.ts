import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// GET single opportunity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .eq('user_id', userId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    // Get activities
    const { data: activities } = await supabase
      .from('opportunity_activities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      opportunity,
      activities: activities || []
    });
  } catch (error) {
    console.error('[Opportunity GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunity' },
      { status: 500 }
    );
  }
}

// PATCH - Update opportunity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    // Get current opportunity for comparison
    const { data: oldOpportunity } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .eq('user_id', userId)
      .single();

    if (!oldOpportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    // Update opportunity
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update(body)
      .eq('id', opportunityId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Opportunity PATCH] Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Log value change if applicable
    if (body.value && body.value !== oldOpportunity.value) {
      await supabase
        .from('opportunity_activities')
        .insert({
          opportunity_id: opportunityId,
          activity_type: 'value_change',
          from_value: String(oldOpportunity.value),
          to_value: String(body.value),
          description: `Value changed from $${oldOpportunity.value} to $${body.value}`,
          created_by: userId
        });
    }

    // Log status change if applicable
    if (body.status && body.status !== oldOpportunity.status) {
      await supabase
        .from('opportunity_activities')
        .insert({
          opportunity_id: opportunityId,
          activity_type: 'status_change',
          from_value: oldOpportunity.status,
          to_value: body.status,
          description: `Status changed to ${body.status}`,
          created_by: userId
        });
    }

    return NextResponse.json({
      success: true,
      opportunity
    });
  } catch (error) {
    console.error('[Opportunity PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}

// DELETE - Delete opportunity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', opportunityId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Opportunity DELETE] Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Opportunity deleted successfully'
    });
  } catch (error) {
    console.error('[Opportunity DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete opportunity' },
      { status: 500 }
    );
  }
}

