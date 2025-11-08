-- ============================================
-- FIX MONITORING DATA ALIGNMENT
-- Shows BOTH contacts with tags AND contacts being processed
-- ============================================

-- Step 1: Create ai_automation_stops table if it doesn't exist
CREATE TABLE IF NOT EXISTS ai_automation_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES ai_automation_rules(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  stopped_reason TEXT,
  follow_ups_sent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rule_id, conversation_id)
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_automation_stops_rule_conv 
  ON ai_automation_stops(rule_id, conversation_id);

-- Add RLS policy
ALTER TABLE ai_automation_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their automation stops" ON ai_automation_stops;
CREATE POLICY "Users can view their automation stops" ON ai_automation_stops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_automation_rules 
      WHERE ai_automation_rules.id = ai_automation_stops.rule_id 
      AND ai_automation_rules.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their automation stops" ON ai_automation_stops;
CREATE POLICY "Users can manage their automation stops" ON ai_automation_stops
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ai_automation_rules 
      WHERE ai_automation_rules.id = ai_automation_stops.rule_id 
      AND ai_automation_rules.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_automation_rules 
      WHERE ai_automation_rules.id = ai_automation_stops.rule_id 
      AND ai_automation_rules.user_id = auth.uid()
    )
  );

-- Step 2: Create view for ELIGIBLE contacts (have tags matching automation rules)
CREATE OR REPLACE VIEW automation_eligible_contacts AS
SELECT DISTINCT
  ar.id as rule_id,
  ar.name as rule_name,
  ar.enabled as rule_enabled,
  mc.id as conversation_id,
  mc.sender_id,
  mc.sender_name,
  mc.last_message,
  mc.last_message_time,
  mc.conversation_status,
  
  -- Check if currently being processed
  CASE 
    WHEN acs.id IS NOT NULL THEN true 
    ELSE false 
  END as is_being_processed,
  
  -- Current processing stage (if any)
  acs.current_stage,
  acs.status_message,
  acs.created_at as processing_started_at,
  acs.updated_at as last_updated_at,
  
  -- Tag information
  ARRAY_AGG(DISTINCT t.name) as matching_tags,
  ARRAY_AGG(DISTINCT t.id) as matching_tag_ids,
  
  -- Execution history
  (
    SELECT COUNT(*) 
    FROM ai_automation_executions exe 
    WHERE exe.rule_id = ar.id 
    AND exe.conversation_id = mc.id
    AND exe.created_at > NOW() - INTERVAL '7 days'
  ) as executions_last_7_days,
  
  (
    SELECT MAX(created_at) 
    FROM ai_automation_executions exe 
    WHERE exe.rule_id = ar.id 
    AND exe.conversation_id = mc.id
  ) as last_execution_at,
  
  -- Check if stopped
  CASE 
    WHEN ast.id IS NOT NULL THEN true 
    ELSE false 
  END as is_stopped,
  ast.stopped_reason,
  
  -- Calculate eligibility
  CASE 
    WHEN ast.id IS NOT NULL THEN 'stopped'
    WHEN acs.current_stage IN ('sending', 'generating', 'queued') THEN 'processing'
    WHEN acs.current_stage = 'sent' AND acs.updated_at > NOW() - INTERVAL '1 hour' THEN 'recently_sent'
    ELSE 'eligible'
  END as contact_status

FROM ai_automation_rules ar
-- Join conversations that match rule criteria
CROSS JOIN messenger_conversations mc
-- Join conversation tags
INNER JOIN conversation_tags ct ON ct.conversation_id = mc.id
INNER JOIN tags t ON t.id = ct.tag_id
-- Left join to check if currently being processed
LEFT JOIN ai_automation_contact_states acs ON 
  acs.rule_id = ar.id 
  AND acs.conversation_id = mc.id
  AND acs.current_stage NOT IN ('completed', 'failed')
  AND acs.updated_at > NOW() - INTERVAL '24 hours'
-- Left join to check if stopped
LEFT JOIN ai_automation_stops ast ON 
  ast.rule_id = ar.id 
  AND ast.conversation_id = mc.id

WHERE 
  -- Rule must be enabled
  ar.enabled = true
  -- Tag must match rule's include_tag_ids
  AND (
    ar.include_tag_ids IS NULL 
    OR ar.include_tag_ids = '{}'::UUID[]
    OR t.id = ANY(ar.include_tag_ids)
  )
  -- Tag must NOT match rule's exclude_tag_ids
  AND (
    ar.exclude_tag_ids IS NULL 
    OR ar.exclude_tag_ids = '{}'::UUID[]
    OR NOT (t.id = ANY(ar.exclude_tag_ids))
  )
  -- Conversation must be active
  AND mc.conversation_status = 'active'

GROUP BY 
  ar.id, ar.name, ar.enabled,
  mc.id, mc.sender_id, mc.sender_name, 
  mc.last_message, mc.last_message_time, mc.conversation_status,
  acs.id, acs.current_stage, acs.status_message, 
  acs.created_at, acs.updated_at,
  ast.id, ast.stopped_reason

ORDER BY 
  ar.name, 
  mc.last_message_time DESC;


