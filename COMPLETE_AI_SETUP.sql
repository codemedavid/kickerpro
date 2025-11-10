-- 🤖 Complete AI Automation Setup
-- Run this ONE file to enable full AI automation with auto-sending
-- Supabase SQL Editor: https://app.supabase.com/project/dahqykjwyzuprrcliudc/sql

-- ============================================
-- 1. Add tracking columns to ai_automation_rules
-- ============================================

ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS time_interval_hours INTEGER,
ADD COLUMN IF NOT EXISTS time_interval_days INTEGER,
ADD COLUMN IF NOT EXISTS max_follow_ups INTEGER,
ADD COLUMN IF NOT EXISTS follow_up_sequence JSONB,
ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES facebook_pages(id);

-- ============================================
-- 2. Create ai_automation_executions table
-- ============================================

CREATE TABLE IF NOT EXISTS ai_automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES ai_automation_rules(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  recipient_psid TEXT NOT NULL,
  recipient_name TEXT,
  ai_prompt_used TEXT,
  generated_message TEXT,
  ai_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'generated', 'sent', 'failed')),
  facebook_message_id TEXT,
  error_message TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for executions
CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_rule_id 
  ON ai_automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_conversation_id 
  ON ai_automation_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_status 
  ON ai_automation_executions(status);

-- Enable RLS and create policy
ALTER TABLE ai_automation_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_executions" ON ai_automation_executions;
CREATE POLICY "allow_all_executions" 
  ON ai_automation_executions FOR ALL 
  TO public, anon, authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON ai_automation_executions TO authenticated;
GRANT ALL ON ai_automation_executions TO service_role;
GRANT ALL ON ai_automation_executions TO anon;
GRANT ALL ON ai_automation_executions TO public;

-- ============================================
-- 3. Add unique constraint for conversations
-- ============================================

ALTER TABLE messenger_conversations 
DROP CONSTRAINT IF EXISTS messenger_conversations_page_sender_unique;

ALTER TABLE messenger_conversations 
ADD CONSTRAINT messenger_conversations_page_sender_unique 
UNIQUE (page_id, sender_id);

-- ============================================
-- Done! ✅
-- ============================================

SELECT '✅ AI Automation setup complete! Auto-send is ready!' as result;









