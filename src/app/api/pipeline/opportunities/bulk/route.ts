import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';
import { analyzePipelineOpportunities } from '@/lib/pipeline/analyze';
import { analyzeWithKeywordMatching } from '@/lib/pipeline/analyze-test-mode';

/**
 * POST /api/pipeline/opportunities/bulk
 * Add multiple contacts to the pipeline for AI analysis
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { conversation_ids } = body;

    if (!conversation_ids || !Array.isArray(conversation_ids) || conversation_ids.length === 0) {
      return NextResponse.json(
        { error: 'conversation_ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get or create default "Unmatched" stage
    const { data: defaultStage, error: stageError } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    let defaultStageId: string;

    // If no default stage exists, create one
    if (stageError || !defaultStage) {
      const { data: newStage, error: createError } = await supabase
        .from('pipeline_stages')
        .insert({
          user_id: userId,
          name: 'Unmatched',
          description: 'Contacts that need manual review or AI analysis',
          color: '#94a3b8', // slate-400
          analysis_prompt: 'Review this contact manually to determine the appropriate stage.',
          is_default: true,
          position: 999 // Put at the end
        })
        .select()
        .single();

      if (createError || !newStage) {
        console.error('[Pipeline Bulk API] Error creating default stage:', createError);
        return NextResponse.json(
          { error: 'Failed to create default stage' },
          { status: 500 }
        );
      }

      defaultStageId = newStage.id;
    } else {
      // TypeScript: defaultStage is guaranteed to be non-null here
      defaultStageId = defaultStage!.id;
    }

    // Fetch conversation details
    const { data: conversations, error: convError } = await supabase
      .from('messenger_conversations')
      .select('id, sender_id, sender_name')
      .in('id', conversation_ids)
      .eq('user_id', userId);

    if (convError) {
      console.error('[Pipeline Bulk API] Error fetching conversations:', convError);
      return NextResponse.json({ error: convError.message }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json(
        { error: 'No valid conversations found' },
        { status: 404 }
      );
    }

    // Check which conversations are already in pipeline
    const { data: existingOpps } = await supabase
      .from('pipeline_opportunities')
      .select('conversation_id')
      .eq('user_id', userId)
      .in('conversation_id', conversation_ids);

    const existingConvIds = new Set(existingOpps?.map(o => o.conversation_id) || []);

    // Prepare opportunities to insert (only new ones)
    const opportunitiesToInsert = conversations
      .filter(conv => !existingConvIds.has(conv.id))
      .map(conv => ({
        user_id: userId,
        conversation_id: conv.id,
        stage_id: defaultStageId,
        sender_id: conv.sender_id,
        sender_name: conv.sender_name,
        manually_assigned: false,
        both_prompts_agreed: null, // Will be set after AI analysis
        ai_confidence_score: null
      }));

    if (opportunitiesToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All selected contacts are already in the pipeline',
        added: 0,
        skipped: conversations.length
      });
    }

    // Insert opportunities
    const { data: insertedOpps, error: insertError } = await supabase
      .from('pipeline_opportunities')
      .insert(opportunitiesToInsert)
      .select();

    if (insertError) {
      console.error('[Pipeline Bulk API] Error inserting opportunities:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Create stage history entries
    if (insertedOpps && insertedOpps.length > 0) {
      const historyEntries = insertedOpps.map(opp => ({
        opportunity_id: opp.id,
        from_stage_id: null,
        to_stage_id: defaultStageId,
        moved_by: null,
        moved_by_ai: false,
        reason: 'Added to pipeline for analysis'
      }));

      await supabase
        .from('pipeline_stage_history')
        .insert(historyEntries);

      // Automatically trigger AI analysis to sort contacts into appropriate stages
      console.log('[Pipeline Bulk API] Triggering automatic AI analysis for', insertedOpps.length, 'new contacts');
      
      try {
        const opportunityIds = insertedOpps.map(opp => opp.id);
        
        // Try AI analysis first
        const analyzeResult = await analyzePipelineOpportunities(
          opportunityIds,
          userId,
          request.nextUrl.origin
        );

        if (analyzeResult.success && analyzeResult.analyzed > 0) {
          console.log('[Pipeline Bulk API] ✅ AI analysis completed:', analyzeResult.analyzed, 'contacts analyzed');
          
          return NextResponse.json({
            success: true,
            message: `Added ${opportunitiesToInsert.length} contact(s) to pipeline and automatically sorted to stages`,
            added: opportunitiesToInsert.length,
            skipped: existingConvIds.size,
            opportunities: insertedOpps,
            ai_analyzed: true,
            analysis_method: 'gemini_ai',
            analysis_results: analyzeResult.results
          });
        } else {
          console.warn('[Pipeline Bulk API] AI analysis failed or not configured:', analyzeResult.error);
          
          // If API quota exceeded, fall back to test mode (keyword matching)
          if (analyzeResult.error?.includes('quota') || analyzeResult.error?.includes('rate limit')) {
            console.log('[Pipeline Bulk API] 🧪 Falling back to TEST MODE (keyword matching)');
            
            const testResult = await analyzeWithKeywordMatching(opportunityIds, userId);
            
            if (testResult.success && testResult.analyzed > 0) {
              console.log('[Pipeline Bulk API] ✅ Test mode analysis completed:', testResult.analyzed, 'contacts analyzed');
              
              return NextResponse.json({
                success: true,
                message: `Added ${opportunitiesToInsert.length} contact(s) to pipeline and sorted using keyword matching (test mode)`,
                added: opportunitiesToInsert.length,
                skipped: existingConvIds.size,
                opportunities: insertedOpps,
                ai_analyzed: true,
                analysis_method: 'keyword_matching',
                test_mode: true,
                analysis_results: testResult.results
              });
            }
          }
          
          console.log('[Pipeline Bulk API] Contacts added to Unmatched stage');
        }
      } catch (error) {
        console.error('[Pipeline Bulk API] Error during automatic AI analysis:', error);
        
        // Try test mode as final fallback
        try {
          console.log('[Pipeline Bulk API] 🧪 Attempting test mode fallback');
          const opportunityIds = insertedOpps.map(opp => opp.id);
          const testResult = await analyzeWithKeywordMatching(opportunityIds, userId);
          
          if (testResult.success && testResult.analyzed > 0) {
            console.log('[Pipeline Bulk API] ✅ Test mode fallback successful');
            
            return NextResponse.json({
              success: true,
              message: `Added ${opportunitiesToInsert.length} contact(s) to pipeline and sorted using keyword matching (test mode)`,
              added: opportunitiesToInsert.length,
              skipped: existingConvIds.size,
              opportunities: insertedOpps,
              ai_analyzed: true,
              analysis_method: 'keyword_matching',
              test_mode: true,
              analysis_results: testResult.results
            });
          }
        } catch (testError) {
          console.error('[Pipeline Bulk API] Test mode also failed:', testError);
        }
        
        // Continue without AI analysis - contacts will remain in Unmatched stage
      }
    }

    return NextResponse.json({
      success: true,
      message: `Added ${opportunitiesToInsert.length} contact(s) to pipeline`,
      added: opportunitiesToInsert.length,
      skipped: existingConvIds.size,
      opportunities: insertedOpps,
      ai_analyzed: false
    });
  } catch (error) {
    console.error('[Pipeline Bulk API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add contacts to pipeline' },
      { status: 500 }
    );
  }
}

