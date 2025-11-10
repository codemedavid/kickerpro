import { createClient } from '@/lib/supabase/server';

// Google Gemini AI configuration
const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.0-flash-exp'; // Fast and capable model

async function callGeminiAPI(prompt: string, systemInstruction: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }

  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemInstruction + '\n\n' + prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json'
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    const finishReason = data.candidates?.[0]?.finishReason;
    throw new Error(`No content in Gemini response. Finish reason: ${finishReason || 'unknown'}`);
  }

  return content;
}

interface StageAnalysisResult {
  stage_id: string;
  stage_name: string;
  belongs: boolean;
  confidence: number;
  reasoning: string;
}

interface GlobalAnalysisResult {
  recommended_stage: string;
  reasoning: string;
  confidence: number;
}

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
 * Analyze pipeline opportunities using AI
 */
export async function analyzePipelineOpportunities(
  opportunityIds: string[],
  userId: string,
  requestOrigin?: string
): Promise<{
  success: boolean;
  analyzed: number;
  results: AnalysisResult[];
  error?: string;
}> {
  try {
    if (!opportunityIds || opportunityIds.length === 0) {
      return {
        success: false,
        analyzed: 0,
        results: [],
        error: 'No opportunity IDs provided'
      };
    }

    const supabase = await createClient();

    // Fetch global settings
    const { data: settings } = await supabase
      .from('pipeline_settings')
      .select('global_analysis_prompt')
      .eq('user_id', userId)
      .single();

    if (!settings || !settings.global_analysis_prompt) {
      console.log('[Pipeline Analyze] No global analysis prompt configured');
      return {
        success: false,
        analyzed: 0,
        results: [],
        error: 'Pipeline settings not configured'
      };
    }

    // Fetch all active stages
    const { data: stages, error: stagesError } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('position', { ascending: true });

    if (stagesError || !stages || stages.length === 0) {
      console.error('[Pipeline Analyze] Error fetching stages:', stagesError);
      return {
        success: false,
        analyzed: 0,
        results: [],
        error: 'No pipeline stages found'
      };
    }

    // Fetch opportunities with conversation details
    const { data: opportunities, error: oppsError } = await supabase
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

    if (oppsError || !opportunities || opportunities.length === 0) {
      console.error('[Pipeline Analyze] Error fetching opportunities:', oppsError);
      return {
        success: false,
        analyzed: 0,
        results: [],
        error: 'No valid opportunities found'
      };
    }

    const results: AnalysisResult[] = [];

    // Process each opportunity
    for (const opp of opportunities) {
      try {
        // For now, use a simple conversation history from the database
        // In a full implementation, you could fetch more messages from Facebook API
        const conversation = Array.isArray(opp.conversation) ? opp.conversation[0] : opp.conversation;
        const conversationHistory = conversation?.last_message 
          ? `Last message: ${conversation.last_message}`
          : 'No message history available.';

        // Step 1: Global Analysis
        const globalPrompt = `${settings.global_analysis_prompt}

CONTACT INFORMATION:
- Name: ${opp.sender_name || 'Unknown'}
- Facebook ID: ${opp.sender_id}

CONVERSATION HISTORY:
${conversationHistory}

AVAILABLE STAGES:
${stages.map((s, idx) => `${idx + 1}. ${s.name}: ${s.description || 'No description'}`).join('\n')}

Based on the global instructions and this contact's conversation history, which stage should this contact be in?
Respond ONLY with a JSON object in this exact format:
{
  "recommended_stage": "Stage Name",
  "reasoning": "Brief explanation",
  "confidence": 0.85
}`;

        const globalSystemInstruction = 'You are a sales pipeline analyst. Analyze contacts and recommend appropriate stages based on conversation history. You must respond with valid JSON only.';

        const globalResponseText = await callGeminiAPI(globalPrompt, globalSystemInstruction);
        
        const globalAnalysis: GlobalAnalysisResult = JSON.parse(globalResponseText);

        // Step 2: Stage-Specific Analysis
        const stageAnalyses: StageAnalysisResult[] = [];

        for (const stage of stages) {
          if (!stage.analysis_prompt) {
            // Skip stages without analysis prompts
            stageAnalyses.push({
              stage_id: stage.id,
              stage_name: stage.name,
              belongs: false,
              confidence: 0,
              reasoning: 'No analysis prompt configured'
            });
            continue;
          }

          const stagePrompt = `${stage.analysis_prompt}

CONTACT INFORMATION:
- Name: ${opp.sender_name || 'Unknown'}
- Facebook ID: ${opp.sender_id}

CONVERSATION HISTORY:
${conversationHistory}

Based on the specific criteria for the "${stage.name}" stage, does this contact belong in this stage?
Respond ONLY with a JSON object in this exact format:
{
  "belongs": true,
  "confidence": 0.90,
  "reasoning": "Brief explanation"
}`;

          const stageSystemInstruction = `You are analyzing if a contact meets the specific criteria for the "${stage.name}" stage. You must respond with valid JSON only.`;

          const stageResponseText = await callGeminiAPI(stagePrompt, stageSystemInstruction);
          const stageAnalysis = JSON.parse(stageResponseText);

          stageAnalyses.push({
            stage_id: stage.id,
            stage_name: stage.name,
            belongs: stageAnalysis.belongs || false,
            confidence: stageAnalysis.confidence || 0,
            reasoning: stageAnalysis.reasoning || ''
          });
        }

        // Step 3: Decision Logic
        const recommendedStage = stages.find(
          s => s.name.toLowerCase() === globalAnalysis.recommended_stage?.toLowerCase()
        );

        const stageSpecificMatch = recommendedStage
          ? stageAnalyses.find(sa => sa.stage_id === recommendedStage.id && sa.belongs)
          : null;

        let finalStageId: string;
        let bothAgreed: boolean;
        let finalConfidence: number;

        if (recommendedStage && stageSpecificMatch) {
          // Both agree!
          finalStageId = recommendedStage.id;
          bothAgreed = true;
          finalConfidence = Math.min(globalAnalysis.confidence, stageSpecificMatch.confidence);
        } else {
          // Disagreement - move to default/unmatched stage
          const defaultStage = stages.find(s => s.is_default);
          finalStageId = defaultStage?.id || stages[stages.length - 1].id;
          bothAgreed = false;
          finalConfidence = 0;
        }

        // Update opportunity with analysis results
        const { error: updateError } = await supabase
          .from('pipeline_opportunities')
          .update({
            stage_id: finalStageId,
            ai_analysis_result: {
              global_analysis: globalAnalysis,
              stage_analyses: stageAnalyses,
              final_decision: {
                stage_id: finalStageId,
                both_agreed: bothAgreed,
                confidence: finalConfidence
              }
            },
            ai_analyzed_at: new Date().toISOString(),
            ai_confidence_score: finalConfidence,
            both_prompts_agreed: bothAgreed,
            moved_to_stage_at: new Date().toISOString()
          })
          .eq('id', opp.id);

        if (updateError) {
          console.error('[Pipeline Analyze] Error updating opportunity:', updateError);
        }

        // Create stage history entry if stage changed
        if (finalStageId !== opp.stage_id) {
          await supabase
            .from('pipeline_stage_history')
            .insert({
              opportunity_id: opp.id,
              from_stage_id: opp.stage_id,
              to_stage_id: finalStageId,
              moved_by: null,
              moved_by_ai: true,
              reason: bothAgreed
                ? `AI analysis: ${globalAnalysis.reasoning}`
                : 'AI analysis disagreement - moved to unmatched'
            });
        }

        results.push({
          opportunity_id: opp.id,
          contact_name: opp.sender_name,
          final_stage_id: finalStageId,
          both_agreed: bothAgreed,
          confidence: finalConfidence,
          global_recommendation: globalAnalysis.recommended_stage,
          stage_specific_matches: stageAnalyses.filter(sa => sa.belongs).map(sa => sa.stage_name)
        });

        console.log(`[Pipeline Analyze] ✅ Analyzed ${opp.sender_name}: ${bothAgreed ? 'Agreed' : 'Disagreed'}, confidence: ${finalConfidence}`);

      } catch (error) {
        console.error(`[Pipeline Analyze] Error analyzing opportunity ${opp.id}:`, error);
        results.push({
          opportunity_id: opp.id,
          contact_name: opp.sender_name,
          final_stage_id: opp.stage_id,
          both_agreed: false,
          confidence: 0,
          global_recommendation: '',
          stage_specific_matches: [],
          error: 'Failed to analyze contact'
        });
      }
    }

    return {
      success: true,
      analyzed: results.length,
      results
    };
  } catch (error) {
    console.error('[Pipeline Analyze] Error:', error);
    return {
      success: false,
      analyzed: 0,
      results: [],
      error: error instanceof Error ? error.message : 'Failed to analyze pipeline opportunities'
    };
  }
}

