/**
 * Timezone Inference Utilities
 * 
 * Infers contact timezone from interaction patterns, message timestamps, etc.
 */

export interface TimezoneInference {
  timezone: string;
  confidence: 'low' | 'medium' | 'high';
  source: string;
}

/**
 * Common timezone patterns by region
 */
const COMMON_TIMEZONES: Record<string, string> = {
  // US
  'Eastern': 'America/New_York',
  'Central': 'America/Chicago',
  'Mountain': 'America/Denver',
  'Pacific': 'America/Los_Angeles',
  
  // Europe
  'UK': 'Europe/London',
  'CET': 'Europe/Paris',
  'EET': 'Europe/Athens',
  
  // Asia
  'India': 'Asia/Kolkata',
  'China': 'Asia/Shanghai',
  'Japan': 'Asia/Tokyo',
  'Singapore': 'Asia/Singapore',
  
  // Australia
  'AEST': 'Australia/Sydney',
  'ACST': 'Australia/Adelaide',
  'AWST': 'Australia/Perth',
};

/**
 * Infer timezone from activity pattern
 * Analyzes when messages are sent to detect working hours pattern
 */
export function inferTimezoneFromActivity(
  messageTimes: Date[],
  defaultTimezone: string = 'UTC'
): TimezoneInference {
  if (messageTimes.length < 3) {
    return {
      timezone: defaultTimezone,
      confidence: 'low',
      source: 'default',
    };
  }

  // Calculate hour-of-day distribution
  const hourCounts = new Array(24).fill(0);
  
  for (const time of messageTimes) {
    const hour = time.getUTCHours();
    hourCounts[hour]++;
  }

  // Find peak activity hours (likely working hours in local time)
  let peakHour = 0;
  let maxCount = 0;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > maxCount) {
      maxCount = hourCounts[h];
      peakHour = h;
    }
  }

  // Most people are active 9am-5pm local time
  // If peak is at UTC hour X, assume local time is ~noon when X is noon
  // This is a simple heuristic; more sophisticated methods would:
  // 1. Look at consistent patterns across days
  // 2. Use multiple peaks
  // 3. Consider weekend vs weekday patterns

  // For now, use a simple offset calculation
  // If peak is around 14:00 UTC, likely US Eastern (10am local)
  // If peak is around 08:00 UTC, likely Europe (9am local)
  
  const workingHourMid = 11; // Assume peak activity around 11am local
  const offsetHours = (peakHour - workingHourMid + 24) % 24;
  
  let inferredTimezone = defaultTimezone;
  let confidence: 'low' | 'medium' | 'high' = 'low';

  // Map offset to common timezones
  if (offsetHours >= 11 && offsetHours <= 13) {
    // ~0 offset: UTC/London
    inferredTimezone = 'Europe/London';
    confidence = 'medium';
  } else if (offsetHours >= 14 && offsetHours <= 16) {
    // +5 offset: US Eastern
    inferredTimezone = 'America/New_York';
    confidence = 'medium';
  } else if (offsetHours >= 17 && offsetHours <= 19) {
    // +8 offset: US Pacific
    inferredTimezone = 'America/Los_Angeles';
    confidence = 'medium';
  } else if (offsetHours >= 1 && offsetHours <= 3) {
    // -5.5 offset: India
    inferredTimezone = 'Asia/Kolkata';
    confidence = 'medium';
  } else if (offsetHours >= 4 && offsetHours <= 6) {
    // -8 offset: Singapore/Hong Kong
    inferredTimezone = 'Asia/Singapore';
    confidence = 'medium';
  }

  // Increase confidence if we have more data
  if (messageTimes.length >= 10 && confidence === 'medium') {
    confidence = 'high';
  }

  return {
    timezone: inferredTimezone,
    confidence,
    source: 'inferred_from_messages',
  };
}

/**
 * Infer timezone from Facebook profile or location data
 */
