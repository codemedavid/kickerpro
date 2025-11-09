-- 🔧 Clear Stuck Processing - Works with ANY Schema
-- Run this in Supabase SQL Editor to fix stuck "Processing" state

-- ===== STEP 1: Check Current Schema =====
SELECT 'Checking ai_automation_executions columns...' as info;

SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'ai_automation_executions'
ORDER BY ordinal_position;

-- ===== STEP 2: Clear Stuck Processing Records (Safe) =====

-- Update stuck records to 'failed' using only guaranteed columns
UPDATE ai_automation_executions
SET status = 'failed',
    executed_at = NOW()  -- Use executed_at to mark completion
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '5 minutes';

-- Show how many were cleared
SELECT 
  'Stuck records cleared' as result,
  COUNT(*) as count
FROM ai_automation_executions
WHERE status = 'failed'
  AND executed_at > NOW() - INTERVAL '1 minute';

-- ===== STEP 3: Clear Old Monitoring States =====

-- Check if table exists first
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_automation_contact_states') THEN
    DELETE FROM ai_automation_contact_states
    WHERE updated_at < NOW() - INTERVAL '10 minutes';
    
    RAISE NOTICE '✅ Cleared old monitoring states';
  ELSE
    RAISE NOTICE 'ℹ️ Monitoring table does not exist (OK - optional feature)';
  END IF;
END $$;

-- ===== STEP 4: Enable 24/7 Mode =====

UPDATE ai_automation_rules 
SET run_24_7 = true
WHERE enabled = true;

SELECT 'Enabled 24/7 mode for all rules' as result;

-- ===== STEP 5: Check Current Status =====

-- Rule configuration
SELECT 
  name,
  enabled,
  run_24_7,
  time_interval_minutes,
  include_tag_ids,
  max_messages_per_day,
  last_executed_at,
  EXTRACT(HOUR FROM NOW()) as current_hour
FROM ai_automation_rules
WHERE enabled = true;

-- Recent executions for Prince Cj Lara
SELECT 
  ae.created_at,
  ae.status,
  ae.executed_at,
  ae.generated_message IS NOT NULL as has_generated_message,
  ae.facebook_message_id IS NOT NULL as was_sent_to_facebook
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE mc.sender_name LIKE '%Prince%'
ORDER BY ae.created_at DESC
LIMIT 5;

-- Count stuck records (should be 0 now)
SELECT 
  'Stuck in processing' as metric,
  COUNT(*) as value
FROM ai_automation_executions
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '5 minutes';

-- ===== STEP 6: Check Eligibility =====

-- Is Prince Cj Lara eligible?
SELECT 
  mc.sender_name,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last,
  EXISTS (
    SELECT 1 FROM conversation_tags ct 
    WHERE ct.conversation_id = mc.id
  ) as has_tags,
  CASE 
    WHEN mc.last_message_time < NOW() - INTERVAL '1 minute' THEN '✅ ELIGIBLE (> 1 min)'
    ELSE '⏱️ Too recent (< 1 min)'
  END as eligibility_status
FROM messenger_conversations mc
WHERE mc.sender_name LIKE '%Prince%';

-- ===== STEP 7: Final Verification =====

SELECT '=== DIAGNOSTIC SUMMARY ===' as section;

SELECT 
  'Total Enabled Rules' as metric,
  COUNT(*) as value
FROM ai_automation_rules WHERE enabled = true

UNION ALL

SELECT 
  'Rules in 24/7 Mode',
  COUNT(*)
FROM ai_automation_rules WHERE enabled = true AND run_24_7 = true

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
  'Stuck Records (should be 0)',
  COUNT(*)
FROM ai_automation_executions WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes'

UNION ALL

SELECT 
  'Tagged Conversations',
  COUNT(*)
FROM conversation_tags;

-- ===== SUCCESS MESSAGE =====
SELECT '✅ All fixes applied! Now trigger automation manually or wait for next cron run.' as final_message;

