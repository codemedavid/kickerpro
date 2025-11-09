import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_SCORING_CONFIG } from '@/lib/config/lead-scoring-config';

/**
 * Get user's lead scoring settings
 * GET /api/settings/lead-scoring
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: settings, error } = await supabase
      .from('lead_scoring_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[Lead Scoring Settings] Error fetching settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Return defaults if no settings exist
    if (!settings) {
      return NextResponse.json({
        price_shopper_threshold: DEFAULT_SCORING_CONFIG.priceShopperThreshold,
        price_shopper_message_limit: DEFAULT_SCORING_CONFIG.priceShopperMessageLimit,
        min_engagement_warm: DEFAULT_SCORING_CONFIG.minEngagementForWarm,
        min_engagement_hot: DEFAULT_SCORING_CONFIG.minEngagementForHot,
        strict_mode: DEFAULT_SCORING_CONFIG.strictPriceShopperMode,
        auto_score_on_sync: false
      });
    }

    return NextResponse.json({
      price_shopper_threshold: settings.price_shopper_threshold,
      price_shopper_message_limit: settings.price_shopper_message_limit,
      min_engagement_warm: settings.min_engagement_warm,
      min_engagement_hot: settings.min_engagement_hot,
      strict_mode: settings.strict_mode,
      auto_score_on_sync: settings.auto_score_on_sync
    });

  } catch (error) {
    console.error('[Lead Scoring Settings] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * Update user's lead scoring settings
 * PUT /api/settings/lead-scoring
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      price_shopper_threshold,
      price_shopper_message_limit,
      min_engagement_warm,
      min_engagement_hot,
      strict_mode,
      auto_score_on_sync
    } = body;

    // Validate inputs
    if (price_shopper_threshold !== undefined && (price_shopper_threshold < 0 || price_shopper_threshold > 100)) {
      return NextResponse.json(
        { error: 'Price shopper threshold must be between 0 and 100' },
        { status: 400 }
      );
    }

    if (price_shopper_message_limit !== undefined && price_shopper_message_limit < 1) {
      return NextResponse.json(
        { error: 'Price shopper message limit must be at least 1' },
        { status: 400 }
      );
    }

    if (min_engagement_warm !== undefined && min_engagement_warm < 1) {
      return NextResponse.json(
        { error: 'Minimum engagement for warm leads must be at least 1' },
        { status: 400 }
      );
    }

    if (min_engagement_hot !== undefined && min_engagement_hot < 1) {
      return NextResponse.json(
        { error: 'Minimum engagement for hot leads must be at least 1' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const settingsData = {
      user_id: userId,
      price_shopper_threshold,
      price_shopper_message_limit,
      min_engagement_warm,
      min_engagement_hot,
      strict_mode,
      auto_score_on_sync,
      updated_at: new Date().toISOString()
    };

    // Upsert settings
    const { data, error } = await supabase
      .from('lead_scoring_settings')
      .upsert(settingsData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('[Lead Scoring Settings] Error updating settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      settings: {
        price_shopper_threshold: data.price_shopper_threshold,
        price_shopper_message_limit: data.price_shopper_message_limit,
        min_engagement_warm: data.min_engagement_warm,
        min_engagement_hot: data.min_engagement_hot,
        strict_mode: data.strict_mode,
        auto_score_on_sync: data.auto_score_on_sync
      }
    });

  } catch (error) {
    console.error('[Lead Scoring Settings] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
}

