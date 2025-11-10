-- Check if timezone updates are happening
-- Run this in Supabase SQL Editor to see current state

-- 1. Check all timezones in your recommendations
SELECT 
  c.sender_name,
  r.timezone,
  r.timezone_confidence,
  r.timezone_source,
  r.last_computed_at,
  r.updated_at
FROM contact_timing_recommendations r
JOIN messenger_conversations c ON c.id = r.conversation_id
ORDER BY r.updated_at DESC
LIMIT 20;

-- 2. Check for manual overrides
SELECT 
  c.sender_name,
  r.timezone,
  r.timezone_source,
  r.last_computed_at
FROM contact_timing_recommendations r
JOIN messenger_conversations c ON c.id = r.conversation_id
WHERE r.timezone_source = 'manual_override'
ORDER BY r.last_computed_at DESC;

-- 3. Count by timezone to see if any updates happened
SELECT 
  timezone,
  timezone_source,
  COUNT(*) as contact_count
FROM contact_timing_recommendations
GROUP BY timezone, timezone_source
ORDER BY contact_count DESC;

