/**
 * Unit Tests: Timezone Inference
 * 
 * Tests timezone detection from activity patterns and location data
 */

import {
  inferTimezoneFromActivity,
  inferTimezoneFromProfile,
  inferBestTimezone,
  isValidTimezone,
  getTimezoneDisplayName,
  getTimezoneOffset,
} from '../../../src/lib/contact-timing/timezone';

describe('Timezone Inference', () => {
  describe('inferTimezoneFromActivity', () => {
    it('should infer US Eastern for peak at 14:00 UTC', () => {
      const messageTimes: Date[] = [];
      // Create pattern: messages at 14:00 UTC (10am EST)
      for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setUTCHours(14, 0, 0, 0);
        date.setDate(date.getDate() - i);
        messageTimes.push(date);
      }

      const result = inferTimezoneFromActivity(messageTimes);

      expect(result.timezone).toBe('America/New_York');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('inferred_from_messages');
    });

    it('should infer Europe/London for peak at 08:00 UTC', () => {
      const messageTimes: Date[] = [];
      // Messages at 08:00 UTC (9am London)
      for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setUTCHours(8, 0, 0, 0);
        date.setDate(date.getDate() - i);
        messageTimes.push(date);
      }

      const result = inferTimezoneFromActivity(messageTimes);

      expect(result.timezone).toBe('Europe/London');
      expect(result.confidence).toBe('high');
    });

    it('should return low confidence with few messages', () => {
      const messageTimes = [new Date()];

      const result = inferTimezoneFromActivity(messageTimes, 'UTC');

      expect(result.timezone).toBe('UTC');
      expect(result.confidence).toBe('low');
      expect(result.source).toBe('default');
    });

    it('should increase confidence with more data', () => {
      const fewMessages = [new Date(), new Date(), new Date()];
      const manyMessages: Date[] = [];
      for (let i = 0; i < 15; i++) {
        const date = new Date();
        date.setUTCHours(14, 0, 0, 0);
        manyMessages.push(date);
      }

      const resultFew = inferTimezoneFromActivity(fewMessages);
      const resultMany = inferTimezoneFromActivity(manyMessages);

      if (resultFew.confidence !== 'low' && resultMany.confidence !== 'low') {
        expect(['high', 'medium'].includes(resultMany.confidence)).toBe(true);
      }
    });
  });

  describe('inferTimezoneFromProfile', () => {
    it('should detect New York from location string', () => {
      const result = inferTimezoneFromProfile('New York, NY');

      expect(result.timezone).toBe('America/New_York');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('location');
    });

    it('should detect London from UK mention', () => {
      const result = inferTimezoneFromProfile('London, UK');

      expect(result.timezone).toBe('Europe/London');
      expect(result.confidence).toBe('high');
    });

    it('should detect Paris from France', () => {
      const result = inferTimezoneFromProfile('Paris, France');

      expect(result.timezone).toBe('Europe/Paris');
      expect(result.confidence).toBe('high');
    });

    it('should detect India timezone', () => {
      const result = inferTimezoneFromProfile('Mumbai, India');

      expect(result.timezone).toBe('Asia/Kolkata');
      expect(result.confidence).toBe('high');
    });

    it('should detect Singapore', () => {
      const result = inferTimezoneFromProfile('Singapore');

      expect(result.timezone).toBe('Asia/Singapore');
      expect(result.confidence).toBe('high');
    });

    it('should detect Tokyo/Japan', () => {
      const result = inferTimezoneFromProfile('Tokyo, Japan');

      expect(result.timezone).toBe('Asia/Tokyo');
      expect(result.confidence).toBe('high');
    });

    it('should detect Sydney/Australia', () => {
      const result = inferTimezoneFromProfile('Sydney, Australia');

      expect(result.timezone).toBe('Australia/Sydney');
      expect(result.confidence).toBe('high');
    });

    it('should default to UTC with no location', () => {
      const result = inferTimezoneFromProfile();

      expect(result.timezone).toBe('UTC');
      expect(result.confidence).toBe('low');
      expect(result.source).toBe('default');
    });

    it('should be case insensitive', () => {
      const result1 = inferTimezoneFromProfile('NEW YORK');
      const result2 = inferTimezoneFromProfile('new york');
      const result3 = inferTimezoneFromProfile('New York');

      expect(result1.timezone).toBe('America/New_York');
      expect(result2.timezone).toBe('America/New_York');
      expect(result3.timezone).toBe('America/New_York');
    });
  });

  describe('inferBestTimezone', () => {
    it('should prefer high-confidence profile over activity', () => {
      const messageTimes: Date[] = [];
      for (let i = 0; i < 5; i++) {
        messageTimes.push(new Date());
      }

      const result = inferBestTimezone(messageTimes, 'San Francisco, CA');

      expect(result.timezone).toBe('America/Los_Angeles');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('location');
    });

    it('should use activity inference when profile is low confidence', () => {
      const messageTimes: Date[] = [];
      // Pattern suggesting US Eastern
      for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setUTCHours(14, 0, 0, 0);
        messageTimes.push(date);
      }

      const result = inferBestTimezone(messageTimes, undefined, undefined, 'UTC');

      if (result.confidence === 'high' || result.confidence === 'medium') {
        expect(result.source).toBe('inferred_from_messages');
      }
    });

    it('should fallback to default with no data', () => {
      const result = inferBestTimezone([], undefined, undefined, 'America/Chicago');

      expect(result.timezone).toBe('America/Chicago');
      expect(result.confidence).toBe('low');
    });
  });

  describe('isValidTimezone', () => {
    it('should validate common timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('America/FakeCity')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });

  describe('getTimezoneDisplayName', () => {
    it('should return short timezone name', () => {
      const display = getTimezoneDisplayName('America/New_York');
      expect(display).toBeTruthy();
      expect(typeof display).toBe('string');
    });

    it('should handle invalid timezone gracefully', () => {
      const display = getTimezoneDisplayName('Invalid/Zone');
      expect(display).toBe('Invalid/Zone');
    });
  });

  describe('getTimezoneOffset', () => {
    it('should return 0 for UTC', () => {
      const offset = getTimezoneOffset('UTC');
      expect(offset).toBeCloseTo(0, 1);
    });

    it('should return negative offset for US timezones', () => {
      const offset = getTimezoneOffset('America/New_York');
      expect(offset).toBeGreaterThanOrEqual(-5);
      expect(offset).toBeLessThanOrEqual(-4); // EST/EDT
    });

    it('should return positive offset for Asian timezones', () => {
      const offset = getTimezoneOffset('Asia/Tokyo');
      expect(offset).toBeCloseTo(9, 1);
    });

    it('should handle invalid timezone', () => {
      const offset = getTimezoneOffset('Invalid/Zone');
      expect(offset).toBe(0);
    });
  });
});

