import { NextResponse } from 'next/server';

/**
 * Test AI API connectivity
 * GET /api/ai/test
 */
export async function GET() {
  const apiKeys = [
    process.env.GOOGLE_AI_API_KEY,
    process.env.GOOGLE_AI_API_KEY_2,
    process.env.GOOGLE_AI_API_KEY_3,
    process.env.GOOGLE_AI_API_KEY_4,
    process.env.GOOGLE_AI_API_KEY_5,
    process.env.GOOGLE_AI_API_KEY_6,
    process.env.GOOGLE_AI_API_KEY_7,
    process.env.GOOGLE_AI_API_KEY_8,
    process.env.GOOGLE_AI_API_KEY_9
  ].filter(key => !!key);

  const keysConfigured = apiKeys.length;

  return NextResponse.json({
    apiKeysConfigured: {
      total: keysConfigured,
      key1: !!process.env.GOOGLE_AI_API_KEY,
      key2: !!process.env.GOOGLE_AI_API_KEY_2,
      key3: !!process.env.GOOGLE_AI_API_KEY_3,
      key4: !!process.env.GOOGLE_AI_API_KEY_4,
      key5: !!process.env.GOOGLE_AI_API_KEY_5,
      key6: !!process.env.GOOGLE_AI_API_KEY_6,
      key7: !!process.env.GOOGLE_AI_API_KEY_7,
      key8: !!process.env.GOOGLE_AI_API_KEY_8,
      key9: !!process.env.GOOGLE_AI_API_KEY_9
    },
    apiKeyFormats: apiKeys.map((key, i) => 
      key ? `Key ${i + 1}: ${key.substring(0, 15)}...${key.substring(key.length - 4)}` : `Key ${i + 1}: Not set`
    ),
    status: keysConfigured > 0 ? 'Ready' : 'Not configured',
    service: 'Google Gemini AI',
    model: 'gemini-2.5-flash',
    rateLimit: {
      perKey: '15 requests/minute',
      total: `${keysConfigured * 15} requests/minute`,
      perKeyDaily: '1,500 requests/day',
      totalDaily: `${keysConfigured * 1500} requests/day`
    },
    message: keysConfigured > 0
      ? `🚀 Google AI configured with ${keysConfigured} API key(s)! Combined rate limit: ${keysConfigured * 15} RPM (${keysConfigured * 1500} per day)` 
      : 'API keys not found. Please add GOOGLE_AI_API_KEY to .env.local'
  });
}

/**
 * Test AI generation with simple prompt
 * POST /api/ai/test
 */
export async function POST() {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google AI API key not configured' },
        { status: 500 }
      );
    }

    // Simple test call to Google Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Say "Hello! Google AI is working!" if you can read this.'
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 50
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { 
          error: 'Google AI API test failed',
          details: error,
          status: response.status
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const message = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({
      success: true,
      message: message,
      testResult: 'Google AI service is working correctly!',
      model: 'gemini-2.5-flash',
      service: 'Google Gemini AI'
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

