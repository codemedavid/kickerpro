-- 🏷️ STRICT TAG ENFORCEMENT FOR AI AUTOMATION
-- Ensures ONLY manually tagged conversations are processed

-- ===== STEP 1: SET UP YOUR AUTOMATION TAG =====

-- 1.1: Create a dedicated tag for AI automation (if not exists)
INSERT INTO conversation_tags_master (name, color, user_id)
VALUES ('AI Automation Ready', '#10B981', 'YOUR_USER_ID')  -- Replace with your user ID
ON CONFLICT DO NOTHING
RETURNING id;
-- SAVE THIS TAG ID! You'll need it below.

-- ===== STEP 2: CONFIGURE AUTOMATION TO REQUIRE TAG =====

-- 2.1: Set automation to ONLY process tagged conversations
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['YOUR_TAG_ID'],  -- Replace with tag ID from step 1.1
    exclude_tag_ids = NULL  -- Or keep exclusions if needed
WHERE id = 'YOUR_RULE_ID';  -- Replace with your automation rule ID

-- 2.2: IMPORTANT - If include_tag_ids is NULL or empty, automation processes ALL conversations
-- To ensure ONLY tagged conversations are processed, include_tag_ids MUST have a tag!

-- 2.3: Verify configuration
SELECT 
  id,
  name,
  include_tag_ids,
  CASE 
    WHEN include_tag_ids IS NULL OR include_tag_ids = '{}' THEN '⚠️ WARNING: Will process ALL conversations'
    ELSE '✅ Will process ONLY tagged conversations'
  END as enforcement_status
FROM ai_automation_rules
WHERE id = 'YOUR_RULE_ID';

-- ===== STEP 3: MANUALLY TAG CONVERSATIONS =====

-- 3.1: See conversations that need tagging
SELECT 
  mc.id as conversation_id,
  mc.sender_name,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last_msg,
  mc.tag_ids,
  CASE 
    WHEN mc.tag_ids @> ARRAY['YOUR_TAG_ID']::TEXT[] THEN '✅ HAS TAG - WILL BE PROCESSED'
    ELSE '❌ NO TAG - WILL BE SKIPPED'
  END as tag_status
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'
  AND mc.last_message_time < NOW() - INTERVAL '30 minutes'  -- Adjust to your interval
ORDER BY mc.last_message_time DESC
LIMIT 50;

-- 3.2: Manually tag specific conversations (one by one)
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES 
  ('CONVERSATION_ID_1', 'YOUR_TAG_ID'),
  ('CONVERSATION_ID_2', 'YOUR_TAG_ID'),
  ('CONVERSATION_ID_3', 'YOUR_TAG_ID')
ON CONFLICT (conversation_id, tag_id) DO NOTHING;

-- 3.3: Or tag by criteria (e.g., last message > 1 day ago)
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT 
  mc.id as conversation_id,
  'YOUR_TAG_ID' as tag_id
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'
  AND mc.last_message_time < NOW() - INTERVAL '1 day'
  AND NOT (mc.tag_ids @> ARRAY['YOUR_TAG_ID']::TEXT[])  -- Don't re-tag
  LIMIT 20  -- Tag only 20 at a time for safety
ON CONFLICT (conversation_id, tag_id) DO NOTHING;

-- ===== STEP 4: VERIFY ONLY TAGGED CONVERSATIONS WILL BE PROCESSED =====

-- 4.1: Count eligible conversations
SELECT 
  'Total conversations' as metric,
  COUNT(*) as count
FROM messenger_conversations
WHERE user_id = 'YOUR_USER_ID'

UNION ALL

SELECT 
  'Conversations with automation tag',
  COUNT(*)
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'
  AND mc.tag_ids @> ARRAY['YOUR_TAG_ID']::TEXT[]

UNION ALL

SELECT 
  'Conversations that will be processed',
  COUNT(*)
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'
  AND mc.last_message_time < NOW() - INTERVAL '30 minutes'  -- Adjust to your interval
  AND mc.tag_ids @> ARRAY['YOUR_TAG_ID']::TEXT[]
  AND NOT EXISTS (
    SELECT 1 FROM ai_automation_stops aas 
    WHERE aas.conversation_id = mc.id 
      AND aas.rule_id = 'YOUR_RULE_ID'
  );

-- ===== STEP 5: PREVENT ACCIDENTAL PROCESSING OF ALL =====

-- 5.1: Safety check - Ensure tag filter is set
DO $$
DECLARE
  rule_tags TEXT[];
BEGIN
  SELECT include_tag_ids INTO rule_tags
  FROM ai_automation_rules
  WHERE id = 'YOUR_RULE_ID';
  
  IF rule_tags IS NULL OR array_length(rule_tags, 1) IS NULL THEN
    RAISE WARNING '⚠️ WARNING: No tag filter set! Automation will process ALL conversations!';
    RAISE WARNING 'Run: UPDATE ai_automation_rules SET include_tag_ids = ARRAY[''YOUR_TAG_ID''] WHERE id = ''YOUR_RULE_ID'';';
  ELSE
    RAISE NOTICE '✅ Tag filter is set. Only conversations with tags % will be processed.', rule_tags;
  END IF;
END $$;

-- ===== STEP 6: TEST WITH ONE CONVERSATION =====

-- 6.1: Tag ONE test conversation
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES ('TEST_CONVERSATION_ID', 'YOUR_TAG_ID')
ON CONFLICT DO NOTHING;

-- 6.2: Verify it's the only one that will be processed
SELECT 
  mc.sender_name,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_ago,
  '✅ WILL BE PROCESSED' as status
FROM messenger_conversations mc
WHERE mc.id = 'TEST_CONVERSATION_ID'
  AND mc.tag_ids @> ARRAY['YOUR_TAG_ID']::TEXT[]
  AND mc.last_message_time < NOW() - INTERVAL '30 minutes';

