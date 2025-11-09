-- 🚀 QUICK TEST: Force AI Automation to Run NOW
-- This will help diagnose why automations aren't triggering

-- ===== STEP 1: CHECK CURRENT STATUS =====
SELECT '=== STEP 1: AUTOMATION RULES STATUS ===' as info;

SELECT 
  id,
  name,
  enabled,
  time_interval_minutes,
  time_interval_hours,
  time_interval_days,
  active_hours_start,
  active_hours_end,
  run_24_7,
  max_messages_per_day,
  last_executed_at,
  execution_count,
  success_count,
  failure_count
FROM ai_automation_rules
ORDER BY created_at DESC;

-- ===== STEP 2: CHECK CURRENT TIME =====
SELECT '=== STEP 2: CURRENT TIME CHECK ===' as info;

SELECT 
  NOW() as current_time_utc,
  EXTRACT(HOUR FROM NOW()) as current_hour_utc,
  EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Manila') as current_hour_manila,
  NOW() AT TIME ZONE 'Asia/Manila' as current_time_manila;

-- ===== STEP 3: CHECK ACTIVE HOURS MATCH =====
SELECT '=== STEP 3: ACTIVE HOURS VALIDATION ===' as info;

SELECT 
  name,
  enabled,
  run_24_7,
  active_hours_start,
  active_hours_end,
  EXTRACT(HOUR FROM NOW()) as current_hour,
  CASE 
    WHEN NOT enabled THEN '❌ DISABLED'
    WHEN run_24_7 THEN '✅ 24/7 MODE - SHOULD RUN'
    WHEN EXTRACT(HOUR FROM NOW()) >= active_hours_start 
     AND EXTRACT(HOUR FROM NOW()) < active_hours_end 
    THEN '✅ WITHIN HOURS - SHOULD RUN'
    ELSE '❌ OUTSIDE HOURS - WILL BE SKIPPED'
  END as status
FROM ai_automation_rules;

-- ===== STEP 4: CHECK DAILY QUOTA =====
SELECT '=== STEP 4: DAILY QUOTA CHECK ===' as info;

SELECT 
  ar.name,
  ar.max_messages_per_day as quota,
  COUNT(*) FILTER (WHERE ae.created_at >= CURRENT_DATE AND ae.status = 'sent') as sent_today,
  ar.max_messages_per_day - COUNT(*) FILTER (WHERE ae.created_at >= CURRENT_DATE AND ae.status = 'sent') as remaining,
  CASE 
    WHEN COUNT(*) FILTER (WHERE ae.created_at >= CURRENT_DATE AND ae.status = 'sent') >= ar.max_messages_per_day 
    THEN '❌ QUOTA REACHED'
    ELSE '✅ QUOTA AVAILABLE'
  END as status
FROM ai_automation_rules ar
LEFT JOIN ai_automation_executions ae ON ar.id = ae.rule_id
GROUP BY ar.id, ar.name, ar.max_messages_per_day;

-- ===== STEP 5: CHECK ELIGIBLE CONVERSATIONS =====
SELECT '=== STEP 5: ELIGIBLE CONVERSATIONS ===' as info;

SELECT 
  COUNT(*) as total_conversations,
  COUNT(*) FILTER (WHERE last_message_time < NOW() - INTERVAL '15 minutes') as eligible_15min,
  COUNT(*) FILTER (WHERE last_message_time < NOW() - INTERVAL '30 minutes') as eligible_30min,
  COUNT(*) FILTER (WHERE last_message_time < NOW() - INTERVAL '1 hour') as eligible_1hour,
  COUNT(*) FILTER (WHERE last_message_time < NOW() - INTERVAL '24 hours') as eligible_24hour
FROM messenger_conversations;

-- ===== STEP 6: SAMPLE ELIGIBLE CONVERSATIONS =====
SELECT '=== STEP 6: SAMPLE CONVERSATIONS (should be processed) ===' as info;

SELECT 
  mc.sender_name,
  mc.last_message_time,
  NOW() - mc.last_message_time as time_since_last_msg,
  mc.message_count,
  mc.tag_ids,
  CASE 
    WHEN mc.last_message_time < NOW() - INTERVAL '30 minutes' THEN '✅ Eligible'
    ELSE '⏱️ Too recent'
  END as status
