/**
 * AI-Powered Lead Scoring System
 * Analyzes conversations and assigns quality scores using BANT framework
 */

import {
  LeadScore,
  ConversationMessage,
  ConversationAnalysis,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG
} from '@/lib/config/lead-scoring-config';

/**
 * Analyze conversation and generate lead score using AI
 */
export async function scoreLeadQuality(
  contactName: string,
  messages: ConversationMessage[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): Promise<LeadScore> {
  const analysis = analyzeConversation(messages);
  
  // Build comprehensive prompt for AI
  const conversationHistory = messages
    .map(m => `${m.from === 'customer' ? contactName : 'Business'}: ${m.message}`)
    .join('\n');

  const prompt = buildScoringPrompt(contactName, conversationHistory, analysis, config);

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
            temperature: 0.4, // Consistent scoring
            topK: 40,
            topP: 0.9,
            maxOutputTokens: 1000
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('AI scoring failed');
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No AI response');
    }

    // Parse AI response
    const parsed = parseAIResponse(content);

    // Apply price shopper detection rules
    const isPriceShopper = detectPriceShopper(
      parsed.score,
      parsed.signals,
      analysis,
      config
    );

    return {
      conversationId: '',
      contactName,
      score: Math.min(100, Math.max(0, parsed.score)),
      quality: parsed.quality as 'Hot' | 'Warm' | 'Cold' | 'Unqualified',
      qualificationData: {
        hasBudget: parsed.budget || false,
        hasAuthority: parsed.authority || false,
        hasNeed: parsed.need || false,
        hasTimeline: parsed.timeline || false,
        engagementLevel: parsed.engagement || 'low'
      },
      signals: isPriceShopper 
        ? [...parsed.signals, '💰 Only asking about prices']
        : parsed.signals || [],
      reasoning: parsed.reasoning || '',
      recommendedAction: parsed.recommended_action || 'Follow up to gather more information'
    };

  } catch (error) {
    console.error('[Lead Scorer] Scoring error:', error);
    
    // Fallback: Basic scoring based on message count
    return generateFallbackScore(contactName, analysis, config);
  }
}

/**
 * Build the AI prompt for lead scoring
 */
function buildScoringPrompt(
  contactName: string,
  conversationHistory: string,
  analysis: ConversationAnalysis,
  config: ScoringConfig
): string {
  return `You are a sales qualification expert. Analyze this conversation and score the lead quality using the BANT framework (Budget, Authority, Need, Timeline) plus engagement signals.

CONVERSATION WITH ${contactName}:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${conversationHistory}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONVERSATION STATS:
- Total messages: ${analysis.messageCount}
- Customer responses: ${analysis.customerResponseCount}
- Business responses: ${analysis.businessResponseCount}
- Engagement: ${analysis.conversationLength > config.minEngagementForHot ? 'High' : analysis.conversationLength > config.minEngagementForWarm ? 'Medium' : 'Low'}

QUALIFICATION CRITERIA:

🔴 UNQUALIFIED (0-25 points):
- Only asked about price
- No follow-up questions
- Generic inquiry
- No specific needs mentioned
- Single message then ghosted

🟡 COLD LEAD (26-50 points):
- Asked basic questions
- Showed mild interest
- No urgency or timeline
- Vague about budget/needs
- Limited engagement

🟠 WARM LEAD (51-75 points):
- Discussed specific needs
- Mentioned quantities or requirements
- Multiple back-and-forth exchanges
- Some budget/timeline indicators
- Good engagement level

🔥 HOT LEAD (76-100 points):
- Ready to buy signals
- Discussed pricing AND requirements
- Mentioned specific quantities/timeline
- Asked about payment/delivery terms
- Decision maker indicators
- High engagement, quick responses

BUYING SIGNALS TO LOOK FOR:
✅ Mentioned specific quantities (e.g., "I need 50 units")
✅ Asked about bulk pricing or discounts
✅ Mentioned company/business name
✅ Discussed delivery location/timeline
✅ Asked about payment terms/methods
✅ Requested quote or proposal
✅ Mentioned budget range
✅ Asked technical/detailed questions
✅ Multiple follow-up questions
✅ Responsive and engaged

🚩 RED FLAGS (Price Shoppers):
❌ ONLY asked "how much?"
❌ No follow-up after price given
❌ Comparing prices without context
❌ No specific needs discussed
❌ Generic questions only
❌ Single message, no engagement

CRITICAL: Respond with ONLY valid JSON in this exact format:
{
  "score": 65,
  "quality": "Warm",
  "budget": true,
  "authority": false,
  "need": true,
  "timeline": false,
  "engagement": "medium",
  "signals": [
    "Mentioned specific quantity (50 units)",
    "Asked about bulk pricing",
    "Engaged in multiple exchanges"
  ],
  "reasoning": "Contact showed genuine interest by discussing specific quantities and asking about bulk pricing. However, no timeline or authority indicators yet. Good engagement with 5 messages.",
  "recommended_action": "Send detailed quote with bulk pricing. Ask about timeline and decision-making process."
}

Analyze the conversation now:`;
}

