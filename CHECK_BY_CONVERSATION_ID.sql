-- Check executions by conversation_id (not recipient_psid)
-- This might be why we see "last processed" but no records

-- 1. Get Prince's conversation ID
SELECT 
  id as conversation_id,
  sender_id as recipient_psid,
  sender_name
FROM messenger_conversations
WHERE sender_name = 'Prince Cj Lara'
LIMIT 1;

-- Copy the conversation_id from above, then:

-- 2. Check executions by CONVERSATION_ID
-- Replace 'PASTE_CONVERSATION_ID_HERE' with the actual ID from step 1
SELECT 
  id,
  status,
  created_at,
  executed_at,
  generated_message IS NOT NULL as has_message,
  error_message,
  conversation_id,
  recipient_psid
FROM ai_automation_executions
WHERE conversation_id = 'PASTE_CONVERSATION_ID_HERE'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Or check all executions for the rule
SELECT 
  e.id,
  e.status,
  e.created_at,
  c.sender_name,
  e.conversation_id,
  e.recipient_psid
FROM ai_automation_executions e
LEFT JOIN messenger_conversations c ON e.conversation_id = c.id
WHERE e.rule_id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
ORDER BY e.created_at DESC
LIMIT 20;

