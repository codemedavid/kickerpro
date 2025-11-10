-- ============================================
-- VALIDATE: Pipeline Sorting Test Results
-- Run this AFTER adding test contacts to pipeline
-- ============================================
-- Replace 'YOUR_USER_ID' with your actual user_id
-- ============================================

-- ============================================
-- VALIDATION: Expected vs Actual Stages
-- ============================================

WITH expected_stages AS (
    -- Define what we expect for each test contact
    SELECT 'John Browser' as name, 'New Lead' as expected_stage, 'TEST_BROWSE_001' as sender_id UNION ALL
    SELECT 'Maria Interested', 'Qualified', 'TEST_QUALIFIED_001' UNION ALL
    SELECT 'Carlos Buyer', 'Hot Lead', 'TEST_HOT_001' UNION ALL
    SELECT 'Sarah Urgent', 'Hot Lead', 'TEST_HOT_002' UNION ALL
    SELECT 'Lisa Explorer', 'New Lead', 'TEST_BROWSE_002' UNION ALL
    SELECT 'Tom Comparer', 'Qualified', 'TEST_QUALIFIED_002'
),
actual_results AS (
    -- Get actual results from pipeline
    SELECT 
        po.sender_name,
        po.sender_id,
        ps.name as actual_stage,
        ps.is_default as in_default,
        po.ai_confidence_score,
        po.both_prompts_agreed,
        po.ai_analyzed_at,
        po.created_at
    FROM pipeline_opportunities po
    JOIN pipeline_stages ps ON po.stage_id = ps.id
    WHERE po.user_id = 'YOUR_USER_ID'
      AND po.sender_id LIKE 'TEST_%'
)
SELECT 
    '=== TEST RESULT ===' as section,
    e.name as contact_name,
    e.expected_stage,
    COALESCE(a.actual_stage, '❌ NOT IN PIPELINE') as actual_stage,
    CASE 
        WHEN a.actual_stage IS NULL THEN '❌ NOT ADDED TO PIPELINE'
        WHEN a.actual_stage = e.expected_stage THEN '✅ CORRECT'
        WHEN a.in_default = true THEN '⚠️  IN DEFAULT (needs review)'
        ELSE '❌ WRONG STAGE'
    END as result,
    COALESCE(a.ai_confidence_score, 0) as confidence,
    COALESCE(a.both_prompts_agreed::text, 'N/A') as agreed,
    CASE 
        WHEN a.ai_analyzed_at IS NULL THEN '❌ NOT ANALYZED'
        ELSE '✅ Analyzed'
    END as analysis_status
FROM expected_stages e
LEFT JOIN actual_results a ON e.sender_id = a.sender_id
ORDER BY e.name;

-- ============================================
-- ACCURACY METRICS
-- ============================================

WITH expected_stages AS (
    SELECT 'John Browser' as name, 'New Lead' as expected_stage, 'TEST_BROWSE_001' as sender_id UNION ALL
    SELECT 'Maria Interested', 'Qualified', 'TEST_QUALIFIED_001' UNION ALL
    SELECT 'Carlos Buyer', 'Hot Lead', 'TEST_HOT_001' UNION ALL
    SELECT 'Sarah Urgent', 'Hot Lead', 'TEST_HOT_002' UNION ALL
    SELECT 'Lisa Explorer', 'New Lead', 'TEST_BROWSE_002' UNION ALL
    SELECT 'Tom Comparer', 'Qualified', 'TEST_QUALIFIED_002'
),
actual_results AS (
    SELECT 
        po.sender_id,
        ps.name as actual_stage,
        ps.is_default,
        po.ai_confidence_score,
        po.both_prompts_agreed
    FROM pipeline_opportunities po
    JOIN pipeline_stages ps ON po.stage_id = ps.id
    WHERE po.user_id = 'YOUR_USER_ID'
      AND po.sender_id LIKE 'TEST_%'
),
matches AS (
    SELECT 
        e.name,
        e.expected_stage,
        a.actual_stage,
        a.is_default,
        a.ai_confidence_score,
        a.both_prompts_agreed,
        CASE 
            WHEN a.actual_stage = e.expected_stage THEN 1
            ELSE 0
        END as is_correct
    FROM expected_stages e
    LEFT JOIN actual_results a ON e.sender_id = a.sender_id
)
SELECT 
    '=== ACCURACY METRICS ===' as section,
    COUNT(*) as total_tests,
    SUM(CASE WHEN actual_stage IS NOT NULL THEN 1 ELSE 0 END) as added_to_pipeline,
    SUM(is_correct) as correct_assignments,
    ROUND(100.0 * SUM(is_correct) / NULLIF(COUNT(*), 0), 1) || '%' as accuracy_percentage,
    COUNT(CASE WHEN is_default = true THEN 1 END) as in_default_stage,
    ROUND(AVG(ai_confidence_score), 2) as avg_confidence,
    COUNT(CASE WHEN both_prompts_agreed = true THEN 1 END) as agreements,
    COUNT(CASE WHEN both_prompts_agreed = false THEN 1 END) as disagreements
