-- 🛑 AI Automation Stop & Tag Management Helper
-- Quick commands to stop automations and manage tags

-- ===== SECTION 1: VIEW CURRENT STATUS =====

-- 1.1: See all your automation rules
SELECT 
  id,
  name,
  enabled,
  time_interval_minutes,
  include_tag_ids,
  exclude_tag_ids,
  max_messages_per_day
FROM ai_automation_rules
WHERE user_id = 'YOUR_USER_ID'  -- Replace with your user ID
ORDER BY created_at DESC;

-- 1.2: See which conversations are stopped
SELECT 
  ar.name as automation_name,
  mc.sender_name as contact_name,
  aas.stopped_reason,
  aas.stopped_at,
  aas.follow_ups_sent
FROM ai_automation_stops aas
JOIN ai_automation_rules ar ON aas.rule_id = ar.id
LEFT JOIN messenger_conversations mc ON aas.conversation_id = mc.id
WHERE ar.user_id = 'YOUR_USER_ID'  -- Replace with your user ID
ORDER BY aas.stopped_at DESC
LIMIT 50;

-- 1.3: See eligible conversations (that WILL be processed)
SELECT 
  mc.id as conversation_id,
  mc.sender_name,
  mc.sender_id,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last_msg,
  mc.tag_ids,
  EXISTS (
    SELECT 1 FROM ai_automation_stops aas
    WHERE aas.conversation_id = mc.id
      AND aas.rule_id = 'YOUR_RULE_ID'  -- Replace with your rule ID
  ) as is_stopped
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'  -- Replace with your user ID
  AND mc.last_message_time < NOW() - INTERVAL '30 minutes'  -- Adjust to your interval
ORDER BY mc.last_message_time DESC
LIMIT 20;

-- ===== SECTION 2: STOP AUTOMATION =====

-- 2.1: Stop automation for ONE conversation
INSERT INTO ai_automation_stops (
  rule_id,
  conversation_id,
  sender_id,
  stopped_reason,
  follow_ups_sent
) VALUES (
  'YOUR_RULE_ID',  -- Get from Section 1.1
  'CONVERSATION_ID',  -- Get from Section 1.3
  'SENDER_PSID',  -- Get from Section 1.3 (sender_id column)
  'manual_stop',  -- Reason: 'manual_stop', 'customer_request', 'spam_complaint', etc.
  0  -- Number of follow-ups sent so far
)
ON CONFLICT (rule_id, conversation_id) 
DO UPDATE SET 
  stopped_reason = 'manual_stop',
  stopped_at = NOW();

-- 2.2: Stop automation for MULTIPLE conversations (bulk stop)
INSERT INTO ai_automation_stops (rule_id, conversation_id, sender_id, stopped_reason)
SELECT 
  'YOUR_RULE_ID',  -- Your automation rule ID
  mc.id,
  mc.sender_id,
  'bulk_manual_stop'
FROM messenger_conversations mc
WHERE mc.sender_name IN ('John Doe', 'Jane Smith', 'Customer Name')  -- Replace with names
  AND mc.user_id = 'YOUR_USER_ID'  -- Replace with your user ID
ON CONFLICT (rule_id, conversation_id) DO NOTHING;

-- 2.3: Stop automation for conversations with specific tag
INSERT INTO ai_automation_stops (rule_id, conversation_id, sender_id, stopped_reason)
SELECT 
  'YOUR_RULE_ID',  -- Your automation rule ID
  mc.id,
  mc.sender_id,
  'tagged_for_stop'
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'  -- Replace with your user ID
  AND mc.tag_ids @> ARRAY['TAG_ID']::TEXT[]  -- Replace TAG_ID with actual tag ID
ON CONFLICT (rule_id, conversation_id) DO NOTHING;

-- ===== SECTION 3: RESUME AUTOMATION =====

-- 3.1: Resume (un-stop) one conversation
DELETE FROM ai_automation_stops 
WHERE rule_id = 'YOUR_RULE_ID'
  AND conversation_id = 'CONVERSATION_ID';

-- 3.2: Resume ALL stopped conversations for a rule
DELETE FROM ai_automation_stops 
WHERE rule_id = 'YOUR_RULE_ID';

-- 3.3: Resume specific conversations by name
DELETE FROM ai_automation_stops aas
USING messenger_conversations mc
WHERE aas.conversation_id = mc.id
  AND aas.rule_id = 'YOUR_RULE_ID'
  AND mc.sender_name IN ('John Doe', 'Jane Smith');  -- Replace with names

-- ===== SECTION 4: TAG MANAGEMENT =====

-- 4.1: See all your tags
SELECT 
  id,
  name,
  color,
  created_at
FROM conversation_tags_master
WHERE user_id = 'YOUR_USER_ID'  -- Replace with your user ID
ORDER BY name;

-- 4.2: Create new tag for automation filtering
INSERT INTO conversation_tags_master (name, color, user_id)
VALUES ('AI Ready', '#3B82F6', 'YOUR_USER_ID')  -- Replace user ID
RETURNING id;
-- Copy the returned ID for use below

-- 4.3: Tag conversations manually (one by one)
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES 
  ('CONVERSATION_ID_1', 'TAG_ID'),  -- Replace with actual IDs
  ('CONVERSATION_ID_2', 'TAG_ID'),
  ('CONVERSATION_ID_3', 'TAG_ID')
ON CONFLICT (conversation_id, tag_id) DO NOTHING;

-- 4.4: Tag ALL conversations (bulk tag)
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT 
  id as conversation_id,
  'TAG_ID' as tag_id  -- Replace with your tag ID
FROM messenger_conversations
WHERE user_id = 'YOUR_USER_ID'  -- Replace with your user ID
  AND last_message_time < NOW() - INTERVAL '1 day'  -- Example filter
