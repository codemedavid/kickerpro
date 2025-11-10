/**
 * API Route: Compute Best Contact Times
 * POST /api/contact-timing/compute
 * 
 * Computes optimal contact times for all contacts or specific contact IDs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  computeBestContactTimes,
  getDefaultConfig,
  getHourOfWeek,
  type ContactEvent,
  type AlgorithmConfig,
} from '@/lib/contact-timing/algorithm';
import { inferBestTimezone } from '@/lib/contact-timing/timezone';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from cookie
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const body = await request.json();
    const { conversation_ids, recompute_all = false } = body;

    const startTime = Date.now();

    // Get or create user config
    let config: AlgorithmConfig;
    const { data: userConfig } = await supabase
      .from('contact_timing_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userConfig) {
      config = {
        lambda_fast: userConfig.lambda_fast,
        lambda_slow: userConfig.lambda_slow,
        alpha_prior: userConfig.alpha_prior,
        beta_prior: userConfig.beta_prior,
        hierarchical_kappa: userConfig.hierarchical_kappa,
        epsilon_exploration: userConfig.epsilon_exploration,
        success_weight_reply: userConfig.success_weight_reply,
        success_weight_click: userConfig.success_weight_click,
        success_weight_open: userConfig.success_weight_open,
        survival_gamma: userConfig.survival_gamma,
        top_k_windows: userConfig.top_k_windows,
        min_spacing_hours: userConfig.min_spacing_hours,
        daily_attempt_cap: userConfig.daily_attempt_cap,
        weekly_attempt_cap: userConfig.weekly_attempt_cap,
        success_window_hours: userConfig.success_window_hours,
        w1_confidence: userConfig.w1_confidence,
        w2_recency: userConfig.w2_recency,
        w3_priority: userConfig.w3_priority,
      };
    } else {
      // Create default config
      config = getDefaultConfig();
      await supabase.from('contact_timing_config').insert({
        user_id: userId,
        ...config,
      });
    }

    // Load segment priors (global level for now)
    const { data: segmentData } = await supabase
      .from('contact_timing_segment_priors')
      .select('*')
      .eq('user_id', userId)
      .eq('segment_type', 'global');

    const segmentPriors = new Map();
    if (segmentData) {
      for (const prior of segmentData) {
        segmentPriors.set(prior.hour_of_week, {
          hour_of_week: prior.hour_of_week,
          trials_count: prior.trials_count,
          success_count: prior.success_count,
          response_rate: prior.response_rate,
        });
      }
    }

    // Get conversations to process
    let conversationsQuery = supabase
      .from('messenger_conversations')
      .select('*')
      .eq('user_id', userId);

    if (!recompute_all && conversation_ids && Array.isArray(conversation_ids)) {
      conversationsQuery = conversationsQuery.in('id', conversation_ids);
    }

    const { data: conversations, error: convError } = await conversationsQuery;

    if (convError) {
      return NextResponse.json({ error: convError.message }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ 
        message: 'No conversations to process',
        processed: 0,
      });
    }

    const results = [];
    let processed = 0;

    for (const conversation of conversations) {
      try {
        // Get interaction events for this contact
        const { data: events } = await supabase
          .from('contact_interaction_events')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('event_timestamp', { ascending: false });

        // Transform events for algorithm
        const contactEvents: ContactEvent[] = (events || []).map((e) => ({
          event_type: e.event_type,
          event_timestamp: new Date(e.event_timestamp),
          response_timestamp: e.response_timestamp ? new Date(e.response_timestamp) : undefined,
          is_outbound: e.is_outbound,
          is_success: e.is_success,
          success_weight: e.success_weight,
          hour_of_week: 0, // Will be computed
        }));

        // Infer timezone
        const messageTimes = contactEvents.map((e) => e.event_timestamp);
        const timezoneInference = inferBestTimezone(messageTimes);

        // Compute hour_of_week for each event in contact's timezone
        for (const event of contactEvents) {
          event.hour_of_week = getHourOfWeek(event.event_timestamp, timezoneInference.timezone);
        }

        // Find last positive signal
        const lastPositiveEvent = contactEvents.find((e) => e.is_success);
        const lastPositiveSignalAt = lastPositiveEvent?.event_timestamp || null;

        // Find last contact attempt
        const lastAttemptEvent = contactEvents.find((e) => e.is_outbound);
        const lastContactAttemptAt = lastAttemptEvent?.event_timestamp || null;

        // Compute priority score (default to 0.5, can be enhanced later)
        const priorityScore = 0.5;

        // Run the algorithm
        const result = computeBestContactTimes(
          contactEvents,
          segmentPriors.size > 0 ? segmentPriors : null,
          config,
          lastPositiveSignalAt,
          priorityScore
        );

        // Calculate stats
        const totalAttempts = contactEvents.filter((e) => e.is_outbound).length;
        const totalSuccesses = contactEvents.filter((e) => e.is_success).length;
        const overallResponseRate = totalAttempts > 0 ? totalSuccesses / totalAttempts : 0;

        // Upsert recommendation
        const recommendationData = {
          user_id: userId,
          conversation_id: conversation.id,
          sender_id: conversation.sender_id,
          sender_name: conversation.sender_name,
          timezone: timezoneInference.timezone,
          timezone_confidence: timezoneInference.confidence,
          timezone_source: timezoneInference.source,
          recommended_windows: result.recommended_windows,
          max_confidence: result.max_confidence,
          recency_score: result.recency_score,
          priority_score: result.priority_score,
          composite_score: result.composite_score,
          last_positive_signal_at: lastPositiveSignalAt?.toISOString() || null,
          last_contact_attempt_at: lastContactAttemptAt?.toISOString() || null,
          total_attempts: totalAttempts,
          total_successes: totalSuccesses,
          overall_response_rate: overallResponseRate,
          last_computed_at: new Date().toISOString(),
          computation_duration_ms: Date.now() - startTime,
          algorithm_version: 'v1.0',
        };

        const { error: upsertError } = await supabase
          .from('contact_timing_recommendations')
          .upsert(recommendationData, {
            onConflict: 'conversation_id',
          });

        if (upsertError) {
          console.error('Error upserting recommendation:', upsertError);
        }

        // Store bins for this contact
        const binInserts = result.bins
          .filter((b) => b.trials_count > 0 || b.success_count > 0)
          .map((bin) => ({
            user_id: userId,
            conversation_id: conversation.id,
            sender_id: conversation.sender_id,
            hour_of_week: bin.hour_of_week,
            trials_count: bin.trials_count,
            success_count: bin.success_count,
            raw_probability: bin.raw_probability,
            smoothed_probability: bin.smoothed_probability,
            calibrated_probability: bin.calibrated_probability,
          }));

        if (binInserts.length > 0) {
          // Delete existing bins and insert new ones
          await supabase
            .from('contact_timing_bins')
            .delete()
            .eq('conversation_id', conversation.id);

          await supabase.from('contact_timing_bins').insert(binInserts);
        }

        processed++;
        results.push({
          conversation_id: conversation.id,
          sender_name: conversation.sender_name,
          composite_score: result.composite_score,
          windows: result.recommended_windows.length,
        });
      } catch (error) {
        console.error(`Error processing conversation ${conversation.id}:`, error);
      }
    }

    // Update global segment priors
    await updateSegmentPriors(supabase, userId, config);

    return NextResponse.json({
      success: true,
      processed,
      total: conversations.length,
      duration_ms: Date.now() - startTime,
      results: results.slice(0, 10), // Return first 10 as sample
    });
  } catch (error) {
    console.error('Error computing contact times:', error);
    return NextResponse.json(
      { error: 'Failed to compute contact times' },
      { status: 500 }
    );
  }
}

/**
 * Update segment-level priors by aggregating across all contacts
 */
