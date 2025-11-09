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

