-- Enhance AI Automation Features
-- Adds response rate tracking, more specific timing, and 24/7 option

-- Add enhanced timing columns (minutes precision)
ALTER TABLE ai_automation_rules
ADD COLUMN IF NOT EXISTS active_hours_start_minutes INTEGER DEFAULT 0 CHECK (active_hours_start_minutes >= 0 AND active_hours_start_minutes <= 59),
ADD COLUMN IF NOT EXISTS active_hours_end_minutes INTEGER DEFAULT 0 CHECK (active_hours_end_minutes >= 0 AND active_hours_end_minutes <= 59),
ADD COLUMN IF NOT EXISTS run_24_7 BOOLEAN DEFAULT false;

-- Add response rate tracking
ALTER TABLE messenger_conversations
ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_message_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_responsive BOOLEAN DEFAULT false;

-- Add active status tracking
ALTER TABLE messenger_conversations
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Create view for days since last activity (computed on query)
CREATE OR REPLACE VIEW conversation_activity_stats AS
SELECT 
  id,
  user_id,
  page_id,
  sender_id,
  sender_name,
  last_message_time,
  reply_count,
  message_count,
  EXTRACT(DAY FROM (NOW() - last_message_time))::INTEGER as days_since_last_activity,
  CASE 
    WHEN reply_count > 0 AND message_count > 0 
    THEN (reply_count::DECIMAL / message_count::DECIMAL * 100)
    ELSE 0 
  END as response_rate_percentage,
  is_responsive
FROM messenger_conversations;

-- Add index for activity queries
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_last_activity 
  ON messenger_conversations(last_activity_at);
  
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_is_responsive 
  ON messenger_conversations(is_responsive);

-- Success message
SELECT '✅ AI Automation features enhanced!' as result;

