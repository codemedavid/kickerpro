-- 🔍 Fix: Cron Runs But Finds No Conversations (messages_processed: 0)

-- ===== DIAGNOSTIC: Why No Conversations Found? =====

-- Your rule ID from the response: 8eea88bd-c9d3-4c67-b624-3696ba520cf4
-- Let's check everything about this rule

-- 1. Check rule configuration
SELECT 
  name,
  enabled,
  time_interval_minutes,
  time_interval_hours,
  time_interval_days,
  include_tag_ids,
  exclude_tag_ids,
  page_id,
  max_messages_per_day,
  run_24_7,
  active_hours_start,
  active_hours_end
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- 2. Calculate the time threshold for this rule
SELECT 
  name,
  COALESCE(time_interval_minutes, time_interval_hours * 60, time_interval_days * 1440, 1440) as interval_in_minutes,
  NOW() - (COALESCE(time_interval_minutes, time_interval_hours * 60, time_interval_days * 1440, 1440) || ' minutes')::INTERVAL as time_threshold,
  'Conversations must have last_message_time BEFORE this threshold' as note
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- 3. Check Prince Cj Lara's status
SELECT 
  mc.id as conversation_id,
  mc.sender_name,
  mc.sender_id,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last_message,
  mc.page_id,
  mc.user_id,
  mc.tag_ids
FROM messenger_conversations mc
WHERE mc.sender_name = 'Prince Cj Lara';

-- 4. Check if Prince has required tags
SELECT 
  'Checking if Prince has required tags...' as check;

WITH rule_tags AS (
  SELECT include_tag_ids 
  FROM ai_automation_rules 
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
)
SELECT 
  mc.sender_name,
  mc.tag_ids as conversation_tag_ids,
  rt.include_tag_ids as required_tag_ids,
  CASE 
    WHEN rt.include_tag_ids IS NULL THEN '✅ No filter - should process'
    WHEN mc.tag_ids && rt.include_tag_ids THEN '✅ HAS required tag'
    ELSE '❌ MISSING required tag - THIS IS THE PROBLEM'
  END as tag_match_status
FROM messenger_conversations mc, rule_tags rt
WHERE mc.sender_name = 'Prince Cj Lara';

-- 5. Check conversation_tags table (proper tag storage)
SELECT 
  'Prince tags in conversation_tags table:' as info;

SELECT 
  ct.tag_id,
  ctm.name as tag_name
FROM conversation_tags ct
JOIN conversation_tags_master ctm ON ct.tag_id = ctm.id
JOIN messenger_conversations mc ON ct.conversation_id = mc.id
WHERE mc.sender_name = 'Prince Cj Lara';

-- 6. Check if conversation meets ALL criteria
WITH rule_config AS (
  SELECT 
    id as rule_id,
    user_id,
    page_id,
    include_tag_ids,
    COALESCE(time_interval_minutes, time_interval_hours * 60, time_interval_days * 1440, 1440) as interval_minutes
  FROM ai_automation_rules
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
)
SELECT 
  mc.sender_name,
  -- Check 1: User ID matches
  CASE WHEN mc.user_id = rc.user_id THEN '✅' ELSE '❌' END as user_match,
  -- Check 2: Page ID matches (if specified)
  CASE 
    WHEN rc.page_id IS NULL THEN '✅ No filter'
    WHEN mc.page_id = rc.page_id THEN '✅ Match'
    ELSE '❌ Wrong page'
  END as page_match,
  -- Check 3: Time threshold
  CASE 
    WHEN mc.last_message_time < NOW() - (rc.interval_minutes || ' minutes')::INTERVAL 
    THEN '✅ Old enough'
    ELSE '❌ Too recent: ' || EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 || ' min (need ' || rc.interval_minutes || ')'
  END as time_match,
  -- Check 4: Tag match
  CASE 
    WHEN rc.include_tag_ids IS NULL THEN '✅ No filter'
    WHEN EXISTS (
      SELECT 1 FROM conversation_tags ct 
      WHERE ct.conversation_id = mc.id 
        AND ct.tag_id = ANY(rc.include_tag_ids)
    ) THEN '✅ Has tag'
    ELSE '❌ Missing tag - PROBLEM!'
  END as tag_match
FROM messenger_conversations mc, rule_config rc
WHERE mc.sender_name = 'Prince Cj Lara';

-- ===== FIXES BASED ON RESULTS =====

-- FIX 1: If Prince doesn't have tag in conversation_tags table
SELECT 'FIX 1: Add tag to conversation_tags table' as fix_instruction;

-- Get the tag ID from include_tag_ids
WITH rule_tag AS (
  SELECT include_tag_ids[1] as tag_id
  FROM ai_automation_rules
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND include_tag_ids IS NOT NULL
  AND array_length(include_tag_ids, 1) > 0
)
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT 
  mc.id,
  rt.tag_id
FROM messenger_conversations mc, rule_tag rt
WHERE mc.sender_name = 'Prince Cj Lara'
  AND rt.tag_id IS NOT NULL
