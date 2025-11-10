-- ============================================
-- DIAGNOSE: Pipeline Auto-Sorting Issue
-- Why did all contacts go to default stage?
-- ============================================
-- Run this in Supabase SQL Editor
-- Replace 'YOUR_USER_ID' with your actual user_id
-- ============================================

-- Get your user_id first if you don't know it:
-- SELECT id, email FROM auth.users LIMIT 5;

-- ============================================
-- STEP 1: Check Pipeline Settings
-- ============================================

SELECT 
    '=== PIPELINE SETTINGS CHECK ===' as section,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ CRITICAL: No pipeline_settings record found! AI analysis cannot run without this.'
        WHEN MAX(LENGTH(global_analysis_prompt)) < 50 THEN '⚠️  WARNING: Global prompt too short (' || MAX(LENGTH(global_analysis_prompt)) || ' chars)'
        ELSE '✅ GOOD: Settings configured with ' || MAX(LENGTH(global_analysis_prompt)) || ' char prompt'
    END as status,
    MAX(SUBSTRING(global_analysis_prompt, 1, 200)) || '...' as prompt_preview,
    MAX(auto_analyze) as auto_analyze
FROM pipeline_settings
WHERE user_id = 'YOUR_USER_ID';

-- ============================================
-- STEP 2: Check Pipeline Stages
-- ============================================

SELECT 
    '=== STAGE ' || ROW_NUMBER() OVER (ORDER BY position) || ' ===' as section,
    name,
    CASE 
        WHEN analysis_prompt IS NULL OR LENGTH(analysis_prompt) = 0 
        THEN '❌ CRITICAL: No analysis_prompt! AI cannot validate this stage.'
        WHEN LENGTH(analysis_prompt) < 30
        THEN '⚠️  WARNING: Prompt too short (' || LENGTH(analysis_prompt) || ' chars)'
        ELSE '✅ GOOD: Has prompt (' || LENGTH(analysis_prompt) || ' chars)'
    END as prompt_status,
    CASE WHEN is_default THEN '✅ DEFAULT' ELSE '' END as default_marker,
    CASE WHEN is_active THEN '✅ ACTIVE' ELSE '❌ INACTIVE' END as active_status,
    position,
    SUBSTRING(analysis_prompt, 1, 100) || '...' as prompt_preview
FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID'
ORDER BY position;

-- Count stages
SELECT 
    '=== STAGE SUMMARY ===' as section,
    COUNT(*) as total_stages,
    COUNT(CASE WHEN is_active THEN 1 END) as active_stages,
    COUNT(CASE WHEN analysis_prompt IS NOT NULL AND LENGTH(analysis_prompt) > 0 THEN 1 END) as stages_with_prompts,
    COUNT(CASE WHEN is_default THEN 1 END) as default_stages,
    CASE 
        WHEN COUNT(CASE WHEN analysis_prompt IS NOT NULL AND LENGTH(analysis_prompt) > 0 THEN 1 END) < 2 
        THEN '❌ CRITICAL: Need at least 2 stages with prompts'
        ELSE '✅ GOOD'
    END as validation
FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID';

-- ============================================
-- STEP 3: Check Recent Opportunities
-- ============================================

SELECT 
    '=== RECENT CONTACT ' || ROW_NUMBER() OVER (ORDER BY po.created_at DESC) || ' ===' as section,
    po.sender_name,
    ps.name as current_stage_name,
    CASE WHEN ps.is_default THEN '⚠️  IN DEFAULT STAGE' ELSE '✅ In custom stage' END as stage_type,
    CASE 
        WHEN po.ai_analyzed_at IS NULL THEN '❌ CRITICAL: AI analysis never ran'
        WHEN po.both_prompts_agreed IS NULL THEN '⚠️  WARNING: Analysis incomplete'
        WHEN po.both_prompts_agreed = false THEN '⚠️  AI DISAGREED (moved to default)'
        WHEN po.both_prompts_agreed = true THEN '✅ AI AGREED (high confidence)'
        ELSE '❓ Unknown status'
    END as analysis_status,
    po.ai_confidence_score as confidence,
    po.ai_analyzed_at,
    po.created_at,
    DATE_PART('second', po.ai_analyzed_at - po.created_at) as seconds_to_analyze
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
ORDER BY po.created_at DESC
LIMIT 10;

-- ============================================
-- STEP 4: Check AI Analysis Results (If Available)
-- ============================================

