-- Create AI Automation Executions Table
-- Tracks each time an automation runs and generates a message

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_rule_id 
  ON ai_automation_executions(rule_id);
  
CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_conversation_id 
  ON ai_automation_executions(conversation_id);
  
CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_status 
  ON ai_automation_executions(status);

-- Enable RLS
ALTER TABLE ai_automation_executions ENABLE ROW LEVEL SECURITY;

-- Create permissive policy
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

-- Success message
SELECT '✅ AI Automation Executions table created!' as result;






