/**
 * Best Time to Contact - Core Algorithm
 * 
 * Implements Beta-Binomial with time decay, hierarchical Bayesian pooling,
 * Thompson Sampling, and structured smoothing for optimal contact timing.
 */

import { RecommendedWindow } from '@/types/database';

// ================================================================
// TYPES & INTERFACES
// ================================================================

export interface AlgorithmConfig {
  lambda_fast: number;           // Fast decay rate (default: 0.05)
  lambda_slow: number;           // Slow decay rate (default: 0.01)
  alpha_prior: number;           // Beta prior α (default: 1.0)
  beta_prior: number;            // Beta prior β (default: 1.0)
  hierarchical_kappa: number;    // Pooling strength (default: 5.0)
  epsilon_exploration: number;   // Thompson Sampling ε (default: 0.08)
  success_weight_reply: number;  // Weight for replies (default: 1.0)
  success_weight_click: number;  // Weight for clicks (default: 0.5)
  success_weight_open: number;   // Weight for opens (default: 0.25)
  survival_gamma: number;        // Time-to-engagement decay (default: 0.05)
  top_k_windows: number;         // Top K windows to recommend (default: 6)
  min_spacing_hours: number;     // Min spacing between windows (default: 4)
  daily_attempt_cap: number;     // Max attempts per day (default: 2)
  weekly_attempt_cap: number;    // Max attempts per week (default: 5)
  success_window_hours: number;  // Success window in hours (default: 24)
  w1_confidence: number;         // Weight for max confidence (default: 0.6)
  w2_recency: number;           // Weight for recency (default: 0.2)
  w3_priority: number;          // Weight for priority (default: 0.2)
}

export interface ContactEvent {
  event_type: string;
  event_timestamp: Date;
  response_timestamp?: Date;
  is_outbound: boolean;
  is_success: boolean;
  success_weight: number;
  hour_of_week: number;
}

export interface HourBin {
  hour_of_week: number;
  trials_count: number;
  success_count: number;
  raw_probability: number;
  smoothed_probability: number;
  calibrated_probability: number;
}

export interface SegmentPrior {
  hour_of_week: number;
  trials_count: number;
  success_count: number;
  response_rate: number;
}

export interface ContactTimingResult {
  recommended_windows: RecommendedWindow[];
  max_confidence: number;
  recency_score: number;
  priority_score: number;
  composite_score: number;
  bins: HourBin[];
}

// ================================================================
// CORE ALGORITHM FUNCTIONS
// ================================================================

/**
 * Compute hour-of-week bin (0-167) from a date in a given timezone
 * Format: day 0-6 (Sun-Sat), hour 0-23
 * bin = day_of_week * 24 + hour_of_day
 */
export function getHourOfWeek(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const dayPart = parts.find((p) => p.type === 'weekday');
  const hourPart = parts.find((p) => p.type === 'hour');

  if (!dayPart || !hourPart) return 0;

  const dayOfWeek = dayMap[dayPart.value] || 0;
  const hourOfDay = parseInt(hourPart.value, 10);

  return dayOfWeek * 24 + hourOfDay;
}

/**
 * Convert hour-of-week back to day name and hour
 */
export function hourOfWeekToLabel(hourOfWeek: number): { dow: string; hour: number } {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = Math.floor(hourOfWeek / 24);
  const hour = hourOfWeek % 24;

  return {
    dow: dayNames[day] || 'Sun',
    hour,
  };
}

/**
 * Compute time decay weight using two-timescale decay
 * w = 0.5 * exp(-λ_fast * age_days) + 0.5 * exp(-λ_slow * age_days)
 */
export function computeDecayWeight(
  ageDays: number,
  lambdaFast: number,
  lambdaSlow: number
): number {
  return 0.5 * Math.exp(-lambdaFast * ageDays) + 0.5 * Math.exp(-lambdaSlow * ageDays);
}

/**
 * Initialize 168 hour-of-week bins with zeros
 */
export function initializeBins(): HourBin[] {
  const bins: HourBin[] = [];
  for (let h = 0; h < 168; h++) {
    bins.push({
      hour_of_week: h,
      trials_count: 0,
      success_count: 0,
      raw_probability: 0,
      smoothed_probability: 0,
      calibrated_probability: 0,
    });
  }
  return bins;
}

/**
 * Aggregate events into bins with time decay
 */
