-- Auto-Cleanup for AI Automation Monitoring States
-- This prevents old/stale monitoring records from cluttering the dashboard

-- Step 1: Clean up existing stale records NOW
DELETE FROM ai_automation_contact_states
WHERE current_stage IN ('completed', 'failed', 'sent')
  AND updated_at < NOW() - INTERVAL '24 hours';

DELETE FROM ai_automation_contact_states
WHERE current_stage IN ('queued', 'generating', 'sending', 'processing', 'ready_to_send', 'checking', 'eligible')
  AND updated_at < NOW() - INTERVAL '1 hour';

-- Show results
SELECT 
  'Cleanup completed' as status,
  COUNT(*) as remaining_records,
  COUNT(CASE WHEN current_stage IN ('sent', 'completed') THEN 1 END) as sent_completed,
  COUNT(CASE WHEN current_stage IN ('failed') THEN 1 END) as failed,
  COUNT(CASE WHEN current_stage IN ('processing', 'generating', 'sending') THEN 1 END) as active
FROM ai_automation_contact_states;

-- Step 2: Create function for automated cleanup
CREATE OR REPLACE FUNCTION cleanup_monitoring_states()
RETURNS TABLE(
  deleted_old_completed integer,
  deleted_stuck integer,
  remaining_records integer
) AS $$
DECLARE
  deleted_completed integer;
  deleted_stuck integer;
  remaining integer;
BEGIN
  -- Delete completed/failed/sent states older than 24 hours
  DELETE FROM ai_automation_contact_states
  WHERE current_stage IN ('completed', 'failed', 'sent')
    AND updated_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_completed = ROW_COUNT;
  
  -- Delete stuck processing states older than 1 hour (likely errors)
  DELETE FROM ai_automation_contact_states
  WHERE current_stage IN ('queued', 'generating', 'sending', 'processing', 'ready_to_send', 'checking', 'eligible')
    AND updated_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS deleted_stuck = ROW_COUNT;
  
  -- Count remaining records
  SELECT COUNT(*) INTO remaining
  FROM ai_automation_contact_states;
  
  RETURN QUERY SELECT deleted_completed, deleted_stuck, remaining;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Test the function
SELECT * FROM cleanup_monitoring_states();

-- Step 4: Verify cleanup
SELECT 
  current_stage,
  COUNT(*) as count,
  MAX(updated_at) as most_recent
FROM ai_automation_contact_states
GROUP BY current_stage
ORDER BY count DESC;