-- 6.3: Trigger automation manually
-- Visit: https://your-domain.vercel.app/api/cron/ai-automations
-- Check logs to verify ONLY the tagged conversation was processed

-- 6.4: Check execution record
SELECT 
  mc.sender_name,
  ae.created_at,
  ae.status,
  ae.generated_message
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ae.rule_id = 'YOUR_RULE_ID'
  AND ae.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY ae.created_at DESC;

-- ===== STEP 7: SCALE UP AFTER TESTING =====

-- 7.1: After successful test, tag more conversations
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT 
  mc.id,
  'YOUR_TAG_ID'
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'
  AND mc.last_message_time < NOW() - INTERVAL '1 day'
  AND NOT (mc.tag_ids @> ARRAY['YOUR_TAG_ID']::TEXT[])
  LIMIT 50  -- Tag 50 at a time
ON CONFLICT DO NOTHING;

-- ===== COMMON ISSUES & SOLUTIONS =====

-- ISSUE: "Automation processing conversations I didn't tag"
-- SOLUTION: Check if include_tag_ids is set
SELECT 
  name,
  include_tag_ids,
  CASE 
    WHEN include_tag_ids IS NULL THEN '⚠️ FIX: No filter - processes ALL'
    WHEN array_length(include_tag_ids, 1) = 0 THEN '⚠️ FIX: Empty array - processes ALL'
    ELSE '✅ OK: Has tag filter'
  END as status
FROM ai_automation_rules;

-- FIX: Set tag filter
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['YOUR_TAG_ID']
WHERE include_tag_ids IS NULL;

-- ISSUE: "I tagged someone but they're not being processed"
-- SOLUTION: Check tag_ids format in messenger_conversations
SELECT 
  sender_name,
  tag_ids,
  tag_ids @> ARRAY['YOUR_TAG_ID']::TEXT[] as has_tag,
  typeof(tag_ids) as type
FROM messenger_conversations
WHERE id = 'CONVERSATION_ID';

-- ISSUE: "How do I remove tag and stop processing?"
-- SOLUTION: Remove the tag
DELETE FROM conversation_tags
WHERE conversation_id = 'CONVERSATION_ID'
  AND tag_id = 'YOUR_TAG_ID';

-- ===== MONITORING QUERIES =====

-- See which conversations have the automation tag
SELECT 
  mc.sender_name,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_ago,
  ctm.name as tags
FROM messenger_conversations mc
JOIN conversation_tags ct ON mc.id = ct.conversation_id
JOIN conversation_tags_master ctm ON ct.tag_id = ctm.id
WHERE mc.user_id = 'YOUR_USER_ID'
  AND ct.tag_id = 'YOUR_TAG_ID'
ORDER BY mc.last_message_time DESC;

-- Count conversations by tag status
SELECT 
  CASE 
    WHEN mc.tag_ids @> ARRAY['YOUR_TAG_ID']::TEXT[] THEN 'Has automation tag'
    ELSE 'No automation tag'
  END as status,
  COUNT(*) as count
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'
GROUP BY status;

-- See execution history for tagged conversations
SELECT 
  mc.sender_name,
  COUNT(*) as times_contacted,
  MAX(ae.created_at) as last_contacted,
  EXTRACT(EPOCH FROM (NOW() - MAX(ae.created_at)))/60 as minutes_since_last
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ae.rule_id = 'YOUR_RULE_ID'
  AND mc.tag_ids @> ARRAY['YOUR_TAG_ID']::TEXT[]
GROUP BY mc.id, mc.sender_name
ORDER BY last_contacted DESC;

-- ===== COMPLETE WORKFLOW SUMMARY =====

/*
WORKFLOW: Ensure ONLY manually tagged conversations are processed

1. Create automation tag: "AI Ready" or "Follow-up Needed"
2. Configure automation: include_tag_ids = ['tag-id']
3. Manually tag conversations (UI or SQL)
4. Automation processes ONLY tagged conversations
5. To stop: Remove tag or add to ai_automation_stops
6. To resume: Add tag back

CRITICAL RULES:
- include_tag_ids MUST NOT be NULL
- include_tag_ids MUST NOT be empty array
- Tags MUST be added manually (no auto-tagging)
- Only tagged conversations will be processed
*/

-- ===== SAFETY VALIDATION =====

-- Run this before enabling automation
-- It will warn you if configuration is not safe

DO $$
DECLARE
  rule_record RECORD;
  tagged_count INTEGER;
BEGIN
  FOR rule_record IN 
    SELECT id, name, include_tag_ids, enabled 
    FROM ai_automation_rules 
    WHERE user_id = 'YOUR_USER_ID'
  LOOP
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE 'Rule: %', rule_record.name;
    RAISE NOTICE 'Enabled: %', rule_record.enabled;
    
    IF rule_record.include_tag_ids IS NULL OR array_length(rule_record.include_tag_ids, 1) IS NULL THEN
      RAISE WARNING '⚠️ DANGER: This rule will process ALL conversations!';
      RAISE NOTICE 'FIX: UPDATE ai_automation_rules SET include_tag_ids = ARRAY[''tag-id''] WHERE id = ''%'';', rule_record.id;
    ELSE
      SELECT COUNT(*) INTO tagged_count
      FROM messenger_conversations mc
      WHERE mc.user_id = 'YOUR_USER_ID'
        AND mc.tag_ids && rule_record.include_tag_ids;
        
      RAISE NOTICE '✅ Tag filter active: %', rule_record.include_tag_ids;
      RAISE NOTICE '📊 Conversations with these tags: %', tagged_count;
    END IF;
  END LOOP;
END $$;