export function aggregateEventsToBins(
  events: ContactEvent[],
  config: AlgorithmConfig,
  now: Date
): HourBin[] {
  const bins = initializeBins();

  for (const event of events) {
    if (!event.is_outbound) continue; // Only count outbound attempts

    const ageDays = (now.getTime() - event.event_timestamp.getTime()) / (1000 * 60 * 60 * 24);
    const weight = computeDecayWeight(ageDays, config.lambda_fast, config.lambda_slow);

    const h = event.hour_of_week;
    if (h >= 0 && h < 168) {
      bins[h].trials_count += weight;

      if (event.is_success) {
        // Apply success weight and survival decay if response time is known
        let successCredit = event.success_weight;
        if (event.response_timestamp) {
          const responseLatencyHours =
            (event.response_timestamp.getTime() - event.event_timestamp.getTime()) /
            (1000 * 60 * 60);
          successCredit *= Math.exp(-config.survival_gamma * responseLatencyHours);
        }
        bins[h].success_count += weight * successCredit;
      }
    }
  }

  return bins;
}

/**
 * Compute raw probabilities using Beta-Binomial with hierarchical priors
 */
export function computeRawProbabilities(
  bins: HourBin[],
  segmentPriors: Map<number, SegmentPrior> | null,
  config: AlgorithmConfig
): void {
  for (const bin of bins) {
    let alpha = config.alpha_prior;
    let beta = config.beta_prior;

    // Hierarchical Bayesian pooling: borrow strength from segment priors
    if (segmentPriors && segmentPriors.has(bin.hour_of_week)) {
      const prior = segmentPriors.get(bin.hour_of_week)!;
      alpha += config.hierarchical_kappa * prior.success_count;
      beta += config.hierarchical_kappa * (prior.trials_count - prior.success_count);
    }

    // Posterior mean: (S + α) / (N + α + β)
    bin.raw_probability =
      (bin.success_count + alpha) / (bin.trials_count + alpha + beta);
  }
}

/**
 * Apply structured smoothing across neighbors
 * p̃[h] = 0.5·p̂[h] + 0.2·avg(±1h) + 0.2·avg(±24h) + 0.1·avg(same hour-of-day)
 */
export function applySmoothig(bins: HourBin[]): void {
  const rawProbs = bins.map((b) => b.raw_probability);
  
  for (let h = 0; h < 168; h++) {
    const p_h = rawProbs[h];

    // ±1 hour neighbors (circular)
    const p_prev = rawProbs[(h - 1 + 168) % 168];
    const p_next = rawProbs[(h + 1) % 168];
    const avg_1h = (p_prev + p_next) / 2;

    // ±24 hour neighbors (same hour yesterday/tomorrow)
    const p_prev24 = rawProbs[(h - 24 + 168) % 168];
    const p_next24 = rawProbs[(h + 24) % 168];
    const avg_24h = (p_prev24 + p_next24) / 2;

    // Same hour-of-day across all days
    const hourOfDay = h % 24;
    let sumSameHour = 0;
    let countSameHour = 0;
    for (let day = 0; day < 7; day++) {
      const idx = day * 24 + hourOfDay;
      if (idx !== h) {
        sumSameHour += rawProbs[idx];
        countSameHour++;
      }
    }
    const avg_same_hour = countSameHour > 0 ? sumSameHour / countSameHour : p_h;

    // Weighted blend
    bins[h].smoothed_probability =
      0.5 * p_h + 0.2 * avg_1h + 0.2 * avg_24h + 0.1 * avg_same_hour;
  }
}

/**
 * Apply quiet hours mask (set probability to 0 for forbidden times)
 */
export function applyQuietHoursMask(
  bins: HourBin[],
  quietHoursStart?: string,
  quietHoursEnd?: string,
  preferredDays?: number[]
): void {
  if (!quietHoursStart || !quietHoursEnd) return;

  const startHour = parseInt(quietHoursStart.split(':')[0], 10);
  const endHour = parseInt(quietHoursEnd.split(':')[0], 10);

  for (const bin of bins) {
    const { dow, hour } = hourOfWeekToLabel(bin.hour_of_week);
    
    // Mask quiet hours
    if (startHour < endHour) {
      if (hour >= startHour && hour < endHour) {
        bin.smoothed_probability = 0;
      }
    } else {
      // Overnight quiet hours (e.g., 21:00 - 07:00)
      if (hour >= startHour || hour < endHour) {
        bin.smoothed_probability = 0;
      }
    }

    // Mask non-preferred days
    if (preferredDays && preferredDays.length > 0) {
      const dayMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
      };
      const dayNum = dayMap[dow] || 0;
      if (!preferredDays.includes(dayNum)) {
        bin.smoothed_probability = 0;
      }
    }
  }
}

/**
 * Thompson Sampling: sample from Beta distribution for exploration
 */
export function thompsonSample(
  bins: HourBin[],
  config: AlgorithmConfig
): void {
  for (const bin of bins) {
    const alpha = bin.success_count + config.alpha_prior;
    const beta = bin.trials_count - bin.success_count + config.beta_prior;

    // Simple approximation: use mean ± random variance
    // For production, use a proper Beta sampler
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    const stddev = Math.sqrt(variance);
    const sample = mean + (Math.random() - 0.5) * 2 * stddev;

    bin.last_sample = Math.max(0, Math.min(1, sample));
  }
}