export function inferTimezoneFromProfile(
  locationString?: string,
  locale?: string
): TimezoneInference {
  if (!locationString && !locale) {
    return {
      timezone: 'UTC',
      confidence: 'low',
      source: 'default',
    };
  }

  // Parse location string for city/country
  // This is simplified; production would use a geocoding service
  const location = (locationString || locale || '').toLowerCase();

  // US cities
  if (location.includes('new york') || location.includes('boston') || location.includes('miami')) {
    return {
      timezone: 'America/New_York',
      confidence: 'high',
      source: 'location',
    };
  }
  if (location.includes('chicago') || location.includes('dallas') || location.includes('houston')) {
    return {
      timezone: 'America/Chicago',
      confidence: 'high',
      source: 'location',
    };
  }
  if (location.includes('los angeles') || location.includes('san francisco') || location.includes('seattle')) {
    return {
      timezone: 'America/Los_Angeles',
      confidence: 'high',
      source: 'location',
    };
  }

  // Europe
  if (location.includes('london') || location.includes('uk') || location.includes('united kingdom')) {
    return {
      timezone: 'Europe/London',
      confidence: 'high',
      source: 'location',
    };
  }
  if (location.includes('paris') || location.includes('france') || location.includes('germany') || location.includes('berlin')) {
    return {
      timezone: 'Europe/Paris',
      confidence: 'high',
      source: 'location',
    };
  }

  // Asia
  if (location.includes('india') || location.includes('mumbai') || location.includes('delhi')) {
    return {
      timezone: 'Asia/Kolkata',
      confidence: 'high',
      source: 'location',
    };
  }
  if (location.includes('singapore')) {
    return {
      timezone: 'Asia/Singapore',
      confidence: 'high',
      source: 'location',
    };
  }
  if (location.includes('china') || location.includes('beijing') || location.includes('shanghai')) {
    return {
      timezone: 'Asia/Shanghai',
      confidence: 'high',
      source: 'location',
    };
  }
  if (location.includes('japan') || location.includes('tokyo')) {
    return {
      timezone: 'Asia/Tokyo',
      confidence: 'high',
      source: 'location',
    };
  }

  // Australia
  if (location.includes('sydney') || location.includes('melbourne')) {
    return {
      timezone: 'Australia/Sydney',
      confidence: 'high',
      source: 'location',
    };
  }

  return {
    timezone: 'UTC',
    confidence: 'low',
    source: 'default',
  };
}

/**
 * Get best timezone inference by combining multiple signals
 */
export function inferBestTimezone(
  messageTimes: Date[],
  locationString?: string,
  locale?: string,
  defaultTimezone: string = 'UTC'
): TimezoneInference {
  // Try profile-based inference first (most reliable)
  const profileInference = inferTimezoneFromProfile(locationString, locale);
  if (profileInference.confidence === 'high') {
    return profileInference;
  }

  // Try activity-based inference
  const activityInference = inferTimezoneFromActivity(messageTimes, defaultTimezone);
  if (activityInference.confidence === 'high') {
    return activityInference;
  }

  // Return the better of the two
  if (activityInference.confidence === 'medium' && profileInference.confidence === 'low') {
    return activityInference;
  }
  if (profileInference.confidence === 'medium' && activityInference.confidence === 'low') {
    return profileInference;
  }

  // If both are same confidence, prefer profile
  if (profileInference.confidence !== 'low') {
    return profileInference;
  }

  return activityInference;
}

/**
 * Validate if a timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get user-friendly timezone display name
 */
export function getTimezoneDisplayName(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(now);
    const timezonePart = parts.find((p) => p.type === 'timeZoneName');
    return timezonePart?.value || timezone;
  } catch {
    return timezone;
  }
}

/**
 * Get current offset from UTC for a timezone
 */
export function getTimezoneOffset(timezone: string): number {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  } catch {
    return 0;
  }
}

