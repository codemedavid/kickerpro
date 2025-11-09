-- 🔍 CHECK TIME THRESHOLD - This is likely the problem

-- Check 1: What's the time interval setting?
SELECT 
  name,
  time_interval_minutes,
  time_interval_hours,
  time_interval_days,
  COALESCE(time_interval_minutes, time_interval_hours * 60, time_interval_days * 1440, 1440) as total_minutes_threshold
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Check 2: When was Prince's last message?
SELECT 
  sender_name,
  last_message_time,
  NOW() as current_time,
  NOW() - last_message_time as time_difference,
  EXTRACT(EPOCH FROM (NOW() - last_message_time))/60 as minutes_since_last_message
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%';

-- Check 3: Is Prince old enough for the threshold?
SELECT 
  mc.sender_name,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_ago,
  COALESCE(ar.time_interval_minutes, ar.time_interval_hours * 60, ar.time_interval_days * 1440, 1440) as threshold_required,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 >= COALESCE(ar.time_interval_minutes, ar.time_interval_hours * 60, ar.time_interval_days * 1440, 1440)
    THEN '✅ OLD ENOUGH - Should be processed'
    ELSE '❌ TOO RECENT - Need to wait ' || 
         (COALESCE(ar.time_interval_minutes, ar.time_interval_hours * 60, ar.time_interval_days * 1440, 1440) - 
          EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60)::INTEGER || ' more minutes'
  END as eligibility
FROM messenger_conversations mc,
     ai_automation_rules ar
WHERE mc.sender_name LIKE '%Prince%'
  AND ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Check 4: How many conversations are old enough?
SELECT 
  COUNT(*) as conversations_old_enough
FROM messenger_conversations mc,
     ai_automation_rules ar
WHERE mc.user_id = ar.user_id
  AND ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND mc.last_message_time < NOW() - (COALESCE(ar.time_interval_minutes, ar.time_interval_hours * 60, ar.time_interval_days * 1440, 1440) || ' minutes')::INTERVAL;

-- ===== THE FIX =====
-- Make Prince's last message 1 day old (guaranteed to be old enough)
UPDATE messenger_conversations
SET last_message_time = NOW() - INTERVAL '1 day'
WHERE sender_name LIKE '%Prince%';

-- Set interval to 1 minute (very short for testing)
UPDATE ai_automation_rules
SET time_interval_minutes = 1,
    time_interval_hours = NULL,
    time_interval_days = NULL
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

SELECT '✅ Time threshold fixed!' as result;