async function updateSegmentPriors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  config: AlgorithmConfig
) {
  try {
    // Aggregate bins across all contacts for global priors
    const { data: allBins } = await supabase
      .from('contact_timing_bins')
      .select('hour_of_week, trials_count, success_count')
      .eq('user_id', userId);

    if (!allBins || allBins.length === 0) return;

    // Aggregate by hour_of_week
    const aggregated = new Map<number, { trials: number; successes: number; count: number }>();

    for (const bin of allBins) {
      const existing = aggregated.get(bin.hour_of_week) || { trials: 0, successes: 0, count: 0 };
      existing.trials += bin.trials_count;
      existing.successes += bin.success_count;
      existing.count += 1;
      aggregated.set(bin.hour_of_week, existing);
    }

    // Upsert segment priors
    const priorInserts = [];
    for (const [hourOfWeek, data] of aggregated.entries()) {
      const responseRate = data.trials > 0 ? data.successes / data.trials : 0;
      priorInserts.push({
        user_id: userId,
        segment_type: 'global',
        segment_value: 'all',
        hour_of_week: hourOfWeek,
        trials_count: data.trials,
        success_count: data.successes,
        response_rate: responseRate,
        contact_count: data.count,
      });
    }

    if (priorInserts.length > 0) {
      await supabase
        .from('contact_timing_segment_priors')
        .upsert(priorInserts, {
          onConflict: 'user_id,segment_type,segment_value,hour_of_week',
        });
    }
  } catch (error) {
    console.error('Error updating segment priors:', error);
  }
}

