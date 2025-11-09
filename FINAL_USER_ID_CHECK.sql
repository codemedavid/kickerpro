-- ✅ SIMPLE USER ID CHECK - Copy and run this

-- Step 1: Show rule's user_id
SELECT 
  'RULE USER ID:' as info,
  user_id::TEXT as user_id
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Step 2: Show Prince's user_id
SELECT 
  'PRINCE USER ID:' as info,
  user_id::TEXT as user_id
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%';

-- Step 3: Check if they match
SELECT 
  ar.user_id::TEXT as rule_user_id,
  mc.user_id::TEXT as prince_user_id,
  CASE 
    WHEN ar.user_id = mc.user_id THEN '✅ MATCH - This is NOT the problem'
    ELSE '❌ MISMATCH - This IS the problem!'
  END as match_status
FROM ai_automation_rules ar,
     messenger_conversations mc
WHERE ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND mc.sender_name LIKE '%Prince%'
LIMIT 1;

-- ===== THE FIX =====
-- After seeing results above, run the appropriate fix:

-- If they DON'T match, run this:
UPDATE ai_automation_rules
SET user_id = (SELECT user_id FROM messenger_conversations WHERE sender_name LIKE '%Prince%' LIMIT 1)
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Also remove ALL filters
UPDATE ai_automation_rules
SET page_id = NULL,
    include_tag_ids = NULL,
    exclude_tag_ids = NULL,
    time_interval_minutes = 1,
    run_24_7 = true
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Make Prince's message old
UPDATE messenger_conversations
SET last_message_time = NOW() - INTERVAL '1 hour'
WHERE sender_name LIKE '%Prince%';

-- VERIFY FIX
SELECT 
  'After fix:' as status,
  ar.user_id = mc.user_id as user_ids_match_now,
  mc.sender_name,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last
FROM ai_automation_rules ar,
     messenger_conversations mc
WHERE ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND mc.sender_name LIKE '%Prince%';

SELECT '✅ Fix complete! Test cron now.' as result;

