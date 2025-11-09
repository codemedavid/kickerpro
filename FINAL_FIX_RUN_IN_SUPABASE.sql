-- ============================================
-- AI AUTOMATION TABLES - COMPLETE SETUP
-- Copy this ENTIRE file and run in Supabase SQL Editor
-- ============================================

-- Step 1: Create ai_automation_rules table
CREATE TABLE IF NOT EXISTS ai_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Rule identification
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  
  -- Trigger conditions
  trigger_type TEXT NOT NULL DEFAULT 'time_based',
  time_interval_minutes INTEGER,
  time_interval_hours INTEGER,
  time_interval_days INTEGER,
  
  -- Follow-up limits and controls
  max_follow_ups INTEGER,
  follow_up_sequence JSONB,
  stop_on_reply BOOLEAN DEFAULT true,
  remove_tag_on_reply TEXT,
  
  -- Target selection
  page_id TEXT,
  include_tag_ids TEXT[],
  exclude_tag_ids TEXT[],
  
  -- AI prompt configuration
  custom_prompt TEXT NOT NULL,
  language_style TEXT DEFAULT 'taglish',
  
  -- Message settings
  message_tag TEXT DEFAULT 'ACCOUNT_UPDATE',
  auto_mark_sent BOOLEAN DEFAULT true,
  
  -- Execution tracking
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  -- Limits and controls
  max_messages_per_day INTEGER DEFAULT 100,
  active_hours_start INTEGER DEFAULT 9,
  active_hours_end INTEGER DEFAULT 21,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create ai_automation_executions table
CREATE TABLE IF NOT EXISTS ai_automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES ai_automation_rules(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  
  -- Execution details
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  
  -- Generated message
  ai_prompt_used TEXT,
  generated_message TEXT,
  ai_reasoning TEXT,
  
  -- Send result
  message_id UUID,
  facebook_message_id TEXT,
  error_message TEXT,
  
  -- Metadata
  recipient_psid TEXT NOT NULL,
  recipient_name TEXT,
  
  -- Follow-up tracking
  follow_up_number INTEGER DEFAULT 1,
  previous_messages_shown TEXT[],
  stopped_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create ai_automation_stops table
CREATE TABLE IF NOT EXISTS ai_automation_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES ai_automation_rules(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  sender_id TEXT,
  
  -- Stop details
  stopped_at TIMESTAMPTZ DEFAULT NOW(),
  stopped_reason TEXT NOT NULL,
  follow_ups_sent INTEGER DEFAULT 0,
  follow_up_count INTEGER DEFAULT 0,
  
  -- Optional: Tag that was removed
  tag_removed TEXT,
  reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(rule_id, conversation_id)
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_user_enabled 
  ON ai_automation_rules(user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_last_executed 
  ON ai_automation_rules(last_executed_at) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_time_interval 
  ON ai_automation_rules(time_interval_minutes, time_interval_hours, time_interval_days);

CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_rule 
  ON ai_automation_executions(rule_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_conversation 
  ON ai_automation_executions(conversation_id, triggered_at);

CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_follow_up 
  ON ai_automation_executions(conversation_id, rule_id, follow_up_number);

CREATE INDEX IF NOT EXISTS idx_ai_automation_stops_rule_conv
  ON ai_automation_stops(rule_id, conversation_id);

-- Step 5: Enable Row Level Security
ALTER TABLE ai_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automation_stops ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own automation rules" ON ai_automation_rules;
DROP POLICY IF EXISTS "Users can create own automation rules" ON ai_automation_rules;
DROP POLICY IF EXISTS "Users can update own automation rules" ON ai_automation_rules;
DROP POLICY IF EXISTS "Users can delete own automation rules" ON ai_automation_rules;
DROP POLICY IF EXISTS "Allow all select on automation rules" ON ai_automation_rules;
DROP POLICY IF EXISTS "Allow all insert on automation rules" ON ai_automation_rules;
DROP POLICY IF EXISTS "Allow all update on automation rules" ON ai_automation_rules;
DROP POLICY IF EXISTS "Allow all delete on automation rules" ON ai_automation_rules;

DROP POLICY IF EXISTS "Users can view own automation executions" ON ai_automation_executions;
DROP POLICY IF EXISTS "Service can insert automation executions" ON ai_automation_executions;
DROP POLICY IF EXISTS "Service can update automation executions" ON ai_automation_executions;
DROP POLICY IF EXISTS "Allow all select on automation executions" ON ai_automation_executions;
DROP POLICY IF EXISTS "Allow all insert on automation executions" ON ai_automation_executions;
DROP POLICY IF EXISTS "Allow all update on automation executions" ON ai_automation_executions;

DROP POLICY IF EXISTS "Users can view own automation stops" ON ai_automation_stops;
DROP POLICY IF EXISTS "Service can manage automation stops" ON ai_automation_stops;
DROP POLICY IF EXISTS "Service can insert automation stops" ON ai_automation_stops;
DROP POLICY IF EXISTS "Allow all select on automation stops" ON ai_automation_stops;
DROP POLICY IF EXISTS "Allow all insert on automation stops" ON ai_automation_stops;

-- Step 7: Create PUBLIC RLS Policies (for cookie-based auth)
-- This allows access without Supabase auth since you use custom Facebook auth

CREATE POLICY "Public access to automation rules"
  ON ai_automation_rules FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to automation executions"
  ON ai_automation_executions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to automation stops"
  ON ai_automation_stops FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 8: Add updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_automation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_automation_rules_updated_at ON ai_automation_rules;

CREATE TRIGGER ai_automation_rules_updated_at
  BEFORE UPDATE ON ai_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_automation_rules_updated_at();

-- Step 9: Add helpful comments
COMMENT ON TABLE ai_automation_rules IS 'AI-powered automation rules for automatic message sending';
COMMENT ON TABLE ai_automation_executions IS 'Tracking table for AI automation rule executions';
COMMENT ON TABLE ai_automation_stops IS 'Tracks conversations where automation has been stopped';

COMMENT ON COLUMN ai_automation_rules.time_interval_minutes IS 'Send message X minutes after last interaction (e.g., 30 minutes)';
COMMENT ON COLUMN ai_automation_rules.time_interval_hours IS 'Send message X hours after last interaction (e.g., 24 hours)';
COMMENT ON COLUMN ai_automation_rules.time_interval_days IS 'Send message X days after last interaction (e.g., 3 days)';
COMMENT ON COLUMN ai_automation_rules.custom_prompt IS 'Custom instructions for AI message generation';
COMMENT ON COLUMN ai_automation_rules.message_tag IS 'Facebook message tag - defaults to ACCOUNT_UPDATE for automations';
COMMENT ON COLUMN ai_automation_rules.max_follow_ups IS 'Maximum number of times to follow up with each contact (NULL = unlimited)';
COMMENT ON COLUMN ai_automation_rules.stop_on_reply IS 'Automatically stop following up when contact replies';

-- ============================================
-- VERIFICATION
-- ============================================

-- Check that all tables were created
SELECT 
  '✅ TABLES CREATED' as status,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE information_schema.columns.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE t.table_name IN ('ai_automation_rules', 'ai_automation_executions', 'ai_automation_stops')
  AND t.table_schema = 'public'
ORDER BY t.table_name;

-- Check RLS is enabled
SELECT 
  '✅ RLS STATUS' as status,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('ai_automation_rules', 'ai_automation_executions', 'ai_automation_stops')
  AND schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- SUCCESS!
-- If you see 3 tables above, you're ready to go!
-- Go back to your app and try creating an automation
-- ============================================





