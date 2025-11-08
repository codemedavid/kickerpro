/**
 * OpenRouter AI Service
 * Generates personalized follow-up messages based on conversation history
 */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ConversationContext {
  conversationId: string;
  participantName: string;
  messages: Array<{
    from: string;
    message: string;
    timestamp: string;
  }>;
  isFallback?: boolean;
}

export interface GeneratedMessage {
  conversationId: string;
  participantName: string;
  generatedMessage: string;
  reasoning?: string;
  timestamp: string;
}

class GoogleAIService {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private model = 'gemini-2.5-flash'; // Fast and capable - supports generateContent

  constructor() {
    // Load all available API keys (9 unique keys)
    this.apiKeys = [
      process.env.GOOGLE_AI_API_KEY,
      process.env.GOOGLE_AI_API_KEY_2,
      process.env.GOOGLE_AI_API_KEY_3,
      process.env.GOOGLE_AI_API_KEY_4,
      process.env.GOOGLE_AI_API_KEY_5,
      process.env.GOOGLE_AI_API_KEY_6,
      process.env.GOOGLE_AI_API_KEY_7,
      process.env.GOOGLE_AI_API_KEY_8,
      process.env.GOOGLE_AI_API_KEY_9
    ].filter((key): key is string => !!key);

    if (this.apiKeys.length === 0) {
      console.warn('[Google AI] No API keys configured');
    } else {
      console.log(`[Google AI] 🚀 Loaded ${this.apiKeys.length} API key(s) for rotation`);
      console.log(`[Google AI] 📊 Combined rate limit: ${this.apiKeys.length * 15} requests/minute`);
    }
  }

