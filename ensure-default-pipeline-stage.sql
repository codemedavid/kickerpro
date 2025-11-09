-- ================================================================
-- ENSURE DEFAULT PIPELINE STAGE FOR ALL USERS
-- Automatically creates "Unmatched" stage for unmatched contacts
-- ================================================================

-- Step 1: Create default stages for all existing users who don't have one
-- This handles historical data
INSERT INTO pipeline_stages (
    user_id,
    name,
    description,
    color,
    analysis_prompt,
    is_default,
    is_active,
    position,
    created_at,
    updated_at
)
SELECT 
    users.id as user_id,
    'Unmatched' as name,
    'Contacts that need manual review or AI analysis' as description,
    '#94a3b8' as color,
    'Review this contact manually to determine the appropriate stage. Consider their engagement level, conversation history, and intent.' as analysis_prompt,
    true as is_default,
    true as is_active,
    999 as position,
    NOW() as created_at,
    NOW() as updated_at
FROM users
WHERE NOT EXISTS (
    SELECT 1 
    FROM pipeline_stages
    WHERE pipeline_stages.user_id = users.id
    AND pipeline_stages.is_default = true
)
ON CONFLICT DO NOTHING;

-- Step 2: Ensure only ONE default stage per user
-- If multiple default stages exist, keep the oldest one
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
WHERE id IN (
    SELECT id 
    FROM ranked_defaults 
    WHERE rn > 1
);

-- Step 3: Reactivate any inactive default stages
UPDATE pipeline_stages
SET is_active = true
WHERE is_default = true 
AND is_active = false;

-- Step 4: Create a function to automatically create default stage for new users
-- This function will be called by a trigger when accessing pipeline features
CREATE OR REPLACE FUNCTION ensure_user_has_default_stage(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_stage_id UUID;
BEGIN
    -- Check if user already has a default stage
    SELECT id INTO v_stage_id
    FROM pipeline_stages
    WHERE user_id = p_user_id
    AND is_default = true
    AND is_active = true
    LIMIT 1;

    -- If no default stage exists, create one
    IF v_stage_id IS NULL THEN
        INSERT INTO pipeline_stages (
            user_id,
            name,
            description,
            color,
            analysis_prompt,
            is_default,
            is_active,
            position
        ) VALUES (
            p_user_id,
            'Unmatched',
            'Contacts that need manual review or AI analysis',
            '#94a3b8',
            'Review this contact manually to determine the appropriate stage. Consider their engagement level, conversation history, and intent.',
            true,
            true,
            999
        )
        RETURNING id INTO v_stage_id;
    END IF;

    RETURN v_stage_id;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create a helper view to show default stages
CREATE OR REPLACE VIEW user_default_stages AS
SELECT 
    ps.id,
    ps.user_id,
    ps.name,
    ps.description,
    ps.color,
    ps.position,
    ps.is_active,
    ps.created_at,
    COUNT(po.id) as contact_count
FROM pipeline_stages ps
LEFT JOIN pipeline_opportunities po ON po.stage_id = ps.id
WHERE ps.is_default = true
GROUP BY ps.id, ps.user_id, ps.name, ps.description, ps.color, ps.position, ps.is_active, ps.created_at;

-- Step 6: Show results
SELECT 
    '✅ Default Pipeline Stages Setup Complete!' as status,
    COUNT(*) as total_default_stages,
    COUNT(DISTINCT user_id) as users_with_default_stage
FROM pipeline_stages
WHERE is_default = true;

-- Show breakdown per user
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email,
    ps.id as stage_id,
    ps.name as stage_name,
    ps.is_active,
    COUNT(po.id) as contacts_in_stage
FROM users u
LEFT JOIN pipeline_stages ps ON ps.user_id = u.id AND ps.is_default = true
LEFT JOIN pipeline_opportunities po ON po.stage_id = ps.id
GROUP BY u.id, u.name, u.email, ps.id, ps.name, ps.is_active
ORDER BY u.name;

-- Step 7: Verification queries
SELECT 
    '📊 Pipeline Statistics' as info,
    (SELECT COUNT(*) FROM pipeline_stages WHERE is_default = true) as total_default_stages,
    (SELECT COUNT(DISTINCT user_id) FROM pipeline_stages WHERE is_default = true) as users_with_default,
    (SELECT COUNT(*) FROM pipeline_opportunities po 
     JOIN pipeline_stages ps ON ps.id = po.stage_id 
     WHERE ps.is_default = true) as contacts_in_unmatched_stage;

