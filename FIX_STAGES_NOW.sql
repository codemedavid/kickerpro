-- ============================================
-- FIX: Clean up and create proper stages
-- ============================================
-- This will:
-- 1. Delete duplicate/old stages
-- 2. Create the 3 proper stages
-- 3. Keep one Unmatched as default
-- ============================================

-- STEP 1: Get your user_id (if you don't have it)
-- SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- STEP 2: Edit line 19 below with your user_id
-- STEP 3: Run this entire file

-- ============================================

-- 🔽 EDIT THIS LINE - Replace with your actual user_id:
DO $$
DECLARE
    v_user_id uuid := 'PASTE-YOUR-USER-ID-HERE';
BEGIN

    -- Delete ALL existing stages for this user (start fresh)
    DELETE FROM pipeline_stages WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted old stages';

    -- Create New Lead stage
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    VALUES (
        v_user_id,
        'New Lead',
        'Early exploration - first contact',
        '#3b82f6',
        'New Lead if first message or general browsing questions. Keywords: info, curious, what, tell me.',
        false,
        true,
        0
    );
    RAISE NOTICE 'Created New Lead stage';

    -- Create Qualified stage
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    VALUES (
        v_user_id,
        'Qualified',
        'Showing interest in products',
        '#22c55e',
        'Qualified if showing interest, pricing questions, discussed needs. Keywords: price, cost, interested, need.',
        false,
        true,
        1
    );
    RAISE NOTICE 'Created Qualified stage';

    -- Create Hot Lead stage
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    VALUES (
        v_user_id,
        'Hot Lead',
        'Ready to purchase',
        '#ef4444',
        'Hot Lead if ready to buy, requested quote, urgent. Keywords: buy, order, quote, ASAP, ready, purchase.',
        false,
        true,
        2
    );
    RAISE NOTICE 'Created Hot Lead stage';

    -- Create Unmatched stage (default)
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    VALUES (
        v_user_id,
        'Unmatched',
        'Needs manual review',
        '#94a3b8',
        'Default stage for contacts that need manual review or when AI is uncertain.',
        true,
        true,
        999
    );
    RAISE NOTICE 'Created Unmatched stage (default)';

    RAISE NOTICE 'DONE! 4 stages created successfully';

END $$;

-- Verify stages
SELECT 
    name,
    LENGTH(analysis_prompt) as prompt_chars,
    is_default,
    position
FROM pipeline_stages
ORDER BY position;

