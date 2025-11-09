-- 🚀 RUN THIS COMPLETE FIX
-- Copy ONLY this SQL (not the JSON examples) and run in Supabase SQL Editor

-- Your rule ID from the response: 8eea88bd-c9d3-4c67-b624-3696ba520cf4

-- Fix 1: Remove page filter
UPDATE ai_automation_rules
SET page_id = NULL
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Fix 2: Set 1-minute interval
UPDATE ai_automation_rules
SET time_interval_minutes = 1,
    time_interval_hours = NULL,
    time_interval_days = NULL
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Fix 3: Enable 24/7 mode
UPDATE ai_automation_rules
SET run_24_7 = true
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

-- Fix 4: Make Prince's last message old enough (10 minutes ago)
UPDATE messenger_conversations
SET last_message_time = NOW() - INTERVAL '10 minutes'
WHERE sender_name = 'Prince Cj Lara';

-- Fix 5: Add Prince's tag to conversation_tags table (CRITICAL!)
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT 
  mc.id as conversation_id,
  ar.include_tag_ids[1] as tag_id
FROM messenger_conversations mc,
     ai_automation_rules ar
WHERE mc.sender_name = 'Prince Cj Lara'
  AND ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND ar.include_tag_ids IS NOT NULL
  AND array_length(ar.include_tag_ids, 1) > 0
ON CONFLICT (conversation_id, tag_id) DO NOTHING;

-- Verification: Check if Prince will now be processed
SELECT 
  mc.sender_name,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last,
  EXISTS (
    SELECT 1 FROM conversation_tags ct 
    WHERE ct.conversation_id = mc.id
  ) as has_tags_in_junction_table,
  CASE 
    WHEN mc.last_message_time < NOW() - INTERVAL '1 minute'
    THEN '✅ Old enough'
    ELSE '❌ Too recent'
  END as time_status
FROM messenger_conversations mc
WHERE mc.sender_name = 'Prince Cj Lara';

