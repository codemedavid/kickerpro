-- Check scheduled messages in database
-- Run this in your Supabase SQL Editor

-- 1. Check all messages with their scheduled_for values
SELECT 
    id,
    title,
    status,
    scheduled_for,
    created_at,
    updated_at,
    created_by
FROM messages
ORDER BY created_at DESC
LIMIT 10;

-- 2. Count messages by status
SELECT 
    status,
    COUNT(*) as count,
    COUNT(scheduled_for) as has_scheduled_for,
    COUNT(*) - COUNT(scheduled_for) as null_scheduled_for
FROM messages
GROUP BY status;

-- 3. Find messages with status='scheduled' but scheduled_for is NULL (THE BUG!)
SELECT 
    id,
    title,
    status,
    scheduled_for,
    created_at
FROM messages
WHERE status = 'scheduled' AND scheduled_for IS NULL;

-- 4. Find messages with status='scheduled' and scheduled_for is NOT NULL (working correctly)
SELECT 
    id,
    title,
    status,
    scheduled_for,
    created_at
FROM messages
WHERE status = 'scheduled' AND scheduled_for IS NOT NULL;

