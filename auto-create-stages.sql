-- ============================================
-- AUTO CREATE STAGES - Just Copy and Run
-- This script automatically gets your user_id
-- ============================================

-- Create stages using a CTE to get user_id automatically
WITH current_user AS (
    SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1
)
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id as user_id,
    stage_name,
    stage_desc,
    stage_color,
    stage_prompt,
    stage_default,
    true as is_active,
    stage_position
FROM current_user
CROSS JOIN (
    VALUES
        ('New Lead', 'Early exploration', '#3b82f6', 'New Lead if browsing or first message. Keywords: info, curious, what, tell me.', false, 0),
        ('Qualified', 'Showing interest', '#22c55e', 'Qualified if pricing questions or showing interest. Keywords: price, cost, interested, need.', false, 1),
        ('Hot Lead', 'Ready to buy', '#ef4444', 'Hot Lead if ready to buy or requesting quote. Keywords: buy, order, quote, ASAP.', false, 2)
) AS stages(stage_name, stage_desc, stage_color, stage_prompt, stage_default, stage_position)
ON CONFLICT (user_id, name) DO UPDATE SET
    analysis_prompt = EXCLUDED.analysis_prompt,
    description = EXCLUDED.description,
    color = EXCLUDED.color;

-- Verify
SELECT 
    '✅ Stages Created' as status,
    name,
    LENGTH(analysis_prompt) as prompt_chars,
    is_default,
    position
FROM pipeline_stages
ORDER BY position;

