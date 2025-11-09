import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface StageClassification {
  conversationId: string;
  contactName: string;
  recommendedStageId: string;
  recommendedStageName: string;
  probability: number;
  reasoning: string;
}

/**
 * Analyze conversations and recommend appropriate pipeline stages
 * POST /api/leads/classify-pipeline-stage
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

    // Get pipeline stages for this user
    const { data: stages, error: stagesError } = await supabase
      .from('pipeline_stages')
      .select('id, name, stage_order, description')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .order('stage_order', { ascending: true });

    if (stagesError || !stages || stages.length === 0) {
      return NextResponse.json(
        { error: 'No pipeline stages found. Please create stages first.' },
        { status: 404 }
      );
    }

    // Get page info
    const { data: page } = await supabase
      .from('facebook_pages')
      .select('facebook_page_id, access_token')
      .eq('user_id', effectiveUserId)
      .or(`id.eq.${pageId},facebook_page_id.eq.${pageId}`)
      .single();

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Get conversations
    const { data: conversations } = await supabase
      .from('messenger_conversations')
      .select('id, sender_id, sender_name, page_id')
      .in('id', conversationIds)
      .eq('page_id', page.facebook_page_id);

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ error: 'No conversations found' }, { status: 404 });
    }

    console.log(`[AI Stage Classifier] Analyzing ${conversations.length} conversations`);

    // Fetch and classify each conversation
    const classifications: StageClassification[] = [];

    for (const conv of conversations) {
      try {
        // Fetch conversation messages
        let messages: Array<{ from: string; message: string }> = [];

        try {
          const conversationUrl = `https://graph.facebook.com/v18.0/me/conversations?user_id=${conv.sender_id}&fields=messages.limit(10){from,message}&access_token=${page.access_token}`;
          const response = await fetch(conversationUrl);

          if (response.ok) {
            const data = await response.json();
            const conversation = data.data?.[0];
            
            if (conversation?.messages?.data) {
              messages = conversation.messages.data.reverse().map((msg: any) => ({
                from: msg.from?.id === conv.sender_id ? 'customer' : 'business',
                message: msg.message || '(No text)'
              }));
            }
          }
        } catch (fetchError) {
          console.warn(`[AI Stage Classifier] Could not fetch messages for ${conv.id}`);
        }

        // Use AI to analyze and classify
        const classification = await classifyConversationStage(
          conv.sender_name || 'Customer',
          messages,
          stages
        );

        classifications.push({
          conversationId: conv.id,
          contactName: conv.sender_name || 'Customer',
          recommendedStageId: classification.stageId,
          recommendedStageName: classification.stageName,
          probability: classification.probability,
          reasoning: classification.reasoning
        });

        console.log(`[AI Stage Classifier] ${conv.sender_name}: ${classification.stageName} (${classification.probability}%)`);

      } catch (error) {
        console.error(`[AI Stage Classifier] Error analyzing ${conv.id}:`, error);
        
        // Default to first stage on error
        classifications.push({
          conversationId: conv.id,
          contactName: conv.sender_name || 'Customer',
          recommendedStageId: stages[0].id,
          recommendedStageName: stages[0].name,
          probability: 25,
          reasoning: 'Default stage due to analysis error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      analyzed: classifications.length,
      stages: stages.map(s => ({ id: s.id, name: s.name })),
      classifications
    });

  } catch (error) {
    console.error('[AI Stage Classifier] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to classify stages' },
      { status: 500 }
    );
  }
}

/**
 * Use AI to classify conversation into appropriate pipeline stage
 */
async function classifyConversationStage(
  contactName: string,
  messages: Array<{ from: string; message: string }>,
  availableStages: Array<{ id: string; name: string; stage_order: number; description?: string }>
): Promise<{ stageId: string; stageName: string; probability: number; reasoning: string }> {
  
  const conversationHistory = messages.length > 0
    ? messages.map(m => `${m.from === 'customer' ? contactName : 'Business'}: ${m.message}`).join('\n')
    : `${contactName} has initiated contact but no detailed conversation history available.`;

  const stagesList = availableStages
    .map(s => `${s.stage_order}. ${s.name}${s.description ? ` - ${s.description}` : ''}`)
    .join('\n');

  const prompt = `You are a sales pipeline analyst. Analyze the following conversation and determine the most appropriate pipeline stage.

AVAILABLE PIPELINE STAGES:
${stagesList}

CONVERSATION WITH ${contactName}:
${conversationHistory}

CLASSIFICATION CRITERIA:
- Stage 1 (New Lead): Initial contact, just said hello, asked general question
- Stage 2 (Contacted): Had back-and-forth conversation, showing interest
- Stage 3 (Qualified): Discussed specific needs, quantities, budget, timeline
- Stage 4 (Proposal Sent): Requested quote, pricing, or proposal
- Stage 5 (Negotiation): Discussing terms, negotiating price/details
- Stage 6 (Closed Won): Deal done, payment discussed, confirmed purchase
- Stage 7 (Closed Lost): Not interested, went cold, chose competitor

PROBABILITY GUIDELINES:
- New Lead: 20-30% (just starting)
- Contacted: 40-50% (engaged but early)
- Qualified: 60-70% (serious interest)
- Proposal Sent: 75-80% (high intent)
- Negotiation: 85-90% (very close to closing)
- Closed Won: 100% (deal done)
- Closed Lost: 0% (lost opportunity)

Analyze the conversation depth, engagement level, specific details discussed, and buying signals.

CRITICAL: You must respond with ONLY valid JSON in this exact format:
{
  "stage_number": 1,
  "stage_name": "New Lead",
  "probability": 25,
  "reasoning": "Customer just initiated contact with a general inquiry. No specific needs discussed yet."
}`;

  try {
    // Call Google AI
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.9,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('AI classification failed');
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No AI response');
    }

    // Parse AI response
    let cleaned = content.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Find matching stage by order
    const matchingStage = availableStages.find(s => s.stage_order === parsed.stage_number);

    if (!matchingStage) {
      throw new Error('Stage not found');
    }

    return {
      stageId: matchingStage.id,
      stageName: matchingStage.name,
      probability: Math.min(100, Math.max(0, parsed.probability || 25)),
      reasoning: parsed.reasoning || 'AI analysis of conversation'
    };

  } catch (error) {
    console.error('[AI Stage Classifier] Classification error:', error);
    
    // Fallback: return first stage
    return {
      stageId: availableStages[0].id,
      stageName: availableStages[0].name,
      probability: 25,
      reasoning: 'Default stage assigned due to classification error'
    };
  }
}

