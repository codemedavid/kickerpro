-- Fix Duplicate Monitoring States
-- This script cleans up duplicate ai_automation_contact_states records
-- and adds a unique constraint to prevent future duplicates

-- Step 1: Show current duplicate count
SELECT 
  rule_id,
  conversation_id,
  COUNT(*) as duplicate_count
FROM ai_automation_contact_states
GROUP BY rule_id, conversation_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: Delete duplicate records, keeping only the most recent one
WITH RankedStates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY rule_id, conversation_id 
      ORDER BY created_at DESC
    ) as rn
  FROM ai_automation_contact_states
)
DELETE FROM ai_automation_contact_states
WHERE id IN (
  SELECT id 
  FROM RankedStates 
  WHERE rn > 1
);

-- Step 3: Add unique constraint to prevent future duplicates
-- Drop existing constraint if it exists
ALTER TABLE ai_automation_contact_states 
DROP CONSTRAINT IF EXISTS unique_rule_conversation;

-- Add new unique constraint
ALTER TABLE ai_automation_contact_states
ADD CONSTRAINT unique_rule_conversation 
UNIQUE (rule_id, conversation_id);

-- Step 4: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_automation_states_rule_conv
  ON ai_automation_contact_states(rule_id, conversation_id);

-- Step 5: Verify cleanup
SELECT 
  COUNT(*) as total_states,
  COUNT(DISTINCT (rule_id, conversation_id)) as unique_combinations
FROM ai_automation_contact_states;

-- If these two counts match, cleanup was successful!