/**
 * Parse AI response JSON
 */
function parseAIResponse(response: string): any {
  try {
    let cleaned = response.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    return JSON.parse(cleaned);
  } catch (parseError) {
    console.warn('[Lead Scorer] Could not parse JSON response:', parseError);
    throw parseError;
  }
}

/**
 * Detect if lead is a price shopper based on rules
 */
function detectPriceShopper(
  score: number,
  signals: string[],
  analysis: ConversationAnalysis,
  config: ScoringConfig
): boolean {
  // Check if score is below threshold
  if (score >= config.priceShopperThreshold) {
    return false;
  }

  // Check message count
  if (analysis.customerResponseCount > config.priceShopperMessageLimit) {
    return false;
  }

  // Check for price-related keywords in signals
  const priceKeywords = ['price', 'how much', 'cost', 'magkano'];
  const hasPriceSignals = signals.some(signal =>
    priceKeywords.some(keyword => signal.toLowerCase().includes(keyword))
  );

  // In strict mode, be more aggressive
  if (config.strictPriceShopperMode) {
    return hasPriceSignals && analysis.customerResponseCount <= 2;
  }

  // Normal mode: require both low score and price signals
  return hasPriceSignals && score < config.priceShopperThreshold;
}

/**
 * Analyze conversation structure
 */
function analyzeConversation(messages: ConversationMessage[]): ConversationAnalysis {
  const messageCount = messages.length;
  const businessResponseCount = messages.filter(m => m.from !== 'customer').length;
  const customerResponseCount = messages.filter(m => m.from === 'customer').length;
  
  return {
    messages,
    messageCount,
    businessResponseCount,
    customerResponseCount,
    conversationLength: messageCount
  };
}

/**
 * Generate fallback score when AI fails
 */
function generateFallbackScore(
  contactName: string,
  analysis: ConversationAnalysis,
  config: ScoringConfig
): LeadScore {
  const fallbackScore = Math.min(
    100,
    analysis.messageCount * 10 + analysis.customerResponseCount * 5
  );
  
  const fallbackQuality = 
    fallbackScore >= 76 ? 'Hot' :
    fallbackScore >= 51 ? 'Warm' :
    fallbackScore >= 26 ? 'Cold' :
    'Unqualified';
  
  return {
    conversationId: '',
    contactName,
    score: fallbackScore,
    quality: fallbackQuality as 'Hot' | 'Warm' | 'Cold' | 'Unqualified',
    qualificationData: {
      hasBudget: false,
      hasAuthority: false,
      hasNeed: analysis.messageCount > config.minEngagementForWarm,
      hasTimeline: false,
      engagementLevel: 
        analysis.messageCount > config.minEngagementForHot ? 'high' :
        analysis.messageCount > config.minEngagementForWarm ? 'medium' :
        'low'
    },
    signals: [`${analysis.messageCount} messages exchanged`],
    reasoning: 'Basic scoring due to AI service error',
    recommendedAction: 'Review conversation manually'
  };
}

/**
 * Batch score multiple leads
 */
export async function batchScoreLeads(
  conversations: Array<{
    id: string;
    name: string;
    messages: ConversationMessage[];
  }>,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): Promise<LeadScore[]> {
  const scores: LeadScore[] = [];
  
  console.log(`[Lead Scorer] Scoring ${conversations.length} leads...`);
  
  for (const conv of conversations) {
    try {
      console.log(`[Lead Scorer] → Scoring ${conv.name} (${scores.length + 1}/${conversations.length})...`);
      const score = await scoreLeadQuality(conv.name, conv.messages, config);
      score.conversationId = conv.id;
      scores.push(score);
      
      console.log(`[Lead Scorer] ✅ ${conv.name}: ${score.quality} (${score.score}/100)`);
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`[Lead Scorer] ❌ Error scoring ${conv.name}:`, error);
      
      // Add fallback score on error
      const fallbackAnalysis = analyzeConversation(conv.messages);
      const fallbackScore = generateFallbackScore(conv.name, fallbackAnalysis, config);
      fallbackScore.conversationId = conv.id;
      scores.push(fallbackScore);
    }
  }
  
  console.log(`[Lead Scorer] ✅ COMPLETED: ${scores.length}/${conversations.length} leads scored`);
  
  return scores;
}

