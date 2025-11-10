-- ============================================
-- DIAGNOSE PIPELINE SORTING - Current State
-- Run this in Supabase SQL Editor
-- Replace 'YOUR_USER_ID' with your actual user ID
-- ============================================

-- Get your user ID first
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- After you have your user ID, replace it below:
-- Example: '12345678-1234-1234-1234-123456789abc'

DO $$
DECLARE
    v_user_id UUID := 'YOUR_USER_ID'; -- REPLACE THIS!
BEGIN
    -- ============================================
    -- CHECK 1: Pipeline Settings
    -- ============================================
    RAISE NOTICE '============================================';
    RAISE NOTICE 'CHECK 1: PIPELINE SETTINGS';
    RAISE NOTICE '============================================';
    
    IF EXISTS (
        SELECT 1 FROM pipeline_settings WHERE user_id = v_user_id
    ) THEN
        RAISE NOTICE '✅ Settings exist';
        
        PERFORM (
            SELECT 
                '  Prompt length: ' || LENGTH(global_analysis_prompt) || ' chars'
            FROM pipeline_settings 
            WHERE user_id = v_user_id
        );
        
    ELSE
        RAISE NOTICE '❌ NO SETTINGS FOUND - This is likely the problem!';
        RAISE NOTICE '  → Need to create pipeline_settings record';
    END IF;
    
    -- ============================================
    -- CHECK 2: Pipeline Stages
    -- ============================================
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'CHECK 2: PIPELINE STAGES';
    RAISE NOTICE '============================================';
    
    RAISE NOTICE 'Total stages: %', (
        SELECT COUNT(*) FROM pipeline_stages WHERE user_id = v_user_id
    );
    
    RAISE NOTICE 'Active stages: %', (
        SELECT COUNT(*) FROM pipeline_stages WHERE user_id = v_user_id AND is_active = true
    );
    
    RAISE NOTICE 'Stages with prompts: %', (
        SELECT COUNT(*) 
        FROM pipeline_stages 
        WHERE user_id = v_user_id 
          AND analysis_prompt IS NOT NULL 
          AND LENGTH(analysis_prompt) > 0
    );
    
    RAISE NOTICE 'Default stage: %', (
        SELECT COALESCE(name, 'NONE') 
        FROM pipeline_stages 
        WHERE user_id = v_user_id AND is_default = true 
        LIMIT 1
    );
    
    -- ============================================
    -- CHECK 3: Recent Opportunities
    -- ============================================
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'CHECK 3: RECENT OPPORTUNITIES (Last 10)';
    RAISE NOTICE '============================================';
    
    RAISE NOTICE 'Total in pipeline: %', (
        SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = v_user_id
    );
    
    RAISE NOTICE 'Analyzed contacts: %', (
        SELECT COUNT(*) 
        FROM pipeline_opportunities 
        WHERE user_id = v_user_id 
          AND ai_analyzed_at IS NOT NULL
    );
    
    RAISE NOTICE 'High confidence (agreed): %', (
        SELECT COUNT(*) 
        FROM pipeline_opportunities 
        WHERE user_id = v_user_id 
          AND both_prompts_agreed = true
    );
    
    RAISE NOTICE 'Low confidence (disagreed): %', (
        SELECT COUNT(*) 
        FROM pipeline_opportunities 
        WHERE user_id = v_user_id 
          AND both_prompts_agreed = false
    );
    
    RAISE NOTICE 'In default stage: %', (
        SELECT COUNT(*) 
        FROM pipeline_opportunities po
        JOIN pipeline_stages ps ON po.stage_id = ps.id
        WHERE po.user_id = v_user_id 
          AND ps.is_default = true
    );
    
END $$;

-- ============================================
-- DETAILED VIEW: Show actual data
-- ============================================

-- View 1: Settings Details
SELECT 
    '=== PIPELINE SETTINGS ===' as section,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ NOT CONFIGURED'
        ELSE '✅ CONFIGURED'
    END as status,
    MAX(LENGTH(global_analysis_prompt)) as prompt_length,
    MAX(SUBSTRING(global_analysis_prompt, 1, 100)) as prompt_preview
FROM pipeline_settings
WHERE user_id = 'YOUR_USER_ID';

-- View 2: Stages Details
SELECT 
    '=== STAGES ===' as section,
    name,
    is_active,
    is_default,
    CASE 
        WHEN analysis_prompt IS NULL OR LENGTH(analysis_prompt) = 0 
        THEN '❌ NO PROMPT'
        ELSE '✅ ' || LENGTH(analysis_prompt) || ' chars'
    END as prompt_status,
    position
FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID'
ORDER BY position;

-- View 3: Recent Opportunities
SELECT 
    '=== RECENT CONTACTS ===' as section,
    po.sender_name,
    ps.name as current_stage,
    ps.is_default as in_default_stage,
    CASE 
        WHEN po.ai_analyzed_at IS NULL THEN '❌ NOT ANALYZED'
        WHEN po.both_prompts_agreed = true THEN '✅ HIGH CONFIDENCE'
        WHEN po.both_prompts_agreed = false THEN '⚠️  AI DISAGREED'
        ELSE '❓ UNKNOWN'
    END as analysis_status,
    po.ai_confidence_score as confidence,
    po.created_at
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
ORDER BY po.created_at DESC
LIMIT 10;

-- View 4: AI Analysis Details (if any)
SELECT 
    '=== AI ANALYSIS RESULTS ===' as section,
    po.sender_name,
    po.ai_analysis_result->>'global_analysis' as global_recommendation,
    po.both_prompts_agreed,
    po.ai_confidence_score,
    po.ai_analyzed_at
FROM pipeline_opportunities po
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.ai_analysis_result IS NOT NULL
ORDER BY po.created_at DESC
LIMIT 5;

-- ============================================
-- DIAGNOSIS SUMMARY
-- ============================================

SELECT 
    '=== DIAGNOSIS SUMMARY ===' as summary,
    CASE 
        WHEN (SELECT COUNT(*) FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID') = 0 
        THEN '❌ ISSUE: No pipeline settings configured'
        WHEN (SELECT COUNT(*) FROM pipeline_stages WHERE user_id = 'YOUR_USER_ID' AND analysis_prompt IS NOT NULL) < 2
        THEN '❌ ISSUE: Stages missing analysis prompts'
        WHEN (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID' AND ai_analyzed_at IS NULL) > 0
        THEN '⚠️  ISSUE: AI analysis did not run (quota exceeded?)'
        WHEN (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID' AND both_prompts_agreed = false) > (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID' AND both_prompts_agreed = true)
        THEN '⚠️  ISSUE: Most contacts disagreed (prompts too strict)'
        ELSE '✅ Configuration looks OK - check server logs for API errors'
    END as primary_issue;