FROM matches;

-- ============================================
-- DETAILED AI REASONING
-- ============================================

SELECT 
    '=== AI REASONING DETAILS ===' as section,
    po.sender_name,
    ps.name as assigned_stage,
    po.ai_confidence_score,
    po.both_prompts_agreed,
    po.ai_analysis_result->'global_analysis'->>'recommended_stage' as global_recommendation,
    po.ai_analysis_result->'global_analysis'->>'reasoning' as global_reasoning,
    po.ai_analysis_result->'global_analysis'->>'confidence' as global_confidence,
    CASE 
        WHEN po.both_prompts_agreed = true THEN '✅ Both prompts agreed'
        WHEN po.both_prompts_agreed = false THEN '⚠️  Prompts disagreed - moved to default'
        ELSE 'No analysis data'
    END as agreement_status
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'TEST_%'
ORDER BY po.created_at;

-- ============================================
-- STAGE-SPECIFIC ANALYSIS RESULTS
-- ============================================

SELECT 
    '=== STAGE-SPECIFIC MATCHES ===' as section,
    po.sender_name,
    jsonb_array_elements(po.ai_analysis_result->'stage_analyses')->>'stage_name' as stage_evaluated,
    jsonb_array_elements(po.ai_analysis_result->'stage_analyses')->>'belongs' as belongs,
    jsonb_array_elements(po.ai_analysis_result->'stage_analyses')->>'confidence' as stage_confidence,
    jsonb_array_elements(po.ai_analysis_result->'stage_analyses')->>'reasoning' as stage_reasoning
FROM pipeline_opportunities po
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'TEST_%'
  AND po.ai_analysis_result IS NOT NULL
ORDER BY po.sender_name, stage_evaluated;

-- ============================================
-- INTERPRETATION GUIDE
-- ============================================

/*

INTERPRETING RESULTS:

1. ACCURACY PERCENTAGE:
   ✅ 100% = Perfect! All contacts sorted correctly
   ✅ 83% (5/6) = Excellent! One needed manual review
   ✅ 67% (4/6) = Good! Two were uncertain (AI being cautious)
   ⚠️  50% (3/6) = Fair - prompts need adjustment
   ❌ 33% (2/6) = Poor - prompts too strict or misaligned
   ❌ 0% = Critical - AI analysis didn't run or all disagreed

2. AGREEMENT RATE:
   ✅ Agreements > Disagreements = Good alignment
   ⚠️  Disagreements > Agreements = Prompts don't match
   ❌ All disagreements = Global and stage prompts contradict

3. CONFIDENCE SCORES:
   ✅ Average > 0.8 = High confidence, good prompts
   ✅ Average > 0.7 = Good confidence
   ⚠️  Average 0.5-0.7 = Moderate confidence, room for improvement
   ❌ Average < 0.5 = Low confidence, prompts need work

4. IN DEFAULT STAGE:
   ✅ 0-1 contacts = Excellent! AI is confident
   ✅ 2-3 contacts = Good! Some needed manual review
   ⚠️  4-5 contacts = Most went to default, adjust prompts
   ❌ All 6 in default = Problem! Check if AI analysis ran

NEXT ACTIONS BASED ON RESULTS:

If Accuracy < 50%:
  → Review AI reasoning for each contact
  → Identify why prompts disagreed
  → Adjust stage prompts to be less strict
  → Re-run test

If Many Disagreements:
  → Global prompt and stage prompts don't align
  → Rewrite stage prompts to match global strategy
  → Ensure keywords are consistent
  → Test again

If All in Default:
  → Check if AI analysis actually ran (ai_analyzed_at)
  → If NULL: Settings or API issue
  → If NOT NULL: All prompts disagreed (too strict)

If High Accuracy (>80%):
  → ✅ Working well! Review the "wrong" ones
  → Check their AI reasoning
  → Fine-tune prompts if needed
  → Ready for production use

*/

-- ============================================
-- EXPORT RESULTS FOR REPORTING
-- ============================================

-- Copy this output to create a test report
WITH test_results AS (
    SELECT 
        po.sender_name,
        ps.name as actual_stage,
        ps.is_default,
        po.ai_confidence_score,
        po.both_prompts_agreed,
        po.ai_analysis_result->'global_analysis'->>'recommended_stage' as global_rec,
        po.ai_analysis_result->'global_analysis'->>'reasoning' as reasoning
    FROM pipeline_opportunities po
    JOIN pipeline_stages ps ON po.stage_id = ps.id
    WHERE po.user_id = 'YOUR_USER_ID'
      AND po.sender_id LIKE 'TEST_%'
)
SELECT 
    '=== TEST REPORT SUMMARY ===' as report,
    json_agg(
        json_build_object(
            'contact', sender_name,
            'stage', actual_stage,
            'is_default', is_default,
            'confidence', ai_confidence_score,
            'agreed', both_prompts_agreed,
            'global_recommendation', global_rec,
            'reasoning', reasoning
        )
    ) as detailed_results
FROM test_results;
