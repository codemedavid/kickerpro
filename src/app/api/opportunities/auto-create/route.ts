import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Auto-create opportunities for scored leads that don't have opportunities yet
 * POST /api/opportunities/auto-create
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    const body = await request.json();
    const { conversationIds, pageId, userId: bodyUserId } = body;

    // Use userId from body if not in cookies
    const effectiveUserId = userId || bodyUserId;

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'User ID required in body or cookies' }, { status: 400 });
    }

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: 'conversationIds array is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user's pipeline stages
    const { data: stages } = await supabase
      .from('pipeline_stages')
      .select('id, name, stage_order')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .order('stage_order', { ascending: true });

    if (!stages || stages.length === 0) {
      return NextResponse.json(
        { error: 'No pipeline stages found. Please create stages first.' },
        { status: 404 }
      );
    }

    const defaultStage = stages[0];

    // Get conversations with their scores
    const { data: conversations } = await supabase
      .from('messenger_conversations')
      .select('id, sender_id, sender_name, page_id')
      .in('id', conversationIds);

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ error: 'No conversations found' }, { status: 404 });
    }

    // Get latest scores for these conversations
    const { data: scores } = await supabase
      .from('lead_scores_history')
      .select('conversation_id, score, quality, reasoning')
      .in('conversation_id', conversationIds)
      .order('scored_at', { ascending: false });

    // Map latest score per conversation
    const scoreMap = new Map();
    scores?.forEach(score => {
      if (!scoreMap.has(score.conversation_id)) {
        scoreMap.set(score.conversation_id, score);
      }
    });

    // Check which contacts already have open opportunities
    const { data: existingOpportunities } = await supabase
      .from('opportunities')
      .select('contact_id')
      .eq('user_id', effectiveUserId)
      .eq('status', 'open')
      .in('contact_id', conversations.map(c => c.sender_id));

    const existingContactIds = new Set(existingOpportunities?.map(o => o.contact_id) || []);

    // Filter conversations that need opportunities
    const conversationsNeedingOpps = conversations.filter(
      conv => !existingContactIds.has(conv.sender_id)
    );

    console.log(`[Auto Create Opportunities] Found ${conversationsNeedingOpps.length} contacts without opportunities`);

    if (conversationsNeedingOpps.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: conversations.length,
        message: 'All selected contacts already have open opportunities'
      });
    }

    // Classify stages for conversations using AI
    let stageClassifications = new Map();
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const classifyResponse = await fetch(baseUrl + '/api/leads/classify-pipeline-stage', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationIds: conversationsNeedingOpps.map(c => c.id),
          pageId,
          userId: effectiveUserId
        })
      });

      if (classifyResponse.ok) {
        const classifyData = await classifyResponse.json();
        classifyData.classifications?.forEach((c: any) => {
          stageClassifications.set(c.conversationId, {
            stageId: c.recommendedStageId,
            probability: c.probability,
            reasoning: c.reasoning
          });
        });
      }
    } catch (error) {
      console.warn('[Auto Create Opportunities] Stage classification failed, using defaults:', error);
    }

    // Create opportunities
    const opportunitiesToCreate = conversationsNeedingOpps.map(conv => {
      const score = scoreMap.get(conv.id);
      const classification = stageClassifications.get(conv.id);
      
      // Determine probability based on quality/score
      let probability = 50; // default
      if (score) {
        if (score.quality === 'Hot') probability = 80;
        else if (score.quality === 'Warm') probability = 60;
        else if (score.quality === 'Cold') probability = 30;
        else probability = 10;
      }

      // Use AI classification if available, otherwise use defaults
      const stageId = classification?.stageId || defaultStage.id;
      const finalProbability = classification?.probability || probability;

      return {
        user_id: effectiveUserId,
        conversation_id: conv.id,
        page_id: conv.page_id,
        contact_name: conv.sender_name || 'Unknown Contact',
        contact_id: conv.sender_id,
        stage_id: stageId,
        title: (conv.sender_name || 'Unknown') + ' - ' + (score?.quality || 'New') + ' Lead',
        description: classification?.reasoning || score?.reasoning || 'Automatically created opportunity',
        value: 0,
        currency: 'USD',
        probability: finalProbability,
        expected_close_date: null,
        status: 'open'
      };
    });

    // Bulk insert opportunities
    const { data: createdOpportunities, error: createError } = await supabase
      .from('opportunities')
      .insert(opportunitiesToCreate)
      .select();

    if (createError) {
      console.error('[Auto Create Opportunities] Error:', createError);
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    // Log activities for created opportunities
    if (createdOpportunities && createdOpportunities.length > 0) {
      const activities = createdOpportunities.map(opp => ({
        opportunity_id: opp.id,
        activity_type: 'created',
        description: 'Opportunity automatically created from scored lead',
        created_by: effectiveUserId
      }));

      await supabase.from('opportunity_activities').insert(activities);
    }

    console.log(`[Auto Create Opportunities] Created ${createdOpportunities?.length || 0} opportunities`);

    return NextResponse.json({
      success: true,
      created: createdOpportunities?.length || 0,
      skipped: conversations.length - conversationsNeedingOpps.length,
      opportunities: createdOpportunities
    });

  } catch (error) {
    console.error('[Auto Create Opportunities] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create opportunities' },
      { status: 500 }
    );
  }
}

