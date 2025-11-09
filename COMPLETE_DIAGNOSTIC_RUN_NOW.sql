-- 🔍 COMPLETE DIAGNOSTIC - Find Why Automation Still Not Working
-- Run this ENTIRE script in Supabase SQL Editor
-- It will show you EXACTLY what's wrong

-- ===== SECTION 1: CHECK RULE CONFIGURATION =====
SELECT '=== SECTION 1: RULE CONFIGURATION ===' as section;

SELECT 
  id,
  name,
  enabled,
  user_id,
  page_id,
  time_interval_minutes,
  time_interval_hours,
  time_interval_days,
  include_tag_ids,
  exclude_tag_ids,
  max_messages_per_day,
  run_24_7,
  active_hours_start,
  active_hours_end
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- ===== SECTION 2: CHECK PRINCE EXISTS =====
SELECT '=== SECTION 2: DOES PRINCE EXIST? ===' as section;

SELECT 
  id as conversation_id,
  sender_name,
  sender_id,
  page_id,
  user_id,
  last_message_time,
  EXTRACT(EPOCH FROM (NOW() - last_message_time))/60 as minutes_since_last,
  tag_ids as tag_ids_array_column,
  message_count
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%'
LIMIT 5;

-- ===== SECTION 3: CHECK PRINCE'S TAGS =====
SELECT '=== SECTION 3: PRINCE TAGS IN JUNCTION TABLE ===' as section;

SELECT 
  mc.sender_name,
  ct.tag_id,
  ctm.name as tag_name
FROM messenger_conversations mc
LEFT JOIN conversation_tags ct ON mc.id = ct.conversation_id
LEFT JOIN conversation_tags_master ctm ON ct.tag_id = ctm.id
WHERE mc.sender_name LIKE '%Prince%';

-- ===== SECTION 4: COMPARE RULE TAGS VS PRINCE TAGS =====
SELECT '=== SECTION 4: TAG MATCH CHECK ===' as section;

WITH rule_info AS (
  SELECT include_tag_ids FROM ai_automation_rules 
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
),
prince_info AS (
  SELECT 
    mc.id,
    mc.sender_name,
    ARRAY_AGG(ct.tag_id) as actual_tag_ids
  FROM messenger_conversations mc
  LEFT JOIN conversation_tags ct ON mc.id = ct.conversation_id
  WHERE mc.sender_name LIKE '%Prince%'
  GROUP BY mc.id, mc.sender_name
)
SELECT 
  pi.sender_name,
  ri.include_tag_ids as required_tags,
  pi.actual_tag_ids as prince_tags,
  CASE 
    WHEN ri.include_tag_ids IS NULL THEN '✅ No filter - should process'
    WHEN pi.actual_tag_ids && ri.include_tag_ids THEN '✅ Tags match!'
    WHEN pi.actual_tag_ids IS NULL THEN '❌ Prince has NO tags in conversation_tags table'
    ELSE '❌ Tag mismatch - required: ' || ri.include_tag_ids::TEXT || ', has: ' || COALESCE(pi.actual_tag_ids::TEXT, 'NULL')
  END as tag_status
FROM prince_info pi, rule_info ri;

-- ===== SECTION 5: CHECK USER ID MATCH =====
SELECT '=== SECTION 5: USER ID MATCH ===' as section;

SELECT 
  'Rule user_id:' as field,
  ar.user_id as value
FROM ai_automation_rules ar
WHERE ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
UNION ALL
SELECT 
  'Prince user_id:',
  mc.user_id
FROM messenger_conversations mc
WHERE mc.sender_name LIKE '%Prince%'
LIMIT 1;

-- Check if they match
SELECT 
  CASE 
    WHEN ar.user_id = mc.user_id THEN '✅ User IDs match'
    ELSE '❌ User ID mismatch - THIS IS THE PROBLEM!'
  END as user_id_status,
  ar.user_id as rule_user,
  mc.user_id as prince_user
FROM ai_automation_rules ar,
     messenger_conversations mc
WHERE ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND mc.sender_name LIKE '%Prince%'
LIMIT 1;

-- ===== SECTION 6: CHECK PAGE ID MATCH =====
SELECT '=== SECTION 6: PAGE ID MATCH ===' as section;

SELECT 
  ar.page_id as rule_page_id,
  mc.page_id as prince_page_id,
  CASE 
    WHEN ar.page_id IS NULL THEN '✅ No page filter - OK'
    WHEN ar.page_id = mc.page_id THEN '✅ Page IDs match'
    ELSE '❌ Page mismatch - THIS IS THE PROBLEM!'
  END as page_status
FROM ai_automation_rules ar,
     messenger_conversations mc
WHERE ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND mc.sender_name LIKE '%Prince%'
LIMIT 1;

-- ===== SECTION 7: CHECK TIME THRESHOLD =====
SELECT '=== SECTION 7: TIME THRESHOLD CHECK ===' as section;

