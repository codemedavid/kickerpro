-- ================================================================
-- RESTORE DEFAULT PIPELINE STAGE
-- Creates or updates the default "Unmatched" stage
-- ================================================================

-- First, check if a default stage exists
-- If it does, reactivate it. If not, create it.

-- Reactivate any existing default stage
UPDATE pipeline_stages
SET is_active = true,
    is_default = true
WHERE name = 'Unmatched'
  AND is_active = false;

-- If no default stage exists at all, create one
-- This uses ON CONFLICT to avoid errors if stage already exists
INSERT INTO pipeline_stages (
    user_id,
    name,
    description,
    color,
    analysis_prompt,
    is_default,
    position
)
SELECT 
    id as user_id,
    'Unmatched' as name,
    'Contacts that need manual review or AI analysis' as description,
    '#94a3b8' as color,
    'Review this contact manually to determine the appropriate stage. Consider their engagement level, conversation history, and intent.' as analysis_prompt,
    true as is_default,
    999 as position
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_stages
    WHERE pipeline_stages.user_id = users.id
    AND pipeline_stages.name = 'Unmatched'
);

-- Show what was created/updated
SELECT 
    id,
    user_id,
    name,
    is_default,
    is_active,
    position,
    created_at
FROM pipeline_stages
WHERE name = 'Unmatched'
ORDER BY created_at DESC;

