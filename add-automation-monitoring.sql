-- Add real-time automation monitoring tables and views

-- Create automation contact state tracking table
CREATE TABLE IF NOT EXISTS ai_automation_contact_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES ai_automation_rules(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  
  -- Current state
  current_stage TEXT NOT NULL CHECK (current_stage IN (
    'queued',           -- In queue, waiting to process
    'checking',         -- Checking if eligible
    'eligible',         -- Passed checks, waiting for time window
    'generating',       -- AI is generating message
    'ready_to_send',    -- Message generated, ready to send
    'sending',          -- Currently sending via Facebook
    'sent',             -- Successfully sent
    'failed',           -- Failed to send
    'skipped',          -- Skipped (outside hours, limit reached, etc)
    'completed'         -- Fully completed
  )),
  
  -- Timing info
  next_send_at TIMESTAMPTZ,           -- When message will be sent
  minutes_until_send INTEGER,         -- Calculated: minutes until send
  last_stage_change_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Message info
  generated_message TEXT,
  generation_time_ms INTEGER,         -- How long AI took
  
  -- Status details
  status_message TEXT,                -- Human-readable status
  error_message TEXT,                 -- If failed, why
  
  -- Follow-up tracking
  follow_up_count INTEGER DEFAULT 0,
  max_follow_ups INTEGER NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_states_rule 
  ON ai_automation_contact_states(rule_id, current_stage);

CREATE INDEX IF NOT EXISTS idx_automation_states_conversation 
  ON ai_automation_contact_states(conversation_id);

CREATE INDEX IF NOT EXISTS idx_automation_states_stage 
  ON ai_automation_contact_states(current_stage, next_send_at);

CREATE INDEX IF NOT EXISTS idx_automation_states_updated 
  ON ai_automation_contact_states(updated_at DESC);

-- Create view for active automation monitoring
CREATE OR REPLACE VIEW active_automation_contacts AS
SELECT 
  acs.id,
  acs.rule_id,
  acs.conversation_id,
  acs.sender_id,
  acs.sender_name,
  acs.current_stage,
  acs.next_send_at,
  acs.status_message,
  acs.error_message,
  acs.follow_up_count,
  acs.max_follow_ups,
  acs.generated_message,
  acs.generation_time_ms,
  acs.created_at,
  acs.updated_at,
  
  -- Calculate minutes until send (null if in past or not scheduled)
  CASE 
    WHEN acs.next_send_at > NOW() THEN 
      EXTRACT(EPOCH FROM (acs.next_send_at - NOW()))::INTEGER / 60
    ELSE NULL
  END as minutes_until_send,
  
  -- Time in current stage
  EXTRACT(EPOCH FROM (NOW() - acs.last_stage_change_at))::INTEGER as seconds_in_stage,
  
  -- Rule info
  ar.name as rule_name,
  ar.enabled as rule_enabled,
  ar.run_24_7,
  ar.active_hours_start,
  ar.active_hours_end,
  
  -- Conversation info
  mc.last_message,
  mc.last_message_time,
  mc.conversation_status
  
FROM ai_automation_contact_states acs
JOIN ai_automation_rules ar ON acs.rule_id = ar.id
JOIN messenger_conversations mc ON acs.conversation_id = mc.id
WHERE acs.current_stage NOT IN ('completed', 'failed')
  AND acs.updated_at > NOW() - INTERVAL '24 hours'  -- Only recent activity
ORDER BY acs.updated_at DESC;

-- Create function to update minutes_until_send automatically
CREATE OR REPLACE FUNCTION update_automation_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Calculate minutes until send if next_send_at is set
  IF NEW.next_send_at IS NOT NULL AND NEW.next_send_at > NOW() THEN
    NEW.minutes_until_send := EXTRACT(EPOCH FROM (NEW.next_send_at - NOW()))::INTEGER / 60;
  ELSE
    NEW.minutes_until_send := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update timestamps
CREATE TRIGGER update_automation_state_timestamp
  BEFORE UPDATE ON ai_automation_contact_states
  FOR EACH ROW
  EXECUTE FUNCTION update_automation_state_timestamp();

-- Create function to get stage summary for a rule
CREATE OR REPLACE FUNCTION get_automation_stage_summary(p_rule_id UUID)
RETURNS TABLE (
  stage TEXT,
  count BIGINT,
  avg_time_in_stage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    acs.current_stage,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (NOW() - acs.last_stage_change_at)))::INTEGER as avg_time_in_stage
  FROM ai_automation_contact_states acs
  WHERE acs.rule_id = p_rule_id
    AND acs.current_stage NOT IN ('completed', 'failed')
    AND acs.updated_at > NOW() - INTERVAL '1 hour'
  GROUP BY acs.current_stage
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE ai_automation_contact_states ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own automation states
DROP POLICY IF EXISTS "Users can view their automation states" ON ai_automation_contact_states;
CREATE POLICY "Users can view their automation states" ON ai_automation_contact_states
  FOR SELECT
  USING (
    rule_id IN (
      SELECT id FROM ai_automation_rules WHERE user_id = (
        SELECT id FROM users WHERE facebook_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      )
    )
  );

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access to automation states" ON ai_automation_contact_states;
CREATE POLICY "Service role full access to automation states" ON ai_automation_contact_states
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create summary stats view
CREATE OR REPLACE VIEW automation_live_stats AS
SELECT 
  ar.id as rule_id,
  ar.name as rule_name,
  ar.enabled,
  COUNT(DISTINCT acs.id) FILTER (WHERE acs.current_stage NOT IN ('completed', 'failed')) as active_contacts,
  COUNT(DISTINCT acs.id) FILTER (WHERE acs.current_stage = 'queued') as queued_count,
  COUNT(DISTINCT acs.id) FILTER (WHERE acs.current_stage = 'generating') as generating_count,
  COUNT(DISTINCT acs.id) FILTER (WHERE acs.current_stage = 'sending') as sending_count,
  COUNT(DISTINCT acs.id) FILTER (WHERE acs.current_stage = 'sent') as sent_today_count,
  COUNT(DISTINCT acs.id) FILTER (WHERE acs.current_stage = 'failed') as failed_count,
  MIN(acs.next_send_at) FILTER (WHERE acs.next_send_at > NOW()) as next_scheduled_send,
  MAX(acs.updated_at) as last_activity
FROM ai_automation_rules ar
LEFT JOIN ai_automation_contact_states acs ON ar.id = acs.rule_id
  AND acs.updated_at > NOW() - INTERVAL '24 hours'
GROUP BY ar.id, ar.name, ar.enabled;

COMMENT ON TABLE ai_automation_contact_states IS 'Tracks real-time state of contacts in automation pipeline';
COMMENT ON VIEW active_automation_contacts IS 'Live view of contacts currently being processed by automations';
COMMENT ON VIEW automation_live_stats IS 'Summary statistics for live automation monitoring';