FROM messenger_conversations mc
ORDER BY mc.last_message_time DESC
LIMIT 10;

-- ===== STEP 7: CHECK RECENT EXECUTIONS =====
SELECT '=== STEP 7: RECENT EXECUTION HISTORY ===' as info;

SELECT 
  ar.name as rule_name,
  mc.sender_name as contact_name,
  ae.status,
  ae.generated_message,
  ae.error_message,
  ae.created_at,
  ae.executed_at,
  NOW() - ae.created_at as time_since_execution
FROM ai_automation_executions ae
JOIN ai_automation_rules ar ON ae.rule_id = ar.id
LEFT JOIN messenger_conversations mc ON ae.conversation_id = mc.id
ORDER BY ae.created_at DESC
LIMIT 20;

-- ===== STEP 8: CHECK FACEBOOK PAGES =====
SELECT '=== STEP 8: FACEBOOK PAGES STATUS ===' as info;

SELECT 
  page_name,
  page_id,
  CASE 
    WHEN access_token IS NOT NULL THEN '✅ Token exists'
    ELSE '❌ No token'
  END as token_status,
  LENGTH(access_token) as token_length,
  created_at
FROM facebook_pages
ORDER BY created_at DESC;

-- ===== FIX 1: ENABLE 24/7 MODE (if currently outside hours) =====
SELECT '=== FIX 1: ENABLE 24/7 MODE ===' as info;
SELECT 'Run this to enable 24/7 mode for all rules:' as instruction;
/*
UPDATE ai_automation_rules 
SET run_24_7 = true 
WHERE enabled = true;
*/

-- ===== FIX 2: REDUCE TIME INTERVAL (for testing) =====
SELECT '=== FIX 2: REDUCE TIME INTERVAL TO 15 MINUTES ===' as info;
SELECT 'Run this to make automations trigger more frequently:' as instruction;
/*
UPDATE ai_automation_rules 
SET time_interval_minutes = 15,
    time_interval_hours = NULL,
    time_interval_days = NULL
WHERE enabled = true;
*/

-- ===== FIX 3: REMOVE TAG FILTERS =====
SELECT '=== FIX 3: REMOVE TAG FILTERS ===' as info;
SELECT 'Run this to process ALL conversations (no tag restrictions):' as instruction;
/*
UPDATE ai_automation_rules 
SET include_tag_ids = NULL,
    exclude_tag_ids = NULL
WHERE enabled = true;
*/

-- ===== FIX 4: INCREASE QUOTA =====
SELECT '=== FIX 4: INCREASE DAILY QUOTA ===' as info;
SELECT 'Run this to increase daily message quota:' as instruction;
/*
UPDATE ai_automation_rules 
SET max_messages_per_day = 100
WHERE enabled = true;
*/

-- ===== COMPLETE DIAGNOSTIC SUMMARY =====
SELECT '=== DIAGNOSTIC SUMMARY ===' as info;

SELECT 
  'Total Rules' as metric,
  COUNT(*) as value
FROM ai_automation_rules
UNION ALL
SELECT 
  'Enabled Rules',
  COUNT(*) 
FROM ai_automation_rules WHERE enabled = true
UNION ALL
SELECT 
  'Rules in Active Hours',
  COUNT(*) 
FROM ai_automation_rules 
WHERE enabled = true 
  AND (run_24_7 = true 
    OR (EXTRACT(HOUR FROM NOW()) >= active_hours_start 
      AND EXTRACT(HOUR FROM NOW()) < active_hours_end))
UNION ALL
SELECT 
  'Total Conversations',
  COUNT(*) 
FROM messenger_conversations
UNION ALL
SELECT 
  'Conversations (inactive 30+ min)',
  COUNT(*) 
FROM messenger_conversations 
WHERE last_message_time < NOW() - INTERVAL '30 minutes'
UNION ALL
SELECT 
  'Facebook Pages Connected',
  COUNT(*) 
FROM facebook_pages
UNION ALL
SELECT 
  'Executions Today',
  COUNT(*) 
FROM ai_automation_executions 
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT 
  'Successful Sends Today',
  COUNT(*) 
FROM ai_automation_executions 
WHERE created_at >= CURRENT_DATE AND status = 'sent';