SELECT 
    '=== AI REASONING ===' as section,
    po.sender_name,
    ps.name as assigned_stage,
    po.ai_confidence_score,
    po.both_prompts_agreed,
    po.ai_analysis_result->>'global_analysis' as global_ai_recommendation,
    po.ai_analysis_result->'final_decision'->>'stage_id' as decided_stage_id,
    po.ai_analysis_result->'final_decision'->>'confidence' as decided_confidence,
    SUBSTRING(po.ai_analysis_result::text, 1, 200) || '...' as full_result_preview
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.ai_analysis_result IS NOT NULL
ORDER BY po.created_at DESC
LIMIT 5;

-- ============================================
-- STEP 5: Statistics Summary
-- ============================================

SELECT 
    '=== OVERALL STATISTICS ===' as section,
    COUNT(*) as total_opportunities,
    COUNT(CASE WHEN ai_analyzed_at IS NOT NULL THEN 1 END) as analyzed_count,
    COUNT(CASE WHEN ai_analyzed_at IS NULL THEN 1 END) as not_analyzed_count,
    COUNT(CASE WHEN both_prompts_agreed = true THEN 1 END) as high_confidence_sorted,
    COUNT(CASE WHEN both_prompts_agreed = false THEN 1 END) as ai_disagreed,
    COUNT(CASE WHEN ps.is_default = true THEN 1 END) as in_default_stage,
    ROUND(AVG(CASE WHEN ai_confidence_score IS NOT NULL THEN ai_confidence_score END), 2) as avg_confidence,
    CASE 
        WHEN COUNT(CASE WHEN ai_analyzed_at IS NULL THEN 1 END) = COUNT(*) 
        THEN '❌ PROBLEM: AI analysis never ran on any contact'
        WHEN COUNT(CASE WHEN ps.is_default = true THEN 1 END) = COUNT(*)
        THEN '⚠️  PROBLEM: All contacts in default stage'
        WHEN COUNT(CASE WHEN both_prompts_agreed = false THEN 1 END) > COUNT(*) * 0.8
        THEN '⚠️  PROBLEM: >80% disagreements - prompts need adjustment'
        ELSE '✅ GOOD: Mixed distribution'
    END as diagnosis
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.created_at > NOW() - INTERVAL '7 days';

-- ============================================
-- DIAGNOSIS INTERPRETATION
-- ============================================

/*

INTERPRETATION GUIDE:

1. If "No pipeline_settings record found":
   → CAUSE: Pipeline settings not configured
   → FIX: Run setup-pipeline-for-testing.sql to create settings
   → THIS IS THE MOST COMMON ISSUE

2. If "AI analysis never ran":
   → CAUSE: Either settings missing OR API quota exceeded
   → CHECK: Server logs for "No global analysis prompt" or "quota exceeded"
   → FIX: Configure settings OR wait for API quota reset

3. If "All contacts in default stage" AND analyzed_count > 0:
   → CAUSE: AI ran but all disagreed (prompts too strict)
   → FIX: Make stage prompts less strict, add more keywords
   → Review AI reasoning in ai_analysis_result field

4. If ">80% disagreements":
   → CAUSE: Global prompt and stage prompts don't align
   → FIX: Rewrite prompts to be consistent with each other
   → Example: Global says "interested = qualified" but stage says "must discuss pricing"

5. If "Mixed distribution":
   → STATUS: Working correctly!
   → Some contacts sorted, some in default for review
   → This is expected behavior

*/

-- ============================================
-- NEXT STEPS BASED ON DIAGNOSIS
-- ============================================

/*

NEXT STEP DECISION TREE:

If Step 1 shows "No pipeline_settings":
  → Run: setup-pipeline-for-testing.sql
  → Then: Test with one contact
  → Expected: Should sort correctly

If Step 2 shows stages without prompts:
  → Add analysis_prompt to each stage
  → Keep prompts simple and broad
  → Test again

If Step 3 shows "AI analysis never ran":
  → Check server console for errors
  → If "quota exceeded": Wait 24 hours
  → If "not configured": Add settings

If Step 3 shows "AI DISAGREED" on all:
  → Stage prompts are too strict
  → Make them more general
  → Add more keyword examples
  → Reduce required criteria

If everything looks good but still not working:
  → Check Gemini API key in .env.local
  → Verify server was restarted
  → Check API quota status
  → Run test script to validate

*/
