-- Add minutes support for more granular time intervals
-- Allows automations like "follow up every 30 minutes" or "every 2 hours"

ALTER TABLE ai_automation_rules
ADD COLUMN IF NOT EXISTS time_interval_minutes INTEGER;

-- Add index for minute-based queries
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_time_interval 
  ON ai_automation_rules(time_interval_minutes, time_interval_hours, time_interval_days);

-- Add field to track previous messages to ensure uniqueness
ALTER TABLE ai_automation_executions
ADD COLUMN IF NOT EXISTS previous_messages_shown TEXT[]; -- Store previous AI messages for comparison

-- Comment
COMMENT ON COLUMN ai_automation_rules.time_interval_minutes IS 'Send message X minutes after last interaction (e.g., 30 minutes, 60 minutes)';
COMMENT ON COLUMN ai_automation_executions.previous_messages_shown IS 'Previous AI-generated messages for this conversation to ensure variety';






