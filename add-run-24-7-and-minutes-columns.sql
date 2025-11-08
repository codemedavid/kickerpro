-- Add missing columns for 24/7 mode and minute precision to AI Automation Rules
-- Run this in your Supabase SQL Editor

-- Add run_24_7 column to enable 24/7 operation
ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS run_24_7 BOOLEAN DEFAULT false;

-- Add minute precision to active hours
ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS active_hours_start_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_hours_end_minutes INTEGER DEFAULT 0;

-- Add constraints to ensure valid minute values (0-59)
-- Drop constraints if they exist, then recreate them
DO $$ 
BEGIN
  -- Drop existing constraints if they exist
  ALTER TABLE ai_automation_rules DROP CONSTRAINT IF EXISTS check_start_minutes;
  ALTER TABLE ai_automation_rules DROP CONSTRAINT IF EXISTS check_end_minutes;
  
  -- Add the constraints
  ALTER TABLE ai_automation_rules ADD CONSTRAINT check_start_minutes 
    CHECK (active_hours_start_minutes >= 0 AND active_hours_start_minutes <= 59);
  ALTER TABLE ai_automation_rules ADD CONSTRAINT check_end_minutes 
    CHECK (active_hours_end_minutes >= 0 AND active_hours_end_minutes <= 59);
END $$;

-- Update existing rules to have default values
UPDATE ai_automation_rules
SET 
  run_24_7 = false,
  active_hours_start_minutes = 0,
  active_hours_end_minutes = 0
WHERE run_24_7 IS NULL 
   OR active_hours_start_minutes IS NULL 
   OR active_hours_end_minutes IS NULL;

-- Verify the changes
SELECT 
  id,
  name,
  run_24_7,
  active_hours_start,
  active_hours_start_minutes,
  active_hours_end,
  active_hours_end_minutes,
  enabled
FROM ai_automation_rules
ORDER BY created_at DESC;

-- Success message
SELECT '✅ Successfully added run_24_7 and minute precision columns!' as result;

-- EXPLANATION:
-- - run_24_7: When true, automation runs all day without hour restrictions
-- - active_hours_start_minutes: Minute component for start time (0-59)
-- - active_hours_end_minutes: Minute component for end time (0-59)
-- 
-- Example: Start at 9:30 AM, End at 5:45 PM
--   active_hours_start = 9
--   active_hours_start_minutes = 30
--   active_hours_end = 17
--   active_hours_end_minutes = 45

