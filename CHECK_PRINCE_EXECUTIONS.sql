-- Check Prince Cj Lara's execution records to see what's happening
-- Run this in Supabase SQL Editor

-- 1. Get Prince's conversation ID
SELECT 
  id,
  sender_id,
  sender_name,
  last_message_time
FROM messenger_conversations
WHERE sender_name = 'Prince Cj Lara'
LIMIT 1;

-- 2. Check ALL his executions with full details
SELECT 
  id,
  status,
  created_at,
  executed_at,
  generated_message IS NOT NULL as has_message,
  error_message,
  recipient_psid
FROM ai_automation_executions
WHERE recipient_psid IN (
  SELECT sender_id FROM messenger_conversations 
  WHERE sender_name = 'Prince Cj Lara'
)
ORDER BY created_at DESC
LIMIT 20;

-- 3. Count by status
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM ai_automation_executions
WHERE recipient_psid IN (
  SELECT sender_id FROM messenger_conversations 
  WHERE sender_name = 'Prince Cj Lara'
)
GROUP BY status;

-- 4. Check if there's a PROCESSING record that's stuck
SELECT 
  id,
  status,
  created_at,
  NOW() - created_at as age
FROM ai_automation_executions
WHERE recipient_psid IN (
  SELECT sender_id FROM messenger_conversations 
  WHERE sender_name = 'Prince Cj Lara'
)
AND status = 'processing'
ORDER BY created_at DESC;