-- Step 3: Create summary view combining eligible AND active
CREATE OR REPLACE VIEW automation_monitor_summary AS
SELECT 
  ar.id as rule_id,
  ar.name as rule_name,
  ar.enabled,
  
  -- Counts of ELIGIBLE contacts (have matching tags)
  (
    SELECT COUNT(DISTINCT aec.conversation_id)
    FROM automation_eligible_contacts aec
    WHERE aec.rule_id = ar.id
    AND aec.contact_status = 'eligible'
  ) as eligible_count,
  
  -- Counts of ACTIVE contacts (currently being processed)
  (
    SELECT COUNT(DISTINCT acs.conversation_id)
    FROM ai_automation_contact_states acs
    WHERE acs.rule_id = ar.id
    AND acs.current_stage NOT IN ('completed', 'failed')
    AND acs.updated_at > NOW() - INTERVAL '24 hours'
  ) as active_count,
  
  -- Stage breakdown for active contacts
  (
    SELECT COUNT(*) 
    FROM ai_automation_contact_states acs
    WHERE acs.rule_id = ar.id
    AND acs.current_stage = 'queued'
    AND acs.updated_at > NOW() - INTERVAL '24 hours'
  ) as queued_count,
  
  (
    SELECT COUNT(*) 
    FROM ai_automation_contact_states acs
    WHERE acs.rule_id = ar.id
    AND acs.current_stage = 'generating'
    AND acs.updated_at > NOW() - INTERVAL '24 hours'
  ) as generating_count,
  
  (
    SELECT COUNT(*) 
    FROM ai_automation_contact_states acs
    WHERE acs.rule_id = ar.id
    AND acs.current_stage = 'sending'
    AND acs.updated_at > NOW() - INTERVAL '24 hours'
  ) as sending_count,
  
  (
    SELECT COUNT(*) 
    FROM ai_automation_contact_states acs
    WHERE acs.rule_id = ar.id
    AND acs.current_stage = 'sent'
    AND acs.updated_at > NOW() - INTERVAL '24 hours'
  ) as sent_today_count,
  
  (
    SELECT COUNT(*) 
    FROM ai_automation_contact_states acs
    WHERE acs.rule_id = ar.id
    AND acs.current_stage = 'failed'
    AND acs.updated_at > NOW() - INTERVAL '24 hours'
  ) as failed_count,
  
  -- Recently sent (last hour)
  (
    SELECT COUNT(DISTINCT aec.conversation_id)
    FROM automation_eligible_contacts aec
    WHERE aec.rule_id = ar.id
    AND aec.contact_status = 'recently_sent'
  ) as recently_sent_count,
  
  -- Stopped contacts
  (
    SELECT COUNT(DISTINCT aec.conversation_id)
    FROM automation_eligible_contacts aec
    WHERE aec.rule_id = ar.id
    AND aec.is_stopped = true
  ) as stopped_count,
  
  -- Total with matching tags
  (
    SELECT COUNT(DISTINCT aec.conversation_id)
    FROM automation_eligible_contacts aec
    WHERE aec.rule_id = ar.id
  ) as total_with_tags,
  
  -- Next scheduled send
  (
    SELECT MIN(acs.next_send_at) 
    FROM ai_automation_contact_states acs
    WHERE acs.rule_id = ar.id
    AND acs.next_send_at > NOW()
  ) as next_scheduled_send,
  
  -- Last activity
  (
    SELECT MAX(acs.updated_at) 
    FROM ai_automation_contact_states acs
    WHERE acs.rule_id = ar.id
  ) as last_activity,
  
  -- Rule configuration
  ar.include_tag_ids,
  ar.exclude_tag_ids,
  ar.max_follow_ups,
  ar.time_interval_minutes,
  ar.time_interval_hours,
  ar.time_interval_days,
  ar.active_hours_start,
  ar.active_hours_end

FROM ai_automation_rules ar
WHERE ar.enabled = true
ORDER BY ar.name;


-- Step 4: Add helpful comments
COMMENT ON TABLE ai_automation_stops IS 'Tracks when automations are manually stopped for specific contacts';
COMMENT ON VIEW automation_eligible_contacts IS 'Shows all contacts that match automation rule tags - whether being processed or not';
COMMENT ON VIEW automation_monitor_summary IS 'Summary of automation status showing BOTH eligible contacts (with tags) and active processing';


-- Step 5: Grant access to views and tables
GRANT SELECT ON automation_eligible_contacts TO authenticated;
GRANT SELECT ON automation_monitor_summary TO authenticated;
GRANT SELECT ON ai_automation_stops TO authenticated;


-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check contacts with tags for a specific rule
-- SELECT * FROM automation_eligible_contacts WHERE rule_id = 'YOUR-RULE-ID-HERE' LIMIT 10;

-- Check summary for all rules
-- SELECT * FROM automation_monitor_summary;

-- Compare eligible vs active
-- SELECT 
--   rule_name,
--   total_with_tags as "Contacts with Tags",
--   eligible_count as "Eligible to Process",
--   active_count as "Currently Processing",
--   recently_sent_count as "Sent in Last Hour",
--   stopped_count as "Stopped"
-- FROM automation_monitor_summary;

-- ============================================
-- SUCCESS! 🎉
-- ============================================
-- Now you can see BOTH:
-- 1. Contacts that HAVE the tags (automation_eligible_contacts)
-- 2. Contacts BEING processed (ai_automation_contact_states)
-- 
-- The Live Monitor can now show accurate data!

