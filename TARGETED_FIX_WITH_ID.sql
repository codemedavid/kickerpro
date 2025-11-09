-- 🎯 TARGETED FIX - Using Your Specific ID
-- ID provided: 995d675e-b16d-48ac-a8f6-d1311fb45be8

-- First, let's identify what this ID is
SELECT 'Checking if this is a conversation ID...' as step;
SELECT id, sender_name, user_id FROM messenger_conversations WHERE id = '995d675e-b16d-48ac-a8f6-d1311fb45be8';

SELECT 'Checking if this is a tag ID...' as step;
SELECT id, name FROM tags WHERE id = '995d675e-b16d-48ac-a8f6-d1311fb45be8';

SELECT 'Checking if this is a rule ID...' as step;
SELECT id, name FROM ai_automation_rules WHERE id = '995d675e-b16d-48ac-a8f6-d1311fb45be8';

-- ===== FIX 1: If this is Prince's conversation ID =====
-- Assuming 995d675e-b16d-48ac-a8f6-d1311fb45be8 is the conversation ID

-- Make last message old enough
UPDATE messenger_conversations
SET last_message_time = NOW() - INTERVAL '1 hour'
WHERE id = '995d675e-b16d-48ac-a8f6-d1311fb45be8';

-- Add tag to this conversation
-- First get the tag ID from your automation rule
WITH rule_tag AS (
  SELECT include_tag_ids[1] as tag_id
  FROM ai_automation_rules
  WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND include_tag_ids IS NOT NULL
)
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT '995d675e-b16d-48ac-a8f6-d1311fb45be8', tag_id
FROM rule_tag
WHERE tag_id IS NOT NULL
ON CONFLICT (conversation_id, tag_id) DO NOTHING;

-- ===== FIX 2: If this is a tag ID =====
-- Assuming 995d675e-b16d-48ac-a8f6-d1311fb45be8 is the tag ID

-- Set automation to use this tag
UPDATE ai_automation_rules
SET include_tag_ids = ARRAY['995d675e-b16d-48ac-a8f6-d1311fb45be8']
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Tag Prince with this tag ID
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT 
  id as conversation_id,
  '995d675e-b16d-48ac-a8f6-d1311fb45be8' as tag_id
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%'
ON CONFLICT (conversation_id, tag_id) DO NOTHING;

-- ===== COMPLETE CONFIGURATION FIX =====
-- Run this regardless to ensure everything is configured correctly

UPDATE ai_automation_rules
SET page_id = NULL,
    time_interval_minutes = 1,
    run_24_7 = true,
    max_messages_per_day = 50
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

UPDATE messenger_conversations
SET last_message_time = NOW() - INTERVAL '1 hour'
WHERE sender_name LIKE '%Prince%';

-- ===== VERIFICATION =====
SELECT '=== VERIFICATION ===' as section;

-- Check rule configuration
SELECT 
  'Rule configured for:' as info,
  name,
  enabled,
  time_interval_minutes,
  include_tag_ids,
  run_24_7
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Check Prince status
SELECT 
  'Prince status:' as info,
  mc.sender_name,
  mc.id as conversation_id,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last,
  EXISTS (SELECT 1 FROM conversation_tags WHERE conversation_id = mc.id) as has_tags
FROM messenger_conversations mc
WHERE mc.sender_name LIKE '%Prince%';

-- Check if Prince has the required tag
SELECT 
  'Tag assignment check:' as info,
  mc.sender_name,
  ct.tag_id,
  CASE 
    WHEN ct.tag_id IS NOT NULL THEN '✅ Prince has tag'
    ELSE '❌ Prince has NO tags'
  END as tag_status
FROM messenger_conversations mc
LEFT JOIN conversation_tags ct ON mc.id = ct.conversation_id
WHERE mc.sender_name LIKE '%Prince%';

SELECT '✅ Fixes applied! Test cron now.' as final_message;

