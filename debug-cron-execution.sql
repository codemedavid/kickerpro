-- 🔍 Debug: Why is automation stuck in "Processing" without sending?

-- ===== CHECK 1: Is Cron Actually Running? =====
SELECT 'CHECK 1: Last time automation was attempted' as check;

SELECT 
  name,
  last_executed_at,
  NOW() - last_executed_at as time_since_last_execution,
  execution_count,
  success_count,
  failure_count
FROM ai_automation_rules
WHERE enabled = true
ORDER BY last_executed_at DESC;

-- Expected: last_executed_at should be recent (within 2-3 minutes)
-- If last_executed_at is NULL or very old → Cron is NOT running!

-- ===== CHECK 2: Execution Records Status =====
SELECT 'CHECK 2: Recent execution attempts' as check;

SELECT 
  ae.created_at,
  ae.executed_at,
  ae.status,
  ae.error_message,
  mc.sender_name,
  NOW() - ae.created_at as age
FROM ai_automation_executions ae
LEFT JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ae.created_at > NOW() - INTERVAL '30 minutes'
ORDER BY ae.created_at DESC
LIMIT 20;

-- Look for:
-- status = 'processing' with no executed_at → STUCK!
-- status = 'failed' → Check error_message
-- No rows at all → Cron never executed

-- ===== CHECK 3: Stuck in Processing State? =====
SELECT 'CHECK 3: Records stuck in processing' as check;

SELECT 
  ae.id,
  mc.sender_name,
  ae.status,
  ae.created_at,
  NOW() - ae.created_at as stuck_duration,
  ae.error_message
FROM ai_automation_executions ae
LEFT JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ae.status = 'processing'
  AND ae.created_at < NOW() - INTERVAL '5 minutes'
ORDER BY ae.created_at DESC;

-- If rows exist → Executions started but never completed (STUCK)

-- ===== CHECK 4: Monitoring Table (Active States) =====
SELECT 'CHECK 4: Active automation contact states' as check;

SELECT 
  COUNT(*) as total_active,
  current_stage,
  COUNT(*) as count_by_stage
FROM ai_automation_contact_states
WHERE updated_at > NOW() - INTERVAL '30 minutes'
GROUP BY current_stage;

-- If shows 50 in 'processing' or 'generating' → Stuck!

-- ===== CHECK 5: Prince Cj Lara Specific Status =====
SELECT 'CHECK 5: Prince Cj Lara execution history' as check;

SELECT 
  ae.created_at,
  ae.executed_at,
  ae.status,
  ae.generated_message,
  ae.error_message,
  ae.facebook_message_id
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE mc.sender_name = 'Prince Cj Lara'
ORDER BY ae.created_at DESC
LIMIT 10;

-- Check:
-- Has generated_message → AI generated successfully
-- Has facebook_message_id → Actually sent to Facebook
-- Has error_message → Failed with error

-- ===== CHECK 6: Is Rule Actually Enabled and Configured? =====
SELECT 'CHECK 6: Rule configuration' as check;

SELECT 
  id,
  name,
  enabled,
  time_interval_minutes,
  include_tag_ids,
  max_messages_per_day,
  active_hours_start,
  active_hours_end,
  run_24_7,
  EXTRACT(HOUR FROM NOW()) as current_hour
FROM ai_automation_rules
ORDER BY created_at DESC
LIMIT 5;

-- Verify:
-- enabled = true
-- include_tag_ids has your tag
-- Within active hours OR run_24_7 = true

-- ===== CHECK 7: Daily Quota Status =====
SELECT 'CHECK 7: Quota usage today' as check;

SELECT 
  ar.name,
  ar.max_messages_per_day as quota,
  COUNT(*) FILTER (WHERE ae.created_at >= CURRENT_DATE AND ae.status = 'sent') as used_today,
  ar.max_messages_per_day - COUNT(*) FILTER (WHERE ae.created_at >= CURRENT_DATE AND ae.status = 'sent') as remaining
FROM ai_automation_rules ar
LEFT JOIN ai_automation_executions ae ON ar.id = ae.rule_id
WHERE ar.enabled = true
GROUP BY ar.id, ar.name, ar.max_messages_per_day;

-- If remaining = 0 → Quota exhausted!

-- ===== FIX 1: Clear Stuck Processing Records =====
SELECT 'FIX 1: Clear stuck processing records' as fix;

/*
-- If records are stuck in 'processing' state, clean them up:
UPDATE ai_automation_executions
SET status = 'failed',
    error_message = 'Execution timed out',
    executed_at = NOW()
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '5 minutes';
*/

-- ===== FIX 2: Clear Old Monitoring States =====
SELECT 'FIX 2: Clear old monitoring states' as fix;

/*
-- If monitoring states are stuck, clear them:
DELETE FROM ai_automation_contact_states
WHERE updated_at < NOW() - INTERVAL '10 minutes';
*/

-- ===== FIX 3: Enable 24/7 Mode =====
SELECT 'FIX 3: Enable 24/7 mode to ignore time restrictions' as fix;

/*
UPDATE ai_automation_rules 
SET run_24_7 = true
WHERE enabled = true;
*/

-- ===== FIX 4: Increase Quota =====
SELECT 'FIX 4: Increase daily quota' as fix;

/*
UPDATE ai_automation_rules 
SET max_messages_per_day = 100
WHERE enabled = true;
*/

-- ===== DIAGNOSTIC SUMMARY =====
SELECT 'DIAGNOSTIC SUMMARY' as summary;

SELECT 
  'Enabled Rules' as metric,
  COUNT(*) as value
FROM ai_automation_rules WHERE enabled = true

UNION ALL

SELECT 
  'Executions Today',
  COUNT(*)
FROM ai_automation_executions WHERE created_at >= CURRENT_DATE

UNION ALL

SELECT 
  'Sent Today',
  COUNT(*)
FROM ai_automation_executions WHERE created_at >= CURRENT_DATE AND status = 'sent'

UNION ALL

SELECT 
  'Stuck in Processing',
  COUNT(*)
FROM ai_automation_executions WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes'

UNION ALL

SELECT 
  'Tagged Contacts',
  COUNT(*)
FROM conversation_tags WHERE tag_id = 'YOUR_TAG_ID'  -- Replace with your tag ID

UNION ALL

SELECT 
  'Eligible Contacts (30 min threshold)',
  COUNT(*)
FROM messenger_conversations 
WHERE last_message_time < NOW() - INTERVAL '30 minutes';