/**
 * Select top K non-overlapping windows with min spacing
 */
export function selectTopWindows(
  bins: HourBin[],
  config: AlgorithmConfig,
  useExploration: boolean = false
): RecommendedWindow[] {
  // Sort bins by probability (or sampled value if exploring)
  const sortedBins = [...bins].sort((a, b) => {
    const scoreA = useExploration ? a.last_sample : a.smoothed_probability;
    const scoreB = useExploration ? b.last_sample : b.smoothed_probability;
    return scoreB - scoreA;
  });

  const selectedWindows: RecommendedWindow[] = [];
  const minSpacing = config.min_spacing_hours;

  for (const bin of sortedBins) {
    if (selectedWindows.length >= config.top_k_windows) break;
    if (bin.smoothed_probability <= 0) continue;

    // Check spacing constraint
    const hasConflict = selectedWindows.some((window) => {
      const hourDiff = Math.abs(window.hour_of_week - bin.hour_of_week);
      // Account for week wraparound
      const minDiff = Math.min(hourDiff, 168 - hourDiff);
      return minDiff < minSpacing;
    });

    if (!hasConflict) {
      const { dow, hour } = hourOfWeekToLabel(bin.hour_of_week);
      selectedWindows.push({
        dow,
        start: `${hour.toString().padStart(2, '0')}:00`,
        end: `${((hour + 1) % 24).toString().padStart(2, '0')}:00`,
        confidence: Math.round(bin.smoothed_probability * 100) / 100,
        hour_of_week: bin.hour_of_week,
      });
    }
  }

  return selectedWindows;
}

/**
 * Compute recency score based on last positive signal
 * recency_score = exp(-μ · days_since_last_positive)
 */
export function computeRecencyScore(
  lastPositiveSignalAt: Date | null,
  now: Date,
  mu: number = 0.03
): number {
  if (!lastPositiveSignalAt) return 0;

  const daysSince = (now.getTime() - lastPositiveSignalAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-mu * daysSince);
}

/**
 * Compute composite score
 * score = w1·max(p̃) + w2·recency + w3·priority
 */
export function computeCompositeScore(
  maxConfidence: number,
  recencyScore: number,
  priorityScore: number,
  config: AlgorithmConfig
): number {
  return (
    config.w1_confidence * maxConfidence +
    config.w2_recency * recencyScore +
    config.w3_priority * priorityScore
  );
}

/**
 * Main algorithm: compute best contact times for a contact
 */
export function computeBestContactTimes(
  events: ContactEvent[],
  segmentPriors: Map<number, SegmentPrior> | null,
  config: AlgorithmConfig,
  lastPositiveSignalAt: Date | null,
  priorityScore: number,
  quietHoursStart?: string,
  quietHoursEnd?: string,
  preferredDays?: number[],
  useExploration: boolean = false
): ContactTimingResult {
  const now = new Date();

  // Step 1: Aggregate events into bins with time decay
  const bins = aggregateEventsToBins(events, config, now);

  // Step 2: Compute raw probabilities with hierarchical priors
  computeRawProbabilities(bins, segmentPriors, config);

  // Step 3: Apply structured smoothing
  applySmoothig(bins);

  // Step 4: Apply quiet hours and preferred days mask
  applyQuietHoursMask(bins, quietHoursStart, quietHoursEnd, preferredDays);

  // Step 5: Thompson Sampling (if exploring)
  if (useExploration && Math.random() < config.epsilon_exploration) {
    thompsonSample(bins, config);
  }

  // Step 6: Select top K non-overlapping windows
  const recommendedWindows = selectTopWindows(bins, config, useExploration);

  // Step 7: Compute scores
  const maxConfidence = Math.max(...bins.map((b) => b.smoothed_probability));
  const recencyScore = computeRecencyScore(lastPositiveSignalAt, now);
  const compositeScore = computeCompositeScore(maxConfidence, recencyScore, priorityScore, config);

  return {
    recommended_windows: recommendedWindows,
    max_confidence: maxConfidence,
    recency_score: recencyScore,
    priority_score: priorityScore,
    composite_score: compositeScore,
    bins,
  };
}

/**
 * Default algorithm configuration
 */
export function getDefaultConfig(): AlgorithmConfig {
  return {
    lambda_fast: 0.05,
    lambda_slow: 0.01,
    alpha_prior: 1.0,
    beta_prior: 1.0,
    hierarchical_kappa: 5.0,
    epsilon_exploration: 0.08,
    success_weight_reply: 1.0,
    success_weight_click: 0.5,
    success_weight_open: 0.25,
    survival_gamma: 0.05,
    top_k_windows: 6,
    min_spacing_hours: 4,
    daily_attempt_cap: 2,
    weekly_attempt_cap: 5,
    success_window_hours: 24,
    w1_confidence: 0.6,
    w2_recency: 0.2,
    w3_priority: 0.2,
  };
}