WITH rule_interval AS (
  SELECT COALESCE(time_interval_minutes, time_interval_hours * 60, time_interval_days * 1440, 1440) as minutes
  FROM ai_automation_rules
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
)
SELECT 
  mc.sender_name,
  mc.last_message_time,
  NOW() - (ri.minutes || ' minutes')::INTERVAL as threshold,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last,
  ri.minutes as interval_required,
  CASE 
    WHEN mc.last_message_time < NOW() - (ri.minutes || ' minutes')::INTERVAL 
    THEN '✅ Old enough - should process'
    ELSE '❌ Too recent - need to wait ' || (ri.minutes - EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60)::INTEGER || ' more minutes'
  END as time_status
FROM messenger_conversations mc, rule_interval ri
WHERE mc.sender_name LIKE '%Prince%';

-- ===== SECTION 8: CHECK IF STOPPED =====
SELECT '=== SECTION 8: IS AUTOMATION STOPPED? ===' as section;

SELECT 
  aas.stopped_reason,
  aas.stopped_at,
  aas.follow_ups_sent
FROM ai_automation_stops aas
JOIN messenger_conversations mc ON aas.conversation_id = mc.id
WHERE mc.sender_name LIKE '%Prince%'
  AND aas.rule_id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- If returns rows, Prince is stopped!

-- ===== SECTION 9: COMPLETE ELIGIBILITY CHECK =====
SELECT '=== SECTION 9: COMPLETE ELIGIBILITY ANALYSIS ===' as section;

WITH rule_config AS (
  SELECT 
    id,
    user_id as rule_user_id,
    page_id as rule_page_id,
    include_tag_ids,
    COALESCE(time_interval_minutes, time_interval_hours * 60, time_interval_days * 1440, 1440) as interval_minutes
  FROM ai_automation_rules
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
)
SELECT 
  mc.sender_name,
  '1. User ID' as check_1,
  CASE WHEN mc.user_id = rc.rule_user_id THEN '✅ Match' ELSE '❌ Mismatch: rule=' || rc.rule_user_id || ', conv=' || mc.user_id END as check_1_result,
  '2. Page ID' as check_2,
  CASE 
    WHEN rc.rule_page_id IS NULL THEN '✅ No filter'
    WHEN mc.page_id = rc.rule_page_id THEN '✅ Match'
    ELSE '❌ Mismatch: rule=' || COALESCE(rc.rule_page_id::TEXT, 'NULL') || ', conv=' || mc.page_id::TEXT
  END as check_2_result,
  '3. Time' as check_3,
  CASE 
    WHEN mc.last_message_time < NOW() - (rc.interval_minutes || ' minutes')::INTERVAL 
    THEN '✅ Old enough (' || EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 || ' min ago)'
    ELSE '❌ Too recent (' || EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 || ' min, need ' || rc.interval_minutes || ')'
  END as check_3_result,
  '4. Tag' as check_4,
  CASE 
    WHEN rc.include_tag_ids IS NULL THEN '✅ No filter'
    WHEN EXISTS (
      SELECT 1 FROM conversation_tags ct 
      WHERE ct.conversation_id = mc.id 
        AND ct.tag_id = ANY(rc.include_tag_ids)
    ) THEN '✅ Has tag in conversation_tags'
    ELSE '❌ NO TAG in conversation_tags - THIS IS THE PROBLEM!'
  END as check_4_result,
  '5. Stopped?' as check_5,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM ai_automation_stops aas
      WHERE aas.conversation_id = mc.id AND aas.rule_id = rc.id
    ) THEN '❌ Stopped'
    ELSE '✅ Not stopped'
  END as check_5_result
FROM messenger_conversations mc, rule_config rc
WHERE mc.sender_name LIKE '%Prince%';

-- ===== FINAL SUMMARY =====
SELECT '=== FINAL SUMMARY - WHAT NEEDS FIXING ===' as section;

-- This will tell you exactly what's wrong
SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM messenger_conversations WHERE sender_name LIKE '%Prince%')
    THEN '❌ PROBLEM: Prince Cj Lara not found in messenger_conversations table!'
    
    WHEN (SELECT user_id FROM messenger_conversations WHERE sender_name LIKE '%Prince%' LIMIT 1) != 
         (SELECT user_id FROM ai_automation_rules WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4')
    THEN '❌ PROBLEM: User ID mismatch between rule and conversation!'
    
    WHEN NOT EXISTS (
      SELECT 1 FROM conversation_tags ct
      JOIN messenger_conversations mc ON ct.conversation_id = mc.id
      WHERE mc.sender_name LIKE '%Prince%'
        AND ct.tag_id = ANY((SELECT include_tag_ids FROM ai_automation_rules WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'))
    )
    THEN '❌ PROBLEM: Prince does NOT have required tag in conversation_tags junction table!'
    
    WHEN (SELECT last_message_time FROM messenger_conversations WHERE sender_name LIKE '%Prince%' LIMIT 1) > 
         NOW() - INTERVAL '1 minute'
    THEN '❌ PROBLEM: Prince last message too recent (< 1 minute ago)!'
    
    WHEN EXISTS (
      SELECT 1 FROM ai_automation_stops aas
      JOIN messenger_conversations mc ON aas.conversation_id = mc.id
      WHERE mc.sender_name LIKE '%Prince%'
        AND aas.rule_id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
    )
    THEN '❌ PROBLEM: Automation is stopped for Prince!'
    
    ELSE '✅ All checks passed - should be processing! Check Vercel logs for errors.'
  END as problem_diagnosis;