ON CONFLICT (conversation_id, tag_id) DO NOTHING;

-- 4.5: Remove tag from conversations
DELETE FROM conversation_tags
WHERE tag_id = 'TAG_ID'
  AND conversation_id IN ('CONV_ID_1', 'CONV_ID_2');  -- Specific conversations

-- 4.6: Remove tag from ALL conversations
DELETE FROM conversation_tags
WHERE tag_id = 'TAG_ID';

-- ===== SECTION 5: CONFIGURE AUTOMATION TAG FILTERS =====

-- 5.1: Process ALL conversations (no tag filter)
UPDATE ai_automation_rules 
SET include_tag_ids = NULL,
    exclude_tag_ids = NULL
WHERE id = 'YOUR_RULE_ID';

-- 5.2: Process ONLY conversations with specific tag
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['TAG_ID']  -- Replace with your tag ID
WHERE id = 'YOUR_RULE_ID';

-- 5.3: Process ONLY conversations with ANY of multiple tags
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['TAG_ID_1', 'TAG_ID_2', 'TAG_ID_3']
WHERE id = 'YOUR_RULE_ID';

-- 5.4: Exclude conversations with specific tag
UPDATE ai_automation_rules 
SET exclude_tag_ids = ARRAY['TAG_ID']  -- Replace with tag to exclude
WHERE id = 'YOUR_RULE_ID';

-- 5.5: Combine include and exclude
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['INCLUDE_TAG_ID'],  -- Process only these
    exclude_tag_ids = ARRAY['EXCLUDE_TAG_ID']   -- But not these
WHERE id = 'YOUR_RULE_ID';

-- ===== SECTION 6: HELPER QUERIES =====

-- 6.1: Find conversations by name
SELECT id, sender_name, sender_id, last_message_time
FROM messenger_conversations
WHERE sender_name ILIKE '%search term%'  -- Replace with search term
  AND user_id = 'YOUR_USER_ID'
LIMIT 20;

-- 6.2: Find your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- 6.3: Count conversations by tag
SELECT 
  ctm.name as tag_name,
  COUNT(ct.conversation_id) as conversation_count
FROM conversation_tags_master ctm
LEFT JOIN conversation_tags ct ON ctm.id = ct.tag_id
WHERE ctm.user_id = 'YOUR_USER_ID'  -- Replace with your user ID
GROUP BY ctm.id, ctm.name
ORDER BY conversation_count DESC;

-- 6.4: See recent automation executions
SELECT 
  ar.name as rule_name,
  mc.sender_name,
  ae.status,
  ae.generated_message,
  ae.created_at,
  ae.executed_at
FROM ai_automation_executions ae
JOIN ai_automation_rules ar ON ae.rule_id = ar.id
LEFT JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ar.user_id = 'YOUR_USER_ID'  -- Replace with your user ID
ORDER BY ae.created_at DESC
LIMIT 50;

-- 6.5: Count executions today
SELECT 
  ar.name,
  COUNT(*) as total_today,
  COUNT(*) FILTER (WHERE ae.status = 'sent') as sent_today,
  COUNT(*) FILTER (WHERE ae.status = 'failed') as failed_today
FROM ai_automation_executions ae
JOIN ai_automation_rules ar ON ae.rule_id = ar.id
WHERE ar.user_id = 'YOUR_USER_ID'  -- Replace with your user ID
  AND ae.created_at >= CURRENT_DATE
GROUP BY ar.id, ar.name;

-- ===== SECTION 7: QUICK ACTIONS =====

-- 7.1: Emergency stop ALL automations
UPDATE ai_automation_rules 
SET enabled = false
WHERE user_id = 'YOUR_USER_ID';  -- Replace with your user ID

-- 7.2: Re-enable ALL automations
UPDATE ai_automation_rules 
SET enabled = true
WHERE user_id = 'YOUR_USER_ID';  -- Replace with your user ID

-- 7.3: Clear ALL stops (resume everything)
DELETE FROM ai_automation_stops aas
USING ai_automation_rules ar
WHERE aas.rule_id = ar.id
  AND ar.user_id = 'YOUR_USER_ID';  -- Replace with your user ID

-- 7.4: See conversations that will be processed in next cron run
SELECT 
  mc.sender_name,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_ago,
  mc.tag_ids,
  CASE 
    WHEN EXISTS (SELECT 1 FROM ai_automation_stops aas WHERE aas.conversation_id = mc.id) 
    THEN '🛑 STOPPED'
    ELSE '✅ WILL PROCESS'
  END as status
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'  -- Replace with your user ID
  AND mc.last_message_time < NOW() - INTERVAL '30 minutes'  -- Adjust to your interval
ORDER BY mc.last_message_time DESC
LIMIT 20;

-- ===== INSTRUCTIONS FOR USE =====
-- 
-- 1. Replace 'YOUR_USER_ID' with your actual user ID (use query 6.2)
-- 2. Replace 'YOUR_RULE_ID' with your automation rule ID (use Section 1.1)
-- 3. Replace 'CONVERSATION_ID', 'TAG_ID', etc. with actual IDs
-- 4. Run queries one at a time in Supabase SQL Editor
-- 5. Check results before running DELETE or UPDATE commands
--
-- ===== QUICK START =====
-- 
-- Step 1: Find your user ID
-- SELECT id FROM auth.users WHERE email = 'your-email@example.com';
--
-- Step 2: Find your rule ID
-- SELECT id, name FROM ai_automation_rules WHERE user_id = 'your-user-id';
--
-- Step 3: Stop a conversation
-- Use Section 2.1 with your IDs
--
-- Step 4: Verify it's stopped
-- Use Section 1.2 to see stopped conversations
--

