-- ================================================================
-- 🎯 QUICK SETUP: DEFAULT PIPELINE STAGE
-- Run this NOW in your Supabase SQL Editor
-- Takes < 5 seconds to complete
-- ================================================================

-- ✅ STEP 1: Create default stages for all existing users
INSERT INTO pipeline_stages (
    user_id,
    name,
    description,
    color,
    analysis_prompt,
    is_default,
    is_active,
    position
)
SELECT 
    users.id,
    'Unmatched',
    'Contacts that need manual review or AI analysis',
    '#94a3b8',
    'Review this contact manually to determine the appropriate stage. Consider their engagement level, conversation history, and intent.',
    true,
    true,
    999
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_stages
    WHERE pipeline_stages.user_id = users.id
    AND pipeline_stages.is_default = true
)
ON CONFLICT DO NOTHING;

-- ✅ STEP 2: Fix any users with multiple default stages
WITH ranked_defaults AS (
    SELECT 
        id,
        user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
    FROM pipeline_stages
    WHERE is_default = true
)
UPDATE pipeline_stages
SET is_default = false
WHERE id IN (SELECT id FROM ranked_defaults WHERE rn > 1);

-- ✅ STEP 3: Ensure all default stages are active
UPDATE pipeline_stages
SET is_active = true
WHERE is_default = true AND is_active = false;

-- ✅ STEP 4: Verification - Show results
SELECT 
    '🎉 SETUP COMPLETE!' as status,
    COUNT(DISTINCT user_id) as users_with_default_stage,
    COUNT(*) as total_default_stages
FROM pipeline_stages
WHERE is_default = true;

-- 📊 Show details per user
SELECT 
    u.name as user_name,
    u.email,
    ps.name as stage_name,
    ps.is_active,
    ps.position,
    ps.created_at,
    COUNT(po.id) as contacts_in_stage
FROM users u
LEFT JOIN pipeline_stages ps ON ps.user_id = u.id AND ps.is_default = true
LEFT JOIN pipeline_opportunities po ON po.stage_id = ps.id
GROUP BY u.id, u.name, u.email, ps.id, ps.name, ps.is_active, ps.position, ps.created_at
ORDER BY u.name;

-- ✅ Done! Your pipeline now has automatic default stages.

