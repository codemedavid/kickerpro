import { createClient } from '@/lib/supabase/server';

interface AnalysisResult {
  opportunity_id: string;
  contact_name: string | null;
  final_stage_id: string;
  both_agreed: boolean;
  confidence: number;
  global_recommendation: string;
  stage_specific_matches: string[];
  error?: string;
}

/**
 * TEST MODE: Keyword-based sorting (no API calls)
 * Uses simple keyword matching to simulate AI analysis
 * Perfect for testing when API quota is exhausted
 */
export async function analyzeWithKeywordMatching(
  opportunityIds: string[],
  userId: string
): Promise<{
  success: boolean;
  analyzed: number;
  results: AnalysisResult[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Fetch stages
    const { data: stages } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('position', { ascending: true });

    if (!stages || stages.length === 0) {
      return {
        success: false,
        analyzed: 0,
        results: [],
        error: 'No pipeline stages found'
      };
    }

    // Fetch opportunities
    const { data: opportunities } = await supabase
      .from('pipeline_opportunities')
      .select(`
        id,
        conversation_id,
        sender_id,
        sender_name,
        stage_id,
        conversation:messenger_conversations(
          id,
          sender_id,
          sender_name,
          last_message,
          last_message_time,
          page_id
        )
      `)
      .in('id', opportunityIds)
      .eq('user_id', userId);

    if (!opportunities || opportunities.length === 0) {
      return {
        success: false,
        analyzed: 0,
        results: [],
        error: 'No opportunities found'
      };
    }

    const results: AnalysisResult[] = [];

    // Define keyword patterns for each stage
    const stageKeywords = {
      'New Lead': {
        keywords: ['info', 'information', 'curious', 'what do you', 'tell me', 'learn more', 'browsing', 'just looking', 'exploring', 'general', 'about your'],
        weight: 1.0
      },
      'Qualified': {
        keywords: ['price', 'pricing', 'cost', 'how much', 'interested', 'need', 'looking for', 'features', 'available', 'bulk', 'quantity', 'discount', 'package'],
        weight: 1.5
      },
      'Hot Lead': {
        keywords: ['buy', 'purchase', 'order', 'quote', 'ready', 'ASAP', 'urgent', 'need now', 'when can', 'delivery', 'ship', 'payment'],
        weight: 2.0
      }
    };

    // Analyze each opportunity
    for (const opp of opportunities) {
      try {
        const conversation = Array.isArray(opp.conversation) ? opp.conversation[0] : opp.conversation;
        const message = (conversation?.last_message || '').toLowerCase();

        // Score each stage based on keyword matches
        const stageScores: Array<{ stage: typeof stages[0]; score: number; matches: string[] }> = [];

        for (const stage of stages) {
          if (stage.is_default) continue; // Skip default stage

          const config = stageKeywords[stage.name as keyof typeof stageKeywords];
          if (!config) continue;

          const matches: string[] = [];
          let score = 0;

          for (const keyword of config.keywords) {
            if (message.includes(keyword.toLowerCase())) {
              matches.push(keyword);
              score += config.weight;
            }
          }

          if (matches.length > 0) {
            stageScores.push({ stage, score, matches });
          }
        }

        // Determine best stage
        let finalStageId: string;
        let confidence: number;
        let recommendedStageName: string;

        if (stageScores.length === 0) {
          // No keywords matched - go to default
          const defaultStage = stages.find(s => s.is_default) || stages[stages.length - 1];
          finalStageId = defaultStage.id;
          confidence = 0.5;
          recommendedStageName = defaultStage.name;
        } else {
          // Sort by score and pick highest
          stageScores.sort((a, b) => b.score - a.score);
          const winner = stageScores[0];
          
          finalStageId = winner.stage.id;
          recommendedStageName = winner.stage.name;
          
          // Calculate confidence based on match count and score gap
          const matchCount = winner.matches.length;
          const scoreGap = stageScores.length > 1 ? winner.score - stageScores[1].score : winner.score;
          
          confidence = Math.min(0.95, 0.6 + (matchCount * 0.1) + (scoreGap * 0.05));
        }

        // Update opportunity
        await supabase
          .from('pipeline_opportunities')
          .update({
            stage_id: finalStageId,
            ai_analyzed_at: new Date().toISOString(),
            ai_confidence_score: confidence,
            both_prompts_agreed: true,
            moved_to_stage_at: new Date().toISOString(),
            ai_analysis_result: {
              test_mode: true,
              method: 'keyword_matching',
              keyword_matches: stageScores.map(s => ({
                stage: s.stage.name,
                score: s.score,
                matches: s.matches
              }))
            }
          })
          .eq('id', opp.id);

        // Create history if stage changed
        if (finalStageId !== opp.stage_id) {
          await supabase
            .from('pipeline_stage_history')
            .insert({
              opportunity_id: opp.id,
              from_stage_id: opp.stage_id,
              to_stage_id: finalStageId,
              moved_by: null,
              moved_by_ai: true,
              reason: `Test mode: Keyword matching (confidence: ${confidence})`
            });
        }

        results.push({
          opportunity_id: opp.id,
          contact_name: opp.sender_name,
          final_stage_id: finalStageId,
          both_agreed: true,
          confidence,
          global_recommendation: recommendedStageName,
          stage_specific_matches: stageScores.map(s => s.stage.name)
        });

        console.log(`[Pipeline Test Mode] ✅ Analyzed ${opp.sender_name}: ${recommendedStageName}, confidence: ${confidence.toFixed(2)}`);

      } catch (error) {
        console.error(`[Pipeline Test Mode] Error analyzing ${opp.id}:`, error);
        results.push({
          opportunity_id: opp.id,
          contact_name: opp.sender_name,
          final_stage_id: opp.stage_id,
          both_agreed: false,
          confidence: 0,
          global_recommendation: '',
          stage_specific_matches: [],
          error: 'Analysis failed'
        });
      }
    }

    return {
      success: true,
      analyzed: results.length,
      results
    };

  } catch (error) {
    console.error('[Pipeline Test Mode] Error:', error);
    return {
      success: false,
      analyzed: 0,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


