-- Simple debug query for Prince Cj Lara
-- Run this in Supabase SQL Editor

-- 1. Find Prince's conversation
SELECT 
  id as conversation_id,
  sender_id,
  sender_name,
  last_message_time
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%'
LIMIT 1;

-- 2. Check his recent executions (basic columns only)
SELECT 
  id,
  status,
  created_at,
  executed_at,
  error_message
FROM ai_automation_executions
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name LIKE '%Prince%'
)
ORDER BY created_at DESC
LIMIT 10;

-- 3. Count by status
SELECT 
  status,
  COUNT(*) as count
FROM ai_automation_executions
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name LIKE '%Prince%'
)
GROUP BY status;

-- 4. Check if automation is stopped
SELECT 
  stopped_at,
  stopped_reason
FROM ai_automation_stops
WHERE conversation_id IN (
  SELECT id FROM messenger_conversations 
  WHERE sender_name LIKE '%Prince%'
);

