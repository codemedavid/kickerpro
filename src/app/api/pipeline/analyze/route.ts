import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getUserIdFromCookies } from '@/lib/auth/cookies';
import OpenAI from 'openai';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build'
  });
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

/**
 * POST /api/pipeline/analyze
 * Analyze contacts in pipeline using AI with dual-prompt system
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { opportunity_ids } = body;

    if (!opportunity_ids || !Array.isArray(opportunity_ids) || opportunity_ids.length === 0) {
      return NextResponse.json(
        { error: 'opportunity_ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch global settings
    const { data: settings } = await supabase
      .from('pipeline_settings')
      .select('global_analysis_prompt')
      .eq('user_id', userId)
      .single();

    if (!settings || !settings.global_analysis_prompt) {
      return NextResponse.json(
        { error: 'Pipeline settings not configured. Please set up global analysis prompt first.' },
        { status: 400 }
      );
    }

    // Fetch all active stages
    const { data: stages, error: stagesError } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('position', { ascending: true });

    if (stagesError || !stages || stages.length === 0) {
      return NextResponse.json(
        { error: 'No pipeline stages found. Please create stages first.' },
        { status: 400 }
      );
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
      .in('id', opportunity_ids)
      .eq('user_id', userId);

    if (oppsError || !opportunities || opportunities.length === 0) {
      return NextResponse.json(
        { error: 'No valid opportunities found' },
        { status: 404 }
      );
    }

    const results = [];

    // Process each opportunity
    for (const opp of opportunities) {
      try {
        // Fetch conversation messages from Facebook
        const messagesResponse = await fetch(
          `${request.nextUrl.origin}/api/conversations/${opp.conversation_id}/messages`
        );

        let conversationHistory = 'No message history available.';
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          if (messagesData.messages && messagesData.messages.length > 0) {
            conversationHistory = messagesData.messages
              .map((msg: { from: string; fromName: string; message: string; timestamp: string }) =>
                `[${msg.timestamp}] ${msg.fromName} (${msg.from}): ${msg.message}`
              )
              .join('\n');
          }
        }
        
        console.log(`[Pipeline Analyze API] 📋 Contact: ${opp.sender_name}`);
        console.log(`[Pipeline Analyze API] 💬 Conversation history:`, conversationHistory);

        // Step 1: Global Analysis - Ask AI which stage the contact should be in
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

        const openai = getOpenAIClient();
        const globalResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a sales pipeline analyst. Analyze contacts and recommend appropriate stages based on conversation history.'
            },
            {
              role: 'user',
              content: globalPrompt
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        });

        const globalAnalysis: GlobalAnalysisResult = JSON.parse(
          globalResponse.choices[0].message.content || '{}'
        );
        
        console.log(`[Pipeline Analyze API] 🌐 Global AI recommendation:`, globalAnalysis.recommended_stage, `(confidence: ${globalAnalysis.confidence})`);

        // Step 2: Stage-Specific Analysis - Test each stage's specific criteria
        const stageAnalyses: StageAnalysisResult[] = [];

        for (const stage of stages) {
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

          const stageResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are analyzing if a contact meets the specific criteria for the "${stage.name}" stage.`
              },
              {
                role: 'user',
                content: stagePrompt
              }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' }
          });

          const stageAnalysis = JSON.parse(
            stageResponse.choices[0].message.content || '{}'
          );

          stageAnalyses.push({
            stage_id: stage.id,
            stage_name: stage.name,
            belongs: stageAnalysis.belongs || false,
            confidence: stageAnalysis.confidence || 0,
            reasoning: stageAnalysis.reasoning || ''
          });
          
          console.log(`[Pipeline Analyze API] 📍 Stage "${stage.name}": belongs=${stageAnalysis.belongs}, confidence=${stageAnalysis.confidence}`);
        }

        // Step 3: Decision Logic (improved)
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
          // Perfect match - Both agree!
          finalStageId = recommendedStage.id;
          bothAgreed = true;
          finalConfidence = Math.min(globalAnalysis.confidence, stageSpecificMatch.confidence);
        } else {
          // Check if ANY stage-specific analysis says "belongs=true"
          const anyStageMatch = stageAnalyses
            .filter(sa => sa.belongs)
            .sort((a, b) => b.confidence - a.confidence)[0]; // Get highest confidence match

          if (anyStageMatch) {
            // Use the stage-specific match even if global didn't recommend it
            finalStageId = anyStageMatch.stage_id;
            bothAgreed = false; // They didn't both agree on the same stage
            finalConfidence = anyStageMatch.confidence * 0.8; // Slightly lower confidence
            console.log(`[Pipeline Analyze] Using stage-specific match: ${anyStageMatch.stage_name} (confidence: ${anyStageMatch.confidence})`);
          } else {
            // No stage matched - move to default/unmatched stage
            const defaultStage = stages.find(s => s.is_default);
            finalStageId = defaultStage?.id || stages[stages.length - 1].id;
            bothAgreed = false;
            finalConfidence = 0;
            console.log(`[Pipeline Analyze] No stage matched, moving to default stage`);
          }
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
          const stageMatch = stageAnalyses.find(sa => sa.stage_id === finalStageId);
          let reason: string;
          
          if (bothAgreed) {
            reason = `AI analysis (both prompts agreed): ${globalAnalysis.reasoning}`;
          } else if (stageMatch && stageMatch.belongs) {
            reason = `AI stage-specific match: ${stageMatch.reasoning}`;
          } else {
            reason = 'No stage criteria matched - moved to default stage';
          }
          
          await supabase
            .from('pipeline_stage_history')
            .insert({
              opportunity_id: opp.id,
              from_stage_id: opp.stage_id,
              to_stage_id: finalStageId,
              moved_by: null,
              moved_by_ai: true,
              reason
            });
        }

        const finalStageName = stages.find(s => s.id === finalStageId)?.name || 'Unknown';
        const matchingStages = stageAnalyses.filter(sa => sa.belongs).map(sa => sa.stage_name);
        
        console.log(`[Pipeline Analyze API] 🎯 FINAL DECISION: "${finalStageName}"`);
        console.log(`[Pipeline Analyze API] ✅ Both agreed: ${bothAgreed}, Confidence: ${finalConfidence}`);
        console.log(`[Pipeline Analyze API] 📊 Matching stages:`, matchingStages.length > 0 ? matchingStages.join(', ') : 'None');
        
        results.push({
          opportunity_id: opp.id,
          contact_name: opp.sender_name,
          final_stage_id: finalStageId,
          both_agreed: bothAgreed,
          confidence: finalConfidence,
          global_recommendation: globalAnalysis.recommended_stage,
          stage_specific_matches: matchingStages
        });
      } catch (error) {
        console.error(`[Pipeline Analyze] Error analyzing opportunity ${opp.id}:`, error);
        results.push({
          opportunity_id: opp.id,
          contact_name: opp.sender_name,
          error: 'Failed to analyze contact'
        });
      }
    }

    return NextResponse.json({
      success: true,
      analyzed: results.length,
      results
    });
  } catch (error) {
    console.error('[Pipeline Analyze API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze pipeline opportunities' },
      { status: 500 }
    );
  }
}

