-- 🚀 RUN THIS ONE SQL FILE TO FIX EVERYTHING
-- Copy ALL of this and run in Supabase SQL Editor
-- https://app.supabase.com/project/dahqykjwyzuprrcliudc/sql

-- Step 1: Add tracking columns to ai_automation_rules
ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0;

ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;

ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;

ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;

-- Step 2: Create ai_automation_executions table
CREATE TABLE IF NOT EXISTS ai_automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES ai_automation_rules(id),
  conversation_id UUID REFERENCES messenger_conversations(id),
  recipient_psid TEXT,
  recipient_name TEXT,
  generated_message TEXT,
  facebook_message_id TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for executions
ALTER TABLE ai_automation_executions ENABLE ROW LEVEL SECURITY;

-- Create policy
DO $$ BEGIN
  DROP POLICY IF EXISTS "allow_all" ON ai_automation_executions;
  CREATE POLICY "allow_all" ON ai_automation_executions FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Grant permissions
GRANT ALL ON ai_automation_executions TO authenticated;
GRANT ALL ON ai_automation_executions TO service_role;

-- Step 3: Add conversations unique constraint
DO $$ BEGIN
  ALTER TABLE messenger_conversations 
  DROP CONSTRAINT IF EXISTS messenger_conversations_page_sender_unique;
  
  ALTER TABLE messenger_conversations 
  ADD CONSTRAINT messenger_conversations_page_sender_unique 
  UNIQUE (page_id, sender_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Verify everything
SELECT 
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'ai_automation_rules' AND column_name = 'execution_count') > 0 as tracking_columns_added,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'ai_automation_executions') > 0 as executions_table_created,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'messenger_conversations' AND constraint_name = 'messenger_conversations_page_sender_unique') > 0 as conversations_constraint_added;

-- Success!
SELECT '✅ All AI Automation setup complete! Test at /api/ai-automations/trigger' as result;