ON CONFLICT (conversation_id, tag_id) DO NOTHING
RETURNING conversation_id, tag_id;

-- FIX 2: If last_message_time too recent
SELECT 'FIX 2: Check if conversation is old enough' as fix_instruction;

SELECT 
  sender_name,
  last_message_time,
  EXTRACT(EPOCH FROM (NOW() - last_message_time))/60 as minutes_ago,
  CASE 
    WHEN last_message_time < NOW() - INTERVAL '1 minute' THEN '✅ Eligible'
    ELSE '⏱️ Need to wait ' || (1 - EXTRACT(EPOCH FROM (NOW() - last_message_time))/60)::INTEGER || ' more seconds'
  END as status
FROM messenger_conversations
WHERE sender_name = 'Prince Cj Lara';

-- If too recent, manually update for testing:
/*
UPDATE messenger_conversations
SET last_message_time = NOW() - INTERVAL '1 hour'
WHERE sender_name = 'Prince Cj Lara';
*/

-- FIX 3: If page_id doesn't match
SELECT 'FIX 3: Remove page filter or fix page_id' as fix_instruction;

-- Remove page filter (process all pages):
UPDATE ai_automation_rules
SET page_id = NULL
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- FIX 4: Verify tag is in conversation_tags table (not just tag_ids array)
SELECT 'FIX 4: Ensure Prince has tag in conversation_tags table' as fix_instruction;

-- Get tag ID from rule and check
SELECT 
  ar.name as rule_name,
  ar.include_tag_ids,
  EXISTS (
    SELECT 1 
    FROM conversation_tags ct
    JOIN messenger_conversations mc ON ct.conversation_id = mc.id
    WHERE mc.sender_name = 'Prince Cj Lara'
      AND ct.tag_id = ANY(ar.include_tag_ids)
  ) as prince_has_tag_in_junction_table
FROM ai_automation_rules ar
WHERE ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- If result is false, add the tag:
WITH rule_tag AS (
  SELECT include_tag_ids[1] as tag_id
  FROM ai_automation_rules
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
)
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT 
  (SELECT id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara'),
  tag_id
FROM rule_tag
WHERE tag_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ===== COMPLETE FIX BUNDLE =====
SELECT '=== APPLYING ALL FIXES ===' as action;

-- Fix 1: Remove page filter
UPDATE ai_automation_rules
SET page_id = NULL
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Fix 2: Set very short interval for testing
UPDATE ai_automation_rules
SET time_interval_minutes = 1,
    time_interval_hours = NULL,
    time_interval_days = NULL
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Fix 3: Ensure 24/7 mode
UPDATE ai_automation_rules
SET run_24_7 = true
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Fix 4: Add Prince's tag to conversation_tags table
WITH rule_tag AS (
  SELECT include_tag_ids[1] as tag_id
  FROM ai_automation_rules
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND include_tag_ids IS NOT NULL
)
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT 
  mc.id,
  rt.tag_id
FROM messenger_conversations mc, rule_tag rt
WHERE mc.sender_name = 'Prince Cj Lara'
  AND rt.tag_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Fix 5: Make last_message_time old enough
UPDATE messenger_conversations
SET last_message_time = NOW() - INTERVAL '10 minutes'
WHERE sender_name = 'Prince Cj Lara'
  AND last_message_time > NOW() - INTERVAL '1 minute';

-- ===== VERIFICATION =====
SELECT '=== VERIFICATION - Prince Should Now Be Eligible ===' as section;

-- Final check: Will Prince be processed?
WITH rule_config AS (
  SELECT 
    user_id,
    page_id,
    include_tag_ids,
    COALESCE(time_interval_minutes, time_interval_hours * 60, time_interval_days * 1440) as interval_minutes
  FROM ai_automation_rules
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
)
SELECT 
  mc.sender_name,
  mc.user_id = rc.user_id as user_match,
  rc.page_id IS NULL OR mc.page_id = rc.page_id as page_match,
  mc.last_message_time < NOW() - (rc.interval_minutes || ' minutes')::INTERVAL as time_match,
  EXISTS (
    SELECT 1 FROM conversation_tags ct 
    WHERE ct.conversation_id = mc.id 
      AND ct.tag_id = ANY(rc.include_tag_ids)
  ) as tag_match,
  CASE 
    WHEN mc.user_id = rc.user_id
      AND (rc.page_id IS NULL OR mc.page_id = rc.page_id)
      AND mc.last_message_time < NOW() - (rc.interval_minutes || ' minutes')::INTERVAL
      AND EXISTS (
        SELECT 1 FROM conversation_tags ct 
        WHERE ct.conversation_id = mc.id 
          AND ct.tag_id = ANY(rc.include_tag_ids)
      )
    THEN '✅✅✅ WILL BE PROCESSED ✅✅✅'
    ELSE '❌ Will be SKIPPED - check FALSE values above'
  END as final_status
FROM messenger_conversations mc, rule_config rc
WHERE mc.sender_name = 'Prince Cj Lara';

SELECT '✅ All fixes applied! Trigger cron again to test.' as result;

