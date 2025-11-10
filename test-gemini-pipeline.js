/**
 * Test Gemini Pipeline Integration
 * Run: node test-gemini-pipeline.js
 */

require('dotenv').config({ path: '.env.local' });

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

console.log('🧪 Testing Gemini Pipeline Integration\n');
console.log('═══════════════════════════════════════════════════════\n');

// Test 1: Check API Key
console.log('TEST 1: API Key Configuration');
console.log('─────────────────────────────────────────────────────');
if (!GEMINI_API_KEY) {
  console.error('❌ FAILED: GOOGLE_AI_API_KEY not found in .env.local');
  console.log('\n📝 To fix:');
  console.log('   1. Add GOOGLE_AI_API_KEY=your-key to .env.local');
  console.log('   2. Get key at: https://makersuite.google.com/app/apikey');
  process.exit(1);
}
console.log('✅ PASSED: API key found');
console.log(`   Key: ${GEMINI_API_KEY.substring(0, 10)}...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4)}`);
console.log('');

// Test 2: API Connection
console.log('TEST 2: Gemini API Connection');
console.log('─────────────────────────────────────────────────────');

const testPrompt = `Analyze this contact for pipeline stage placement.

Contact: Test User
Last Message: "Hi, I'm interested in your products"

Available Stages:
1. New Lead: Early exploration
2. Qualified: Showing interest

Which stage? Respond with JSON:
{
  "recommended_stage": "Stage Name",
  "reasoning": "Why",
  "confidence": 0.85
}`;

const systemInstruction = 'You are a sales pipeline analyst. Respond with valid JSON only.';

async function testGeminiAPI() {
  try {
    console.log('📡 Calling Gemini API...');
    
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
                  text: systemInstruction + '\n\n' + testPrompt
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
      throw new Error(`API Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      const finishReason = data.candidates?.[0]?.finishReason;
      throw new Error(`No content. Finish reason: ${finishReason}`);
    }

    console.log('✅ PASSED: API responded successfully');
    console.log('');

    // Test 3: JSON Parsing
    console.log('TEST 3: Response Format');
    console.log('─────────────────────────────────────────────────────');
    
    try {
      const parsed = JSON.parse(content);
      console.log('✅ PASSED: Valid JSON response');
      console.log('\n📊 Response:');
      console.log('   Recommended Stage:', parsed.recommended_stage);
      console.log('   Reasoning:', parsed.reasoning);
      console.log('   Confidence:', parsed.confidence);
      console.log('');

      // Test 4: Response Structure
      console.log('TEST 4: Response Structure');
      console.log('─────────────────────────────────────────────────────');
      
      const hasStage = !!parsed.recommended_stage;
      const hasReasoning = !!parsed.reasoning;
      const hasConfidence = typeof parsed.confidence === 'number';

      console.log(hasStage ? '✅' : '❌', 'Has recommended_stage');
      console.log(hasReasoning ? '✅' : '❌', 'Has reasoning');
      console.log(hasConfidence ? '✅' : '❌', 'Has confidence score');
      console.log('');

      if (hasStage && hasReasoning && hasConfidence) {
        console.log('✅ PASSED: Response structure is correct');
      } else {
        console.log('❌ FAILED: Missing required fields');
        return false;
      }

    } catch (parseError) {
      console.log('❌ FAILED: Response is not valid JSON');
      console.log('   Raw response:', content);
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.log('\n📝 Common issues:');
    console.log('   - Invalid API key');
    console.log('   - Rate limit exceeded');
    console.log('   - Network issues');
    console.log('   - API key not enabled for Gemini API');
    return false;
  }
}

// Test 5: Model Availability
console.log('TEST 5: Model Availability');
console.log('─────────────────────────────────────────────────────');
console.log(`Model: ${GEMINI_MODEL}`);
console.log('');

// Run all tests
(async () => {
  const success = await testGeminiAPI();

  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  if (success) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('\n🎉 Gemini pipeline integration is working!');
    console.log('\n🚀 Next steps:');
    console.log('   1. Configure pipeline settings in app');
    console.log('   2. Create pipeline stages with analysis prompts');
    console.log('   3. Test auto-sorting with real contacts');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('\n📝 To fix:');
    console.log('   1. Check your GOOGLE_AI_API_KEY in .env.local');
    console.log('   2. Verify key at: https://makersuite.google.com/app/apikey');
    console.log('   3. Ensure Gemini API is enabled');
    console.log('   4. Check API usage limits');
    console.log('');
    process.exit(1);
  }
})();

