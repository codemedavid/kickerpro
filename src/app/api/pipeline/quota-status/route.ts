import { NextResponse } from 'next/server';

// Track the last time each key hit rate limit
const keyRateLimitTracker: Record<number, number> = {};
const RATE_LIMIT_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * GET /api/pipeline/quota-status
 * Check Gemini API quota status across all keys
 */
export async function GET() {
  try {
    // Get all configured API keys
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
    ].filter((key): key is string => !!key);

    const totalKeys = apiKeys.length;
    const now = Date.now();

    // Check which keys might still be available (not rate limited recently)
    let availableKeys = 0;
    const recentRateLimits: number[] = [];

    for (let i = 0; i < totalKeys; i++) {
      const lastRateLimit = keyRateLimitTracker[i];
      
      if (!lastRateLimit) {
        // Never rate limited or unknown - assume available
        availableKeys++;
      } else {
        const timeSinceRateLimit = now - lastRateLimit;
        
        if (timeSinceRateLimit > RATE_LIMIT_DURATION) {
          // More than 24 hours - likely reset
          availableKeys++;
          delete keyRateLimitTracker[i]; // Clear old tracking
        } else {
          recentRateLimits.push(lastRateLimit);
        }
      }
    }

    // Calculate estimated reset time
    let estimatedResetHours = 0;
    if (recentRateLimits.length > 0) {
      const oldestRateLimit = Math.min(...recentRateLimits);
      const timeUntilReset = RATE_LIMIT_DURATION - (now - oldestRateLimit);
      estimatedResetHours = Math.ceil(timeUntilReset / (60 * 60 * 1000));
    }

    const allExhausted = availableKeys === 0;

    return NextResponse.json({
      available_keys: availableKeys,
      total_keys: totalKeys,
      all_exhausted: allExhausted,
      estimated_reset_hours: Math.max(0, estimatedResetHours),
      analysis_mode: allExhausted ? 'test_mode' : 'ai_mode',
      last_check: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Quota Status] Error:', error);
    return NextResponse.json(
      { 
        available_keys: 0,
        total_keys: 0,
        all_exhausted: true,
        estimated_reset_hours: 24,
        error: 'Failed to check quota status'
      },
      { status: 200 } // Return 200 even on error to not break UI
    );
  }
}

/**
 * POST /api/pipeline/quota-status
 * Report a rate limit event (called by analyze function)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key_index } = body;

    if (typeof key_index === 'number' && key_index >= 0 && key_index <= 8) {
      keyRateLimitTracker[key_index] = Date.now();
      console.log(`[Quota Status] Key #${key_index} rate limited at ${new Date().toISOString()}`);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 200 });
  }
}





