-- Check Prince Cj Lara's execution records
-- Run this in Supabase SQL Editor to see what's happening

-- 1. Find Prince's conversation ID
SELECT 
  id as conversation_id,
  sender_id,
  sender_name,
  last_message_time,
  page_id
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%'
ORDER BY last_message_time DESC
LIMIT 5;

-- 2. Check his automation executions
SELECT 
  id,
  status,
  created_at,
  executed_at,
  generated_message,
  error_message,
  facebook_message_id
FROM ai_automation_executions
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name LIKE '%Prince%'
)
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if there are STUCK executions (status='processing')
SELECT 
  COUNT(*) as stuck_count,
  status
FROM ai_automation_executions
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name LIKE '%Prince%'
)
GROUP BY status;

-- 4. Check automation stops
SELECT 
  stopped_at,
  stopped_reason,
  follow_ups_sent
FROM ai_automation_stops
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name LIKE '%Prince%'
)
ORDER BY stopped_at DESC;