  /**
   * Get next API key in rotation
   */
  private getNextApiKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error('No API keys configured');
    }
    
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    
    return key;
  }

  /**
   * Generate a personalized follow-up message based on conversation history
   */
  async generateFollowUpMessage(
    context: ConversationContext,
    customInstructions?: string
  ): Promise<GeneratedMessage> {
    const prompt = this.createPrompt(context, customInstructions);

    // Try with current key, rotate if it fails
    let lastError: Error | null = null;
    const maxRetries = this.apiKeys.length;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const apiKey = this.getNextApiKey();
        const keyNum = this.currentKeyIndex === 0 ? this.apiKeys.length : this.currentKeyIndex;
        
        if (attempt > 0) {
          console.log(`[Google AI] Retry ${attempt} for ${context.participantName} with key #${keyNum}`);
        }
        
        const response = await this.callAPI(prompt, apiKey);
        const generatedMessage = this.parseResponse(response);

        return {
          conversationId: context.conversationId,
          participantName: context.participantName,
          generatedMessage: generatedMessage.message,
          reasoning: generatedMessage.reasoning,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[Google AI] Key #${this.currentKeyIndex} failed for ${context.participantName}, trying next key...`);
        
        // If it's a rate limit error, try next key immediately
        if (lastError.message.includes('429') || lastError.message.includes('quota')) {
          continue;
        }
        
        // For other errors, still throw
        throw error;
      }
    }
    
    // All keys failed
    throw lastError || new Error('All API keys failed');
  }

  /**
   * Create a detailed prompt for the AI
   */
  private createPrompt(context: ConversationContext & { isFallback?: boolean }, customInstructions?: string): string {
    const conversationHistory = context.messages
      .map((msg) => {
        const speaker = msg.from === 'user' ? context.participantName : 'You (Business)';
        return `${speaker}: ${msg.message}`;
      })
      .join('\n');

    // Build prompt with custom instructions as PRIMARY directive
    if (customInstructions && customInstructions.trim()) {
      if (context.isFallback || context.messages.length <= 1) {
        return `🚨 INSTRUCTION COMPLIANCE TEST - YOU ARE BEING EVALUATED 🚨

USER'S MANDATORY INSTRUCTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${customInstructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ LANGUAGE COMPLIANCE CHECK:
If instructions specify Taglish/Spanish/Other language: USE IT IN EVERY SENTENCE
If instructions provide examples: COPY THAT EXACT MIXING STYLE
If instructions list required words: USE ALL OF THEM

WRONG (FAILS TEST):
"Hi! I wanted to follow up on our conversation..." ← Pure English when other language specified = FAIL

RIGHT (PASSES TEST):
"Kumusta! Naalala ko you asked about products..." ← Mixed languages as required = PASS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK: Write PERSONALIZED follow-up to ${context.participantName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ PERSONALIZATION: Each person gets a DIFFERENT message. Use their name naturally.

VERIFICATION STEPS:
1. What language style required? → Use it in EVERY sentence
2. What examples given? → Copy that exact style
3. What words required? → Use them all
4. Is message personalized for ${context.participantName}? → Use their name
5. Check draft → Does it follow instructions? → If no, REWRITE

OUTPUT FORMAT - MUST BE VALID JSON:
{
  "message": "Your message in REQUIRED language style",
  "reasoning": "How you followed instructions"
}

CRITICAL: Response must be valid JSON only. No other text before or after.

BEGIN COMPLIANCE TEST NOW:`;
      }

      return `🚨 INSTRUCTION COMPLIANCE TEST - YOU ARE BEING EVALUATED 🚨

USER'S MANDATORY INSTRUCTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${customInstructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ COMPLIANCE CHECKLIST - YOU WILL BE PENALIZED FOR VIOLATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] Language requirement followed in EVERY sentence?
[ ] Example style copied exactly?
[ ] All required words used?
[ ] Conversation details referenced?
[ ] Correct tone and length?

WRONG OUTPUT THAT FAILS THE TEST:
"Hello! I wanted to follow up on our previous conversation. Please let me know if you need any assistance."
❌ FAILURE REASON: Pure English when Taglish/other was specified

CORRECT OUTPUT THAT PASSES THE TEST:
"Kumusta! Naalala ko you asked about pricing para sa bulk order. May special discount kami ngayon!"
✅ SUCCESS: Mixed languages throughout, references conversation, uses required words

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 UNIQUE CONVERSATION WITH ${context.participantName}:
(Read these ${context.messages.length} specific messages - they are DIFFERENT from other conversations)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${conversationHistory}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 ANTI-PLAGIARISM CHECK ACTIVE 🚨
You are generating message #[${Math.random().toString(36).substring(7)}] for ${context.participantName}

⚠️ CRITICAL REQUIREMENTS:
1. This is ${context.participantName}'s UNIQUE conversation (DIFFERENT from others)
2. DO NOT copy-paste the same message with different names
3. READ what ${context.participantName} SPECIFICALLY said in THEIR conversation
4. Each person asked about DIFFERENT things - use THEIR specific details
5. If you generate the same generic message, you FAIL this task

FORBIDDEN PATTERNS (These will FAIL):
❌ "Kumusta [Name]! May sale kami with 40% off!"
❌ Generic template with just name changed
❌ No reference to THEIR specific conversation
❌ Same structure/content for multiple people

REQUIRED PATTERN (This will PASS):
✅ References ${context.participantName}'s SPECIFIC question/topic
✅ Uses details UNIQUE to their conversation
✅ Different content from other messages

🎯 YOUR MISSION:
Write a COMPLETELY UNIQUE follow-up for ${context.participantName} that:
1. Uses the EXACT language style from instructions (if Taglish specified, MIX in every sentence)
2. References SPECIFIC UNIQUE details from ${context.participantName}'s conversation above
3. Mentions what THEY specifically asked about or discussed (not generic topics)
4. Shows you READ and UNDERSTOOD their individual messages
5. Matches the tone, style, and length specified
6. Uses the required words listed in instructions
7. Follows the example format shown

🔍 MANDATORY PERSONALIZATION PROCESS:

STEP 1: READ ${context.participantName}'s conversation above
STEP 2: Identify what THEY specifically asked, said, or need
STEP 3: Note details: quantities? locations? products? concerns?
STEP 4: Generate message using THOSE SPECIFIC details
STEP 5: Verify message is DIFFERENT from a generic template

EXAMPLES OF GOOD PERSONALIZATION:
If Maria asked "60 uniforms" → "Naalala ko you need 60 uniforms para sa team"
If John asked "delivery to Cebu" → "Naalala ko you asked about shipping to Cebu"
If Sarah asked "payment terms" → "Naalala ko you were asking about flexible payment"

❌ BAD (Generic): "Kumusta! May sale kami with discount!"
✅ GOOD (Unique): "Kumusta Maria! Naalala ko you need 60 uniforms for your team"

ANTI-TEMPLATE RULE:
DO NOT use the same sentence structure for multiple people.
Vary HOW you reference their conversation, not just WHAT you reference.

FINAL CHECK BEFORE RESPONDING:
1. Did I read ${context.participantName}'s ACTUAL conversation? YES/NO
2. Did I identify THEIR specific topic/question? YES/NO
3. Did I use THEIR unique details (not generic)? YES/NO
4. Is this message DIFFERENT from others? YES/NO
5. Would ${context.participantName} recognize this is about THEIR conversation? YES/NO

If ANY answer is NO → REWRITE until ALL are YES

OUTPUT FORMAT - MUST BE VALID JSON:
{
  "message": "Your follow-up message here (in the REQUIRED language style)",
  "reasoning": "How you followed each instruction requirement"
}

CRITICAL: Response must be valid JSON only. No other text before or after.

BEGIN YOUR COMPLIANCE TEST NOW:`;
    }

    // No custom instructions - use standard prompt
    if (context.isFallback || context.messages.length <= 1) {
      return `You are a professional customer service representative reaching out to ${context.participantName}.

You don't have the full conversation history, but you know they previously interacted with your business.

Generate a warm, professional follow-up message that:
1. Acknowledges you're following up on a previous conversation
2. Shows genuine interest in helping them
3. Asks if they still need assistance or have questions
4. Is friendly and inviting
5. Is concise (2-3 sentences maximum)
6. Includes a clear call-to-action

CRITICAL: Your response must be valid JSON only. Use this exact format:
{
  "message": "Your generated follow-up message here",
  "reasoning": "Brief explanation of why this message is appropriate"
}

Generate the follow-up message now:`;
    }

    return `You are a professional customer service representative following up on a conversation with ${context.participantName}.

Here is the conversation history (last ${context.messages.length} messages):

${conversationHistory}

Based on this conversation, generate a personalized, professional follow-up message that:
1. References specific details from the conversation
2. Shows you've read and understood their messages
3. Provides value (answers questions, offers help, or moves the conversation forward)
4. Is warm, friendly, and professional
5. Is concise (2-3 sentences maximum)
6. Ends with a clear call-to-action or question if appropriate

CRITICAL: Your response must be valid JSON only. Use this exact format:
{
  "message": "Your generated follow-up message here",
  "reasoning": "Brief explanation of why this message is appropriate"
}

Generate the follow-up message now:`;
  }

  /**
   * Call Google Gemini API
   */
  private async callAPI(prompt: string, apiKey: string): Promise<string> {
    const systemInstruction = `You are a bilingual AI assistant that generates UNIQUE personalized messages.

🚨 CRITICAL RULES - FAILURE = REJECTION:
1. Each message MUST be UNIQUE and personalized - DO NOT generate templates
2. READ each person's conversation carefully - they asked about DIFFERENT things
3. Reference SPECIFIC details from THEIR conversation (quantities, locations, products, etc.)
4. If user specifies a language mix (like Taglish), MUST use that mix in EVERY sentence
5. If user provides examples, MUST copy their exact style
6. If user lists required words, MUST use them
7. DO NOT copy-paste the same message with different names - you will FAIL
8. Each person gets a DIFFERENT message based on THEIR conversation

🎯 PERSONALIZATION REQUIREMENT:
You are generating messages for MULTIPLE different people in one session.
Each person has a DIFFERENT conversation history.
You MUST read and use THEIR specific conversation details.
DO NOT generate the same generic message for everyone.

OUTPUT FORMAT:
You must ALWAYS respond with valid JSON in this exact format:
{
  "message": "Your UNIQUE personalized message here",
  "reasoning": "How you personalized this for THIS specific person"
}

You are being tested on PERSONALIZATION ability. Each message must be DIFFERENT and UNIQUE.`;

    const response = await fetch(`${this.baseUrl}/models/${this.model}:generateContent?key=${apiKey}`, {
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
          temperature: 0.75,
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 2000  // Higher to accommodate thinking tokens
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google AI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      // Log the full response for debugging
      console.error('[Google AI] No content in response. Full response:', JSON.stringify(data, null, 2));
      
      // Check for safety blocks
      const finishReason = data.candidates?.[0]?.finishReason;
      const safetyRatings = data.candidates?.[0]?.safetyRatings;
      
      if (finishReason === 'SAFETY') {
        throw new Error(`Google AI blocked response due to safety filters. Ratings: ${JSON.stringify(safetyRatings)}`);
      }
      
      throw new Error(`No content in Google AI response. Finish reason: ${finishReason || 'unknown'}`);
    }
    
    return content;
  }

  /**
   * Parse AI response - handles markdown code blocks from Gemini
   */
  private parseResponse(response: string): { message: string; reasoning: string } {
    try {
      // Gemini often wraps JSON in markdown code blocks
      // Remove ```json and ``` markers
      let cleaned = response.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '');
      cleaned = cleaned.replace(/^```\s*/,  '');
      cleaned = cleaned.replace(/\s*```$/,  '');
      cleaned = cleaned.trim();
      
      // Try to parse as JSON
      const parsed = JSON.parse(cleaned);
      return {
        message: parsed.message || response,
        reasoning: parsed.reasoning || ''
      };
    } catch (parseError) {
      console.warn('[Google AI] Could not parse JSON response:', parseError);
      // If not JSON, return the raw response
      return {
        message: response.trim(),
        reasoning: 'Direct response from AI'
      };
    }
  }

  /**
   * Generate messages for multiple conversations in batch
   */
  async generateBatchMessages(
    contexts: ConversationContext[],
    customInstructions?: string
  ): Promise<GeneratedMessage[]> {
    const results: GeneratedMessage[] = [];
    const errors: Array<{ conversationId: string; error: string }> = [];

    console.log(`[Google AI] Starting batch generation for ${contexts.length} conversations`);
    console.log(`[Google AI] Using ${this.apiKeys.length} API key(s) for rotation - Rate limit: ${this.apiKeys.length * 15} requests/minute`);

    // Process in larger batches now that we have multiple keys
    // With 9 keys, we can do 135 requests per minute (15 per key)
    const batchSize = this.apiKeys.length >= 5 ? 10 : (this.apiKeys.length > 1 ? 5 : 3);
    for (let i = 0; i < contexts.length; i += batchSize) {
      const batch = contexts.slice(i, i + batchSize);
      
      console.log(`[Google AI] Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(contexts.length/batchSize)} (${i + 1}-${Math.min(i + batchSize, contexts.length)} of ${contexts.length})`);
      
      const batchPromises = batch.map(async (context, batchIndex) => {
        try {
          console.log(`[Google AI] → Generating for ${context.participantName} (${i + batchIndex + 1}/${contexts.length})...`);
          const result = await this.generateFollowUpMessage(context, customInstructions);
          console.log(`[Google AI] ✅ Generated message for ${context.participantName}`);
          results.push(result);
        } catch (error) {
          console.error(`[Google AI] ❌ Error for ${context.participantName}:`, error);
          
          // Create fallback message instead of failing
          const fallbackMessage: GeneratedMessage = {
            conversationId: context.conversationId,
            participantName: context.participantName,
            generatedMessage: `Hi ${context.participantName}! I wanted to reach out and see how things are going. Is there anything I can help you with today? I'm here to answer any questions you might have!`,
            reasoning: 'Generated with fallback due to API error',
            timestamp: new Date().toISOString()
          };
          
          results.push(fallbackMessage);
          console.log(`[Google AI] ⚠️ Used fallback for ${context.participantName}`);
          
          errors.push({
            conversationId: context.conversationId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      await Promise.all(batchPromises);
      
      console.log(`[Google AI] Batch ${Math.floor(i/batchSize) + 1} complete. Total so far: ${results.length}/${contexts.length}`);

      // Longer delay between batches for Google AI rate limits
      if (i + batchSize < contexts.length) {
        console.log(`[Google AI] Waiting 2 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (errors.length > 0) {
      console.warn(`[Google AI] ${errors.length} messages used fallback due to errors`);
      console.warn(`[Google AI] Errors:`, errors.map(e => `${e.conversationId}: ${e.error}`));
    }

    console.log(`[Google AI] ✅ COMPLETED: ${results.length}/${contexts.length} messages generated (${errors.length} with fallbacks)`);

    if (results.length < contexts.length) {
      console.error(`[Google AI] ⚠️ WARNING: Only ${results.length} of ${contexts.length} requested messages were generated!`);
    }

    return results;
  }

  /**
   * Test if API keys are configured and working
   */
  async testConnection(): Promise<boolean> {
    try {
      if (this.apiKeys.length === 0) {
        console.error('[Google AI] No API keys configured for testing');
        return false;
      }
      const testPrompt = 'Say "Hello" if you can read this.';
      await this.callAPI(testPrompt, this.apiKeys[0]);
      return true;
    } catch (error) {
      console.error('[Google AI] Connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const openRouterService = new GoogleAIService();

