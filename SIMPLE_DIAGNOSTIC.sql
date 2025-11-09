-- 🔍 SIMPLE DIAGNOSTIC - Works with Any Schema
-- Copy and run this in Supabase SQL Editor

-- ===== CHECK 1: Does Prince exist? =====
SELECT '=== CHECK 1: Prince Conversation ===' as section;

SELECT 
  id,
  sender_name,
  user_id,
  page_id,
  last_message_time,
  EXTRACT(EPOCH FROM (NOW() - last_message_time))/60 as minutes_ago
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%';

-- ===== CHECK 2: Rule Configuration =====
SELECT '=== CHECK 2: Rule Settings ===' as section;

SELECT 
  name,
  user_id as rule_user_id,
  page_id as rule_page_id,
  time_interval_minutes,
  include_tag_ids,
  run_24_7,
  enabled
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- ===== CHECK 3: Do User IDs Match? =====
SELECT '=== CHECK 3: User ID Match ===' as section;

SELECT 
  'Rule user_id: ' || ar.user_id as rule_user,
  'Prince user_id: ' || mc.user_id as prince_user,
  CASE 
    WHEN ar.user_id = mc.user_id THEN '✅ MATCH'
    ELSE '❌ MISMATCH - THIS IS THE PROBLEM!'
  END as match_status
FROM ai_automation_rules ar,
     messenger_conversations mc
WHERE ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND mc.sender_name LIKE '%Prince%'
LIMIT 1;

-- ===== CHECK 4: Does Prince have tag? =====
SELECT '=== CHECK 4: Prince Tags ===' as section;

SELECT 
  mc.sender_name,
  ct.tag_id,
  COUNT(*) as tag_count
FROM messenger_conversations mc
LEFT JOIN conversation_tags ct ON mc.id = ct.conversation_id
WHERE mc.sender_name LIKE '%Prince%'
GROUP BY mc.sender_name, ct.tag_id;

-- If tag_id is NULL, Prince has NO tags!

-- ===== CHECK 5: Time Eligibility =====
SELECT '=== CHECK 5: Is Last Message Old Enough? ===' as section;

SELECT 
  mc.sender_name,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_ago,
  ar.time_interval_minutes as interval_required,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 >= ar.time_interval_minutes
    THEN '✅ ELIGIBLE'
    ELSE '❌ TOO RECENT - Wait ' || (ar.time_interval_minutes - EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60)::INTEGER || ' more minutes'
  END as time_status
FROM messenger_conversations mc,
     ai_automation_rules ar
WHERE mc.sender_name LIKE '%Prince%'
  AND ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- ===== COMMON FIXES =====
SELECT '=== FIXES (uncomment and run the one you need) ===' as section;

-- FIX A: User ID mismatch - make rule match Prince's user
/*
UPDATE ai_automation_rules
SET user_id = (SELECT user_id FROM messenger_conversations WHERE sender_name LIKE '%Prince%' LIMIT 1)
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';
*/

-- FIX B: Remove page filter
/*
UPDATE ai_automation_rules
SET page_id = NULL
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';
*/

-- FIX C: Make last message old enough
/*
UPDATE messenger_conversations
SET last_message_time = NOW() - INTERVAL '10 minutes'
WHERE sender_name LIKE '%Prince%';
*/

-- FIX D: Add tag to Prince (need conversation_id and tag_id from checks above)
/*
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES ('PRINCE_CONVERSATION_ID', 'YOUR_TAG_ID');
*/

-- FIX E: Remove tag requirement (process all conversations)
/*
UPDATE ai_automation_rules
SET include_tag_ids = NULL
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';
*/

