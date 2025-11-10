/**
 * Unit Tests: Best Time to Contact Algorithm
 * 
 * Tests all core algorithm functions for mathematical correctness
 */

import {
  getHourOfWeek,
  hourOfWeekToLabel,
  computeDecayWeight,
  initializeBins,
  aggregateEventsToBins,
  computeRawProbabilities,
  applySmoothig,
  applyQuietHoursMask,
  thompsonSample,
  selectTopWindows,
  computeRecencyScore,
  computeCompositeScore,
  computeBestContactTimes,
  getDefaultConfig,
  type ContactEvent,
  type HourBin,
  type AlgorithmConfig,
} from '../../../src/lib/contact-timing/algorithm';

describe('Best Time to Contact Algorithm', () => {
  describe('getHourOfWeek', () => {
    it('should correctly compute hour-of-week for Sunday midnight', () => {
      const date = new Date('2025-11-09T00:00:00-05:00'); // Sunday midnight EST
      const hourOfWeek = getHourOfWeek(date, 'America/New_York');
      expect(hourOfWeek).toBe(0); // Sunday 0:00 = bin 0
    });

    it('should correctly compute hour-of-week for Monday 10am', () => {
      const date = new Date('2025-11-10T10:00:00-05:00'); // Monday 10am EST
      const hourOfWeek = getHourOfWeek(date, 'America/New_York');
      expect(hourOfWeek).toBe(34); // Monday = day 1, 1*24 + 10 = 34
    });

    it('should correctly compute hour-of-week for Saturday 11pm', () => {
      const date = new Date('2025-11-15T23:00:00-05:00'); // Saturday 11pm EST
      const hourOfWeek = getHourOfWeek(date, 'America/New_York');
      expect(hourOfWeek).toBe(167); // Saturday = day 6, 6*24 + 23 = 167
    });

    it('should handle timezone conversions correctly', () => {
      const date = new Date('2025-11-10T15:00:00Z'); // 3pm UTC
      const nyHour = getHourOfWeek(date, 'America/New_York'); // 10am EST
      const tokyoHour = getHourOfWeek(date, 'Asia/Tokyo'); // 12am JST next day
      
      expect(nyHour).toBe(34); // Mon 10am
      expect(tokyoHour).toBe(24); // Tue 00am
    });
  });

  describe('hourOfWeekToLabel', () => {
    it('should convert bin 0 to Sunday 0', () => {
      const { dow, hour } = hourOfWeekToLabel(0);
      expect(dow).toBe('Sun');
      expect(hour).toBe(0);
    });

    it('should convert bin 34 to Monday 10', () => {
      const { dow, hour } = hourOfWeekToLabel(34);
      expect(dow).toBe('Mon');
      expect(hour).toBe(10);
    });

    it('should convert bin 167 to Saturday 23', () => {
      const { dow, hour } = hourOfWeekToLabel(167);
      expect(dow).toBe('Sat');
      expect(hour).toBe(23);
    });
  });

  describe('computeDecayWeight', () => {
    it('should return 1.0 for age 0 (today)', () => {
      const weight = computeDecayWeight(0, 0.05, 0.01);
      expect(weight).toBeCloseTo(1.0, 2);
    });

    it('should return ~0.5 for 14-day-old event (fast decay half-life)', () => {
      const weight = computeDecayWeight(14, 0.05, 0.01);
      // Fast component: exp(-0.05*14) ≈ 0.496
      // Slow component: exp(-0.01*14) ≈ 0.869
      // Average: 0.5*0.496 + 0.5*0.869 ≈ 0.683
      expect(weight).toBeCloseTo(0.683, 2);
    });

    it('should return ~0.5 for 69-day-old event (slow decay half-life)', () => {
      const weight = computeDecayWeight(69, 0.05, 0.01);
      // Fast: exp(-0.05*69) ≈ 0.032
      // Slow: exp(-0.01*69) ≈ 0.501
      // Average: 0.5*0.032 + 0.5*0.501 ≈ 0.267
      expect(weight).toBeCloseTo(0.267, 2);
    });

    it('should decrease monotonically with age', () => {
      const weight0 = computeDecayWeight(0, 0.05, 0.01);
      const weight10 = computeDecayWeight(10, 0.05, 0.01);
      const weight30 = computeDecayWeight(30, 0.05, 0.01);
      const weight90 = computeDecayWeight(90, 0.05, 0.01);

      expect(weight0).toBeGreaterThan(weight10);
      expect(weight10).toBeGreaterThan(weight30);
      expect(weight30).toBeGreaterThan(weight90);
    });
  });

  describe('initializeBins', () => {
    it('should create exactly 168 bins', () => {
      const bins = initializeBins();
      expect(bins).toHaveLength(168);
    });

    it('should initialize all bins with zeros', () => {
      const bins = initializeBins();
      bins.forEach((bin, idx) => {
        expect(bin.hour_of_week).toBe(idx);
        expect(bin.trials_count).toBe(0);
        expect(bin.success_count).toBe(0);
        expect(bin.raw_probability).toBe(0);
        expect(bin.smoothed_probability).toBe(0);
        expect(bin.calibrated_probability).toBe(0);
      });
    });
  });

  describe('aggregateEventsToBins', () => {
    const config = getDefaultConfig();
    const now = new Date();

    it('should aggregate outbound events correctly', () => {
      const events: ContactEvent[] = [
        {
          event_type: 'message_sent',
          event_timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          is_outbound: true,
          is_success: true,
          success_weight: 1.0,
          hour_of_week: 34, // Monday 10am
        },
        {
          event_type: 'message_sent',
          event_timestamp: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
          is_outbound: true,
          is_success: false,
          success_weight: 0,
          hour_of_week: 34,
        },
      ];

      const bins = aggregateEventsToBins(events, config, now);
      
      expect(bins[34].trials_count).toBeGreaterThan(0);
      expect(bins[34].success_count).toBeGreaterThan(0);
      expect(bins[34].success_count).toBeLessThan(bins[34].trials_count);
    });

    it('should ignore inbound events for trial counts', () => {
      const events: ContactEvent[] = [
        {
          event_type: 'message_replied',
          event_timestamp: now,
          is_outbound: false,
          is_success: true,
          success_weight: 1.0,
          hour_of_week: 34,
        },
      ];

      const bins = aggregateEventsToBins(events, config, now);
      
      // Inbound events should not add to trials
      expect(bins[34].trials_count).toBe(0);
      expect(bins[34].success_count).toBe(0);
    });

    it('should apply time decay correctly', () => {
      const recentEvent: ContactEvent = {
        event_type: 'message_sent',
        event_timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        is_outbound: true,
        is_success: true,
        success_weight: 1.0,
        hour_of_week: 34,
      };

      const oldEvent: ContactEvent = {
        event_type: 'message_sent',
        event_timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        is_outbound: true,
        is_success: true,
        success_weight: 1.0,
        hour_of_week: 34,
      };

      const binsRecent = aggregateEventsToBins([recentEvent], config, now);
      const binsOld = aggregateEventsToBins([oldEvent], config, now);

      expect(binsRecent[34].trials_count).toBeGreaterThan(binsOld[34].trials_count);
    });

    it('should apply success weight correctly', () => {
      const events: ContactEvent[] = [
        {
          event_type: 'message_replied',
          event_timestamp: now,
          is_outbound: true,
          is_success: true,
          success_weight: 1.0,
          hour_of_week: 34,
        },
        {
          event_type: 'message_clicked',
          event_timestamp: now,
          is_outbound: true,
          is_success: true,
          success_weight: 0.5,
          hour_of_week: 35,
        },
      ];

      const bins = aggregateEventsToBins(events, config, now);
      
      expect(bins[34].success_count).toBeGreaterThan(bins[35].success_count);
    });
  });

  describe('computeRawProbabilities', () => {
    const config = getDefaultConfig();

    it('should compute Beta-Binomial posterior correctly', () => {
      const bins: HourBin[] = [
        {
          hour_of_week: 0,
          trials_count: 10,
          success_count: 8,
          raw_probability: 0,
          smoothed_probability: 0,
          calibrated_probability: 0,
        },
      ];

      computeRawProbabilities(bins, null, config);

      // With α=1, β=1: p̂ = (8+1)/(10+1+1) = 9/12 = 0.75
      expect(bins[0].raw_probability).toBeCloseTo(0.75, 2);
    });

    it('should handle zero trials with priors', () => {
      const bins: HourBin[] = [
        {
          hour_of_week: 0,
          trials_count: 0,
          success_count: 0,
          raw_probability: 0,
          smoothed_probability: 0,
          calibrated_probability: 0,
        },
      ];

      computeRawProbabilities(bins, null, config);

      // With α=1, β=1, no data: p̂ = 1/(0+1+1) = 0.5
      expect(bins[0].raw_probability).toBeCloseTo(0.5, 2);
    });

    it('should incorporate segment priors correctly', () => {
      const bins: HourBin[] = [
        {
          hour_of_week: 0,
          trials_count: 2,
          success_count: 1,
          raw_probability: 0,
          smoothed_probability: 0,
          calibrated_probability: 0,
        },
      ];

      const segmentPriors = new Map();
      segmentPriors.set(0, {
        hour_of_week: 0,
        trials_count: 100,
        success_count: 60,
        response_rate: 0.6,
      });

      computeRawProbabilities(bins, segmentPriors, config);

      // With hierarchical prior (κ=5):
      // α = 1 + 5*60 = 301
      // β = 1 + 5*(100-60) = 201
      // p̂ = (1+301)/(2+301+201) = 302/504 ≈ 0.599
      expect(bins[0].raw_probability).toBeCloseTo(0.599, 2);
    });

    it('should produce probabilities between 0 and 1', () => {
      const bins: HourBin[] = [
        { hour_of_week: 0, trials_count: 100, success_count: 95, raw_probability: 0, smoothed_probability: 0, calibrated_probability: 0 },
        { hour_of_week: 1, trials_count: 100, success_count: 5, raw_probability: 0, smoothed_probability: 0, calibrated_probability: 0 },
        { hour_of_week: 2, trials_count: 0, success_count: 0, raw_probability: 0, smoothed_probability: 0, calibrated_probability: 0 },
      ];

      computeRawProbabilities(bins, null, config);

      bins.forEach(bin => {
        expect(bin.raw_probability).toBeGreaterThanOrEqual(0);
        expect(bin.raw_probability).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('applySmoothig', () => {
    it('should smooth probabilities across neighbors', () => {
      const bins = initializeBins();
      bins[34].raw_probability = 0.8; // Monday 10am
      bins[33].raw_probability = 0.6; // Monday 9am
      bins[35].raw_probability = 0.7; // Monday 11am
      bins[10].raw_probability = 0.65; // Sunday 10am (previous day)
      bins[58].raw_probability = 0.75; // Tuesday 10am (next day)

      applySmoothig(bins);

      // Should be weighted average
      // 0.5*0.8 + 0.2*(0.6+0.7)/2 + 0.2*(0.65+0.75)/2 + 0.1*avg_same_hour
      expect(bins[34].smoothed_probability).toBeGreaterThan(0.6);
      expect(bins[34].smoothed_probability).toBeLessThan(0.9);
    });

    it('should produce valid probabilities (0-1) after smoothing', () => {
      const bins = initializeBins();
      for (let i = 0; i < 168; i++) {
        bins[i].raw_probability = Math.random();
      }

      applySmoothig(bins);

      bins.forEach(bin => {
        expect(bin.smoothed_probability).toBeGreaterThanOrEqual(0);
        expect(bin.smoothed_probability).toBeLessThanOrEqual(1);
      });
    });

    it('should handle week wraparound correctly', () => {
      const bins = initializeBins();
      bins[0].raw_probability = 0.8; // Sunday 0:00
      bins[167].raw_probability = 0.7; // Saturday 23:00
      bins[1].raw_probability = 0.75; // Sunday 1:00

      applySmoothig(bins);

      // Bin 0 should be influenced by bin 167 (circular)
      expect(bins[0].smoothed_probability).toBeGreaterThan(0);
      expect(bins[0].smoothed_probability).toBeLessThan(1);
    });
  });

  describe('applyQuietHoursMask', () => {
    it('should mask quiet hours correctly', () => {
      const bins = initializeBins();
      for (let i = 0; i < 168; i++) {
        bins[i].smoothed_probability = 0.5;
      }

      applyQuietHoursMask(bins, '21:00', '07:00');

      // Check 10pm (hour 22) is masked
      const mon22 = 1 * 24 + 22; // Monday 10pm
      expect(bins[mon22].smoothed_probability).toBe(0);

      // Check 2am (hour 2) is masked
      const tue2 = 2 * 24 + 2; // Tuesday 2am
      expect(bins[tue2].smoothed_probability).toBe(0);

      // Check 10am (hour 10) is NOT masked
      const wed10 = 3 * 24 + 10; // Wednesday 10am
      expect(bins[wed10].smoothed_probability).toBe(0.5);
    });

    it('should mask non-preferred days', () => {
      const bins = initializeBins();
      for (let i = 0; i < 168; i++) {
        bins[i].smoothed_probability = 0.5;
      }

      // Mon-Fri only (1,2,3,4,5)
      applyQuietHoursMask(bins, undefined, undefined, [1, 2, 3, 4, 5]);

      // Check Sunday (day 0) is masked
      expect(bins[0].smoothed_probability).toBe(0); // Sun 0:00
      expect(bins[12].smoothed_probability).toBe(0); // Sun 12:00

      // Check Monday (day 1) is NOT masked
      expect(bins[24].smoothed_probability).toBe(0.5); // Mon 0:00
      expect(bins[34].smoothed_probability).toBe(0.5); // Mon 10:00

      // Check Saturday (day 6) is masked
      expect(bins[144].smoothed_probability).toBe(0); // Sat 0:00
    });

    it('should handle overnight quiet hours', () => {
      const bins = initializeBins();
      for (let i = 0; i < 168; i++) {
        bins[i].smoothed_probability = 0.5;
      }

      applyQuietHoursMask(bins, '22:00', '06:00');

      // 11pm should be masked
      const mon23 = 1 * 24 + 23;
      expect(bins[mon23].smoothed_probability).toBe(0);

      // 3am should be masked
      const tue3 = 2 * 24 + 3;
      expect(bins[tue3].smoothed_probability).toBe(0);

      // 10am should NOT be masked
      const wed10 = 3 * 24 + 10;
      expect(bins[wed10].smoothed_probability).toBe(0.5);
    });
  });

  describe('thompsonSample', () => {
    const config = getDefaultConfig();

    it('should produce samples within 0-1', () => {
      const bins: HourBin[] = [
        { hour_of_week: 0, trials_count: 10, success_count: 8, raw_probability: 0.75, smoothed_probability: 0.75, calibrated_probability: 0, last_sample: 0 },
      ];

      thompsonSample(bins, config);

      expect(bins[0].last_sample).toBeGreaterThanOrEqual(0);
      expect(bins[0].last_sample).toBeLessThanOrEqual(1);
    });

    it('should sample around the mean', () => {
      const bins: HourBin[] = [
        { hour_of_week: 0, trials_count: 100, success_count: 80, raw_probability: 0.8, smoothed_probability: 0.8, calibrated_probability: 0, last_sample: 0 },
      ];

      const samples: number[] = [];
      for (let i = 0; i < 100; i++) {
        thompsonSample(bins, config);
        samples.push(bins[0].last_sample!);
      }

      const avgSample = samples.reduce((a, b) => a + b, 0) / samples.length;
      
      // Sample mean should be close to posterior mean (0.8)
      expect(avgSample).toBeGreaterThan(0.7);
      expect(avgSample).toBeLessThan(0.9);
    });
  });

  describe('selectTopWindows', () => {
    const config = getDefaultConfig();

    it('should select top K windows', () => {
      const bins = initializeBins();
      bins[34].smoothed_probability = 0.8; // Monday 10am
      bins[58].smoothed_probability = 0.75; // Tuesday 10am
      bins[82].smoothed_probability = 0.7; // Wednesday 10am

      const windows = selectTopWindows(bins, config, false);

      expect(windows.length).toBeGreaterThan(0);
      expect(windows.length).toBeLessThanOrEqual(config.top_k_windows);
      expect(windows[0].confidence).toBe(0.8);
    });

    it('should enforce minimum spacing', () => {
      const bins = initializeBins();
      bins[34].smoothed_probability = 0.8; // Monday 10am
      bins[35].smoothed_probability = 0.79; // Monday 11am (1h apart)
      bins[36].smoothed_probability = 0.78; // Monday 12pm (2h apart)

      const windows = selectTopWindows(bins, config, false);

      // With min_spacing=4, should not select 35 or 36 after 34
      const hours = windows.map(w => w.hour_of_week);
      if (hours.includes(34)) {
        expect(hours.includes(35)).toBe(false);
        expect(hours.includes(36)).toBe(false);
        expect(hours.includes(37)).toBe(false);
      }
    });

    it('should skip bins with zero probability', () => {
      const bins = initializeBins();
      bins[34].smoothed_probability = 0;
      bins[35].smoothed_probability = 0.5;

      const windows = selectTopWindows(bins, config, false);

      const hours = windows.map(w => w.hour_of_week);
      expect(hours.includes(34)).toBe(false);
    });

    it('should handle week wraparound spacing', () => {
      const bins = initializeBins();
      bins[167].smoothed_probability = 0.8; // Saturday 11pm
      bins[0].smoothed_probability = 0.79; // Sunday 12am (1h apart with wraparound)

      const windows = selectTopWindows(bins, config, false);

      const hours = windows.map(w => w.hour_of_week);
      // Should not have both 167 and 0 due to spacing
      if (hours.includes(167)) {
        expect(hours.includes(0)).toBe(false);
        expect(hours.includes(1)).toBe(false);
        expect(hours.includes(2)).toBe(false);
        expect(hours.includes(3)).toBe(false);
      }
    });
  });

  describe('computeRecencyScore', () => {
    it('should return 1.0 for event today', () => {
      const now = new Date();
      const score = computeRecencyScore(now, now);
      expect(score).toBeCloseTo(1.0, 2);
    });

    it('should return ~0.5 for event 23 days ago', () => {
      const now = new Date();
      const then = new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000);
      const score = computeRecencyScore(then, now);
      // exp(-0.03 * 23) ≈ 0.499
      expect(score).toBeCloseTo(0.499, 2);
    });

    it('should return 0 for null timestamp', () => {
      const now = new Date();
      const score = computeRecencyScore(null, now);
      expect(score).toBe(0);
    });

    it('should decrease monotonically', () => {
      const now = new Date();
      const score1 = computeRecencyScore(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), now);
      const score10 = computeRecencyScore(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), now);
      const score30 = computeRecencyScore(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now);

      expect(score1).toBeGreaterThan(score10);
      expect(score10).toBeGreaterThan(score30);
    });
  });

  describe('computeCompositeScore', () => {
    const config = getDefaultConfig();

    it('should compute weighted sum correctly', () => {
      const score = computeCompositeScore(0.5, 0.8, 0.6, config);
      // 0.6*0.5 + 0.2*0.8 + 0.2*0.6 = 0.3 + 0.16 + 0.12 = 0.58
      expect(score).toBeCloseTo(0.58, 2);
    });

    it('should be bounded between 0 and 1', () => {
      const score1 = computeCompositeScore(0, 0, 0, config);
      const score2 = computeCompositeScore(1, 1, 1, config);

      expect(score1).toBe(0);
      expect(score2).toBe(1);
    });

    it('should weight confidence highest (60%)', () => {
      const scoreHighConf = computeCompositeScore(1.0, 0, 0, config);
      const scoreHighRecency = computeCompositeScore(0, 1.0, 0, config);
      const scoreHighPriority = computeCompositeScore(0, 0, 1.0, config);

      expect(scoreHighConf).toBe(0.6);
      expect(scoreHighRecency).toBe(0.2);
      expect(scoreHighPriority).toBe(0.2);
    });
  });

  describe('computeBestContactTimes (End-to-End)', () => {
    const config = getDefaultConfig();

    it('should produce valid recommendations with good data', () => {
      const now = new Date();
      const events: ContactEvent[] = [];

      // Create pattern: Monday 10am has high success
      for (let i = 0; i < 10; i++) {
        events.push({
          event_type: 'message_sent',
          event_timestamp: new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000),
          is_outbound: true,
          is_success: i < 8,
          success_weight: 1.0,
          hour_of_week: 34, // Monday 10am
        });
      }

      const result = computeBestContactTimes(events, null, config, new Date(), 0.5);

      expect(result.recommended_windows.length).toBeGreaterThan(0);
      expect(result.max_confidence).toBeGreaterThan(0);
      expect(result.composite_score).toBeGreaterThan(0);
      expect(result.bins).toHaveLength(168);
    });

    it('should handle empty events gracefully', () => {
      const result = computeBestContactTimes([], null, getDefaultConfig(), null, 0.5);

      expect(result.recommended_windows).toHaveLength(0);
      expect(result.max_confidence).toBeCloseTo(0.5, 1); // Prior only
      expect(result.recency_score).toBe(0);
    });

    it('should respect quiet hours in recommendations', () => {
      const now = new Date();
      const events: ContactEvent[] = [];

      // Create events during quiet hours
      for (let i = 0; i < 10; i++) {
        events.push({
          event_type: 'message_sent',
          event_timestamp: new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000),
          is_outbound: true,
          is_success: true,
          success_weight: 1.0,
          hour_of_week: 1 * 24 + 22, // Monday 10pm
        });
      }

      const result = computeBestContactTimes(
        events,
        null,
        config,
        new Date(),
        0.5,
        '21:00',
        '07:00'
      );

      // Recommendations should not include 10pm
      const hasQuietHour = result.recommended_windows.some(w => {
        const hour = parseInt(w.start.split(':')[0]);
        return hour >= 21 || hour < 7;
      });

      expect(hasQuietHour).toBe(false);
    });

    it('should handle single event (minimum data)', () => {
      const now = new Date();
      const events: ContactEvent[] = [{
        event_type: 'message_sent',
        event_timestamp: now,
        is_outbound: true,
        is_success: true,
        success_weight: 1.0,
        hour_of_week: 34,
      }];

      const result = computeBestContactTimes(events, null, config, now, 0.5);

      // Should still produce recommendations (using priors)
      expect(result.recommended_windows.length).toBeGreaterThan(0);
      expect(result.max_confidence).toBeGreaterThan(0);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const config = getDefaultConfig();

      expect(config.lambda_fast).toBe(0.05);
      expect(config.lambda_slow).toBe(0.01);
      expect(config.alpha_prior).toBe(1.0);
      expect(config.beta_prior).toBe(1.0);
      expect(config.w1_confidence + config.w2_recency + config.w3_priority).toBeCloseTo(1.0, 2);
    });

    it('should have weights that sum to 1.0', () => {
      const config = getDefaultConfig();
      const sum = config.w1_confidence + config.w2_recency + config.w3_priority;
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('should have positive decay rates', () => {
      const config = getDefaultConfig();
      expect(config.lambda_fast).toBeGreaterThan(0);
      expect(config.lambda_slow).toBeGreaterThan(0);
      expect(config.lambda_fast).toBeGreaterThan(config.lambda_slow);
    });
  });
});

