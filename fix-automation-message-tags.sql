-- Fix AI Automation Message Tags
-- Run this in Supabase SQL Editor to ensure all automation rules have valid message tags

-- Update any rules with NULL message_tag to use ACCOUNT_UPDATE as default
UPDATE ai_automation_rules
SET message_tag = 'ACCOUNT_UPDATE'
WHERE message_tag IS NULL;

-- Verify the update
SELECT 
  id,
  name,
  message_tag,
  enabled,
  created_at
FROM ai_automation_rules
ORDER BY created_at DESC;

-- Add a comment for documentation
COMMENT ON COLUMN ai_automation_rules.message_tag IS 
'Facebook message tag for automated messages. Common values: ACCOUNT_UPDATE, POST_PURCHASE_UPDATE, CONFIRMED_EVENT_UPDATE, HUMAN_AGENT. Must not be NULL.';

