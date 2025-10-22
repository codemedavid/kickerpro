import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface BulkOpportunity {
  title: string;
  description?: string;
  contact_name: string;
  contact_id: string;
  page_id?: string;
  stage_id: string;
  value: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  status: 'open' | 'won' | 'lost';
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { opportunities } = await request.json() as { opportunities: BulkOpportunity[] };

    if (!opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
      return NextResponse.json({ error: 'No opportunities provided' }, { status: 400 });
    }

    const supabase = await createClient();

    console.log('[Bulk Opportunities API] Creating', opportunities.length, 'opportunities');

    // Prepare opportunities for insertion
    const opportunitiesToInsert = opportunities.map(opp => ({
      user_id: userId,
      title: opp.title,
      description: opp.description || null,
      contact_name: opp.contact_name,
      contact_id: opp.contact_id,
      page_id: opp.page_id || null,
      stage_id: opp.stage_id,
      value: opp.value,
      currency: opp.currency,
      probability: opp.probability,
      expected_close_date: opp.expected_close_date,
      status: opp.status
    }));

    // Bulk insert
    const { data: createdOpportunities, error } = await supabase
      .from('opportunities')
      .insert(opportunitiesToInsert)
      .select();

    if (error) {
      console.error('[Bulk Opportunities API] Insert error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create opportunities' },
        { status: 500 }
      );
    }

    console.log('[Bulk Opportunities API] Created', createdOpportunities?.length || 0, 'opportunities');

    return NextResponse.json({
      success: true,
      created: createdOpportunities?.length || 0,
      opportunities: createdOpportunities
    });
  } catch (error) {
    console.error('[Bulk Opportunities API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create opportunities' },
      { status: 500 }
    );
  }
}

