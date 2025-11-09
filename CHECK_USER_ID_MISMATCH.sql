-- 🔍 CRITICAL CHECK - User ID Mismatch
-- From your response: user_id = "a3c2696c-1248-4603-9dfb-141879987556"

-- Check 1: Does this user have ANY conversations?
SELECT 
  'Total conversations for this user:' as info,
  COUNT(*) as count
FROM messenger_conversations
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556';

-- Check 2: What user_id does Prince have?
SELECT 
  'Prince user_id:' as info,
  sender_name,
  user_id,
  id as conversation_id
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%';

-- Check 3: Do they match?
SELECT 
  'USER ID COMPARISON' as check,
  'Rule user_id: a3c2696c-1248-4603-9dfb-141879987556' as rule_user,
  'Prince user_id: ' || user_id as prince_user,
  CASE 
    WHEN user_id = 'a3c2696c-1248-4603-9dfb-141879987556' THEN '✅ MATCH'
    ELSE '❌ MISMATCH - THIS IS WHY IT DOESNT WORK!'
  END as status
FROM messenger_conversations
WHERE sender_name LIKE '%Prince%';

-- Check 4: Show ALL conversations with their user_ids
SELECT 
  'All conversations in database:' as info,
  sender_name,
  user_id,
  last_message_time
FROM messenger_conversations
ORDER BY created_at DESC
LIMIT 10;

-- Check 5: What's YOUR actual user ID?
SELECT 
  'Your auth user ID:' as info,
  id as user_id,
  email
FROM auth.users
LIMIT 5;

-- ===== THE FIX =====
-- If user IDs don't match, run this:

-- OPTION A: Update rule to match Prince's actual user_id
/*
UPDATE ai_automation_rules
SET user_id = (SELECT user_id FROM messenger_conversations WHERE sender_name LIKE '%Prince%' LIMIT 1)
WHERE id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4';
*/

-- OPTION B: Update Prince to match rule's user_id
/*
UPDATE messenger_conversations
SET user_id = 'a3c2696c-1248-4603-9dfb-141879987556'
WHERE sender_name LIKE '%Prince%';
*/

-- After fixing, verify:
SELECT 
  'After fix - do they match now?' as check,
  ar.user_id as rule_user,
  mc.user_id as prince_user,
  ar.user_id = mc.user_id as match
FROM ai_automation_rules ar,
     messenger_conversations mc
WHERE ar.id = '8eea88bd-c9d3-4c67-b624-3696ba520cf4'
  AND mc.sender_name LIKE '%Prince%';

