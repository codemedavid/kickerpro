-- Diagnose why follow-ups stopped after first message
-- Run these queries in Supabase SQL Editor

-- 1. Check if automation is stopped for Prince
SELECT 
  stopped_at,
  stopped_reason,
  follow_ups_sent
FROM ai_automation_stops
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name = 'Prince Cj Lara'
);
-- If returns rows → Automation is STOPPED (this is why!)
-- If returns 0 rows → Automation is NOT stopped, different issue

-- 2. Check Prince's tags (are they still there?)
SELECT 
  t.name as tag_name,
  ct.created_at as tagged_at
FROM conversation_tags ct
JOIN tags t ON ct.tag_id = t.id
WHERE ct.conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name = 'Prince Cj Lara'
)
ORDER BY ct.created_at DESC;
-- If returns 0 rows → Tags were removed (this is why!)
-- If returns rows → Tags still there

-- 3. Check all executions for Prince
SELECT 
  status,
  executed_at,
  generated_message IS NOT NULL as has_message,
  error_message
FROM ai_automation_executions
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name = 'Prince Cj Lara'
)
ORDER BY executed_at DESC
LIMIT 10;

-- 4. Check automation rule settings
SELECT 
  max_follow_ups,
  stop_on_reply,
  include_tag_ids
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';
-- Check if max_follow_ups = 1 (only one follow-up allowed)

