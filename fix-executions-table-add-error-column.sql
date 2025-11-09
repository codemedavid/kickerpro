-- 🔧 Fix: Add missing error_message column to ai_automation_executions
-- Run this in Supabase SQL Editor

-- Add error_message column if missing
ALTER TABLE ai_automation_executions
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add other potentially missing columns
ALTER TABLE ai_automation_executions
ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS page_id UUID,
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS follow_up_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS previous_messages_shown TEXT[];

-- Verify columns exist
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_automation_executions'
  AND column_name IN ('error_message', 'executed_at', 'page_id', 'user_id', 'ai_reasoning', 'follow_up_number', 'previous_messages_shown')
ORDER BY column_name;

-- Success message
SELECT '✅ Columns added successfully!' as result;

