-- Add tracking columns to ai_automation_rules table
-- These columns track execution and success metrics

-- Add execution tracking columns
ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;

-- Add more tracking fields
ALTER TABLE ai_automation_rules
ADD COLUMN IF NOT EXISTS time_interval_hours INTEGER,
ADD COLUMN IF NOT EXISTS time_interval_days INTEGER,
ADD COLUMN IF NOT EXISTS max_follow_ups INTEGER,
ADD COLUMN IF NOT EXISTS follow_up_sequence JSONB,
ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES facebook_pages(id) ON DELETE CASCADE;

-- Create index for page_id lookups
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_page_id ON ai_automation_rules(page_id);

-- Success message
SELECT '✅ AI Automation tracking columns added!' as result;




