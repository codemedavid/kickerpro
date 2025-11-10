-- Create AI Automation Rules table
-- This allows automatic AI message sending based on time intervals and custom prompts

CREATE TABLE IF NOT EXISTS ai_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Rule identification
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  
  -- Trigger conditions
  trigger_type TEXT NOT NULL DEFAULT 'time_based', -- 'time_based', 'conversation_inactive', 'tag_assigned'
  time_interval_hours INTEGER, -- Hours after last message (e.g., 1, 24, 72)
  time_interval_days INTEGER, -- Days after last message (alternative to hours)
  
  -- Target selection
  page_id TEXT, -- Specific page or null for all pages
  include_tag_ids TEXT[], -- Only conversations with these tags
  exclude_tag_ids TEXT[], -- Exclude conversations with these tags
  
  -- AI prompt configuration
  custom_prompt TEXT NOT NULL, -- Instructions for AI on how to compose messages
  language_style TEXT DEFAULT 'taglish', -- Language preference
  
  -- Message settings
  message_tag TEXT DEFAULT 'ACCOUNT_UPDATE', -- Facebook message tag for automated messages
  auto_mark_sent BOOLEAN DEFAULT true, -- Mark conversation as "contacted" after sending
  
  -- Execution tracking
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  -- Limits and controls
  max_messages_per_day INTEGER DEFAULT 100, -- Safety limit
  active_hours_start INTEGER DEFAULT 9, -- Only send between 9 AM - 9 PM
  active_hours_end INTEGER DEFAULT 21,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_user_enabled 
  ON ai_automation_rules(user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_last_executed 
  ON ai_automation_rules(last_executed_at) WHERE enabled = true;

-- Create tracking table for executed automations
CREATE TABLE IF NOT EXISTS ai_automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES ai_automation_rules(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  
  -- Execution details
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- 'pending', 'generating', 'sent', 'failed'
  
  -- Generated message
  ai_prompt_used TEXT,
  generated_message TEXT,
  ai_reasoning TEXT,
  
  -- Send result
  message_id UUID, -- Reference to messages table if sent
  facebook_message_id TEXT,
  error_message TEXT,
  
  -- Metadata
  recipient_psid TEXT NOT NULL,
  recipient_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for tracking
CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_rule 
  ON ai_automation_executions(rule_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_conversation 
  ON ai_automation_executions(conversation_id, triggered_at);

-- Enable Row Level Security
ALTER TABLE ai_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automation_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_automation_rules
CREATE POLICY "Users can view own automation rules"
  ON ai_automation_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own automation rules"
  ON ai_automation_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules"
  ON ai_automation_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules"
  ON ai_automation_rules FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for ai_automation_executions
CREATE POLICY "Users can view own automation executions"
  ON ai_automation_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_automation_rules
      WHERE ai_automation_rules.id = ai_automation_executions.rule_id
      AND ai_automation_rules.user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert automation executions"
  ON ai_automation_executions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update automation executions"
  ON ai_automation_executions FOR UPDATE
  USING (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_automation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_automation_rules_updated_at
  BEFORE UPDATE ON ai_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_automation_rules_updated_at();

-- Comments
COMMENT ON TABLE ai_automation_rules IS 'AI-powered automation rules for automatic message sending';
COMMENT ON TABLE ai_automation_executions IS 'Tracking table for AI automation rule executions';
COMMENT ON COLUMN ai_automation_rules.time_interval_hours IS 'Send message X hours after last interaction';
COMMENT ON COLUMN ai_automation_rules.custom_prompt IS 'Custom instructions for AI message generation';
COMMENT ON COLUMN ai_automation_rules.message_tag IS 'Facebook message tag - defaults to ACCOUNT_UPDATE for automations';






