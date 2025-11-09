-- ULTRA SIMPLE CHECK
-- Run each query ONE AT A TIME and share results

-- Query 1: How many conversations does this user have?
SELECT COUNT(*) as total_conversations
FROM messenger_conversations
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556';

-- Query 2: What user_id does Prince have?
SELECT user_id 
FROM messenger_conversations 
WHERE sender_name LIKE '%Prince%';

-- Query 3: Show ALL conversations (any user)
SELECT sender_name, user_id, last_message_time
FROM messenger_conversations
ORDER BY created_at DESC
LIMIT 10;

-- Query 4: Show the rule
SELECT user_id, page_id, include_tag_ids, enabled
FROM ai_automation_rules
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';

