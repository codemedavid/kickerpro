-- Debug Pipeline Stages Issue
-- Run this to check what's in your database

-- 1. Check if any stages exist at all
SELECT 'Total stages in database:' as check_type, COUNT(*) as count FROM pipeline_stages;

-- 2. Check stages by user
SELECT 
    'Stages by user:' as check_type,
    user_id, 
    COUNT(*) as stage_count 
FROM pipeline_stages 
GROUP BY user_id;

-- 3. See all stages
SELECT * FROM pipeline_stages ORDER BY created_at DESC;

-- 4. Check users table
SELECT 'Users in database:' as check_type, id, email FROM users;

-- 5. Check if RLS is causing issues (this will show the actual data)
SELECT 
    id,
    user_id,
    name,
    description,
    color,
    is_active,
    is_default,
    created_at
FROM pipeline_stages
ORDER BY created_at DESC;






