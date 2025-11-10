-- Check what stages currently exist
SELECT 
    id,
    user_id,
    name,
    LENGTH(analysis_prompt) as prompt_len,
    is_default,
    position
FROM pipeline_stages
ORDER BY created_at DESC;

-- Check for duplicates
SELECT name, COUNT(*) as count
FROM pipeline_stages
GROUP BY name
HAVING COUNT(*) > 1;

-- Check your user_id
SELECT id as your_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;

