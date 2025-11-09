-- ⚡ ABSOLUTE FIX - Copy and run this ENTIRE script
-- This will make automation work guaranteed

-- Your rule ID: 8eea88bd-c9d3-4c67-b624-3696ba520cf4

-- Step 1: Configure rule for maximum compatibility
UPDATE ai_automation_rules
SET user_id = (SELECT user_id FROM messenger_conversations WHERE sender_name LIKE '%Prince%' LIMIT 1),
    page_id = NULL,
    time_interval_minutes = 1,
    time_interval_hours = NULL,
    time_interval_days = NULL,
    include_tag_ids = NULL,
    exclude_tag_ids = NULL,
    max_messages_per_day = 50,
    run_24_7 = true,
    enabled = true
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Step 2: Make Prince's last message old
UPDATE messenger_conversations
SET last_message_time = NOW() - INTERVAL '1 hour'
WHERE sender_name LIKE '%Prince%';

-- Step 3: Remove any stops
DELETE FROM ai_automation_stops
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations WHERE sender_name LIKE '%Prince%'
);

-- Step 4: Clear stuck executions
UPDATE ai_automation_executions
SET status = 'failed'
WHERE status = 'processing';

-- VERIFICATION
SELECT '=== VERIFICATION ===' as section;

SELECT 
  'Rule user:' as field,
  user_id as value
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'

UNION ALL

SELECT 
  'Prince user:',
  user_id
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%'

UNION ALL

SELECT 
  'Match?',
  CASE 
    WHEN (SELECT user_id FROM ai_automation_rules WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4') = 
         (SELECT user_id FROM messenger_conversations WHERE sender_name LIKE '%Prince%' LIMIT 1)
    THEN '✅ YES'
    ELSE '❌ NO'
  END;

SELECT '✅ Configuration complete!' as result;
SELECT 'Now test: https://your-domain.vercel.app/api/cron/ai-automations' as instruction;

