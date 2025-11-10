-- Simple diagnostic queries that avoid potentially missing columns
-- Run these in Supabase SQL Editor

-- 1. Check what columns exist in ai_automation_stops table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ai_automation_stops'
ORDER BY ordinal_position;

-- 2. Check if there are ANY stop records for Prince (using only basic columns)
SELECT *
FROM ai_automation_stops
WHERE sender_id IN (
  SELECT sender_id FROM messenger_conversations 
  WHERE sender_name = 'Prince Cj Lara'
);

-- 3. Check Prince's current tags
SELECT 
  t.name as tag_name
FROM conversation_tags ct
JOIN tags t ON ct.tag_id = t.id
WHERE ct.conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name = 'Prince Cj Lara'
);

-- 4. Check automation rule settings (simple)
SELECT 
  name,
  max_follow_ups,
  stop_on_reply,
  enabled
FROM ai_automation_rules
WHERE name = 'test 2';

-- 5. Count how many messages sent to Prince
SELECT COUNT(*) as total_sent
FROM ai_automation_executions
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name = 'Prince Cj Lara'
)
AND status = 'sent';



