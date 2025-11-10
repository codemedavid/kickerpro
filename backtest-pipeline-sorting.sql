-- ============================================
-- BACKTEST: Pipeline Sorting Accuracy Analysis
-- Analyzes historical sorting results and metrics
-- ============================================
-- Replace 'YOUR_USER_ID' with your actual user_id
-- ============================================

-- ============================================
-- BACKTEST 1: Overall Accuracy
-- ============================================

WITH test_expectations AS (
    -- Define expected outcomes for test contacts
    SELECT 
        sender_id,
        CASE 
            WHEN sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
            WHEN sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
            WHEN sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
        END as expected_stage
    FROM messenger_conversations
    WHERE sender_id LIKE 'TEST_%'
      AND user_id = 'YOUR_USER_ID'
),
actual_assignments AS (
    SELECT 
        po.sender_id,
        po.sender_name,
        ps.name as actual_stage,
        ps.is_default,
        po.ai_confidence_score,
        po.both_prompts_agreed,
        po.ai_analyzed_at,
        po.created_at
    FROM pipeline_opportunities po
    JOIN pipeline_stages ps ON po.stage_id = ps.id
    WHERE po.user_id = 'YOUR_USER_ID'
      AND po.sender_id LIKE 'TEST_%'
),
comparison AS (
    SELECT 
        e.sender_id,
        a.sender_name,
        e.expected_stage,
        COALESCE(a.actual_stage, 'NOT ADDED') as actual_stage,
        a.is_default,
        a.ai_confidence_score,
        a.both_prompts_agreed,
        a.ai_analyzed_at,
        CASE 
            WHEN a.actual_stage IS NULL THEN 'NOT_ADDED'
            WHEN a.actual_stage = e.expected_stage THEN 'CORRECT'
            WHEN a.is_default = true THEN 'DEFAULT'
            ELSE 'WRONG'
        END as result_category
    FROM test_expectations e
    LEFT JOIN actual_assignments a ON e.sender_id = a.sender_id
)
SELECT 
    '=== BACKTEST: Test Accuracy ===' as section,
    sender_name as contact,
    expected_stage,
    actual_stage,
    CASE 
        WHEN result_category = 'CORRECT' THEN '✅ PASS'
        WHEN result_category = 'DEFAULT' THEN '⚠️  IN DEFAULT (needs review)'
        WHEN result_category = 'WRONG' THEN '❌ FAIL (wrong stage)'
        WHEN result_category = 'NOT_ADDED' THEN '❌ NOT IN PIPELINE'
    END as test_result,
    ai_confidence_score as confidence,
    CASE WHEN both_prompts_agreed THEN 'Agreed' ELSE 'Disagreed' END as agreement,
    CASE WHEN ai_analyzed_at IS NOT NULL THEN 'Yes' ELSE 'No' END as was_analyzed
FROM comparison
ORDER BY 
    CASE result_category
        WHEN 'CORRECT' THEN 1
        WHEN 'DEFAULT' THEN 2
        WHEN 'WRONG' THEN 3
        ELSE 4
    END,
    sender_name;

-- ============================================
-- BACKTEST 2: Accuracy Metrics
-- ============================================

WITH comparison AS (
    SELECT 
        CASE 
            WHEN te.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
            WHEN te.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
            WHEN te.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
        END as expected,
        ps.name as actual,
        ps.is_default,
        po.ai_confidence_score,
        po.both_prompts_agreed
    FROM messenger_conversations te
    LEFT JOIN pipeline_opportunities po ON te.id = po.conversation_id
    LEFT JOIN pipeline_stages ps ON po.stage_id = ps.id
    WHERE te.sender_id LIKE 'TEST_%'
      AND te.user_id = 'YOUR_USER_ID'
)
SELECT 
    '=== ACCURACY SUMMARY ===' as section,
    COUNT(*) as total_tests,
    SUM(CASE WHEN actual IS NOT NULL THEN 1 ELSE 0 END) as in_pipeline,
    SUM(CASE WHEN actual = expected THEN 1 ELSE 0 END) as correct,
    SUM(CASE WHEN is_default = true THEN 1 ELSE 0 END) as in_default,
    ROUND(100.0 * SUM(CASE WHEN actual = expected THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) || '%' as accuracy,
    ROUND(AVG(COALESCE(ai_confidence_score, 0)), 3) as avg_confidence,
    SUM(CASE WHEN both_prompts_agreed = true THEN 1 ELSE 0 END) as agreements,
    SUM(CASE WHEN both_prompts_agreed = false THEN 1 ELSE 0 END) as disagreements,
    CASE 
        WHEN ROUND(100.0 * SUM(CASE WHEN actual = expected THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) >= 90 THEN '✅ EXCELLENT'
        WHEN ROUND(100.0 * SUM(CASE WHEN actual = expected THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) >= 75 THEN '✅ GOOD'
        WHEN ROUND(100.0 * SUM(CASE WHEN actual = expected THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) >= 50 THEN '⚠️  FAIR'
        ELSE '❌ POOR'
    END as grade
FROM comparison;

-- ============================================
-- BACKTEST 3: Stage-by-Stage Accuracy
-- ============================================

WITH test_data AS (
    SELECT 
        te.sender_id,
        te.sender_name,
        CASE 
            WHEN te.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
            WHEN te.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
            WHEN te.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
        END as expected_stage,
        ps.name as actual_stage,
        po.ai_confidence_score
    FROM messenger_conversations te
    LEFT JOIN pipeline_opportunities po ON te.id = po.conversation_id
    LEFT JOIN pipeline_stages ps ON po.stage_id = ps.id
    WHERE te.sender_id LIKE 'TEST_%'
      AND te.user_id = 'YOUR_USER_ID'
)
SELECT 
    '=== PER-STAGE ACCURACY ===' as section,
    expected_stage,
    COUNT(*) as total_expected,
    SUM(CASE WHEN actual_stage = expected_stage THEN 1 ELSE 0 END) as correct,
    ROUND(100.0 * SUM(CASE WHEN actual_stage = expected_stage THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) || '%' as accuracy,
    ROUND(AVG(CASE WHEN actual_stage = expected_stage THEN ai_confidence_score ELSE NULL END), 3) as avg_confidence_when_correct
FROM test_data
WHERE expected_stage IS NOT NULL
GROUP BY expected_stage
ORDER BY expected_stage;

-- ============================================
-- BACKTEST 4: Confidence Distribution
-- ============================================

SELECT 
    '=== CONFIDENCE DISTRIBUTION ===' as section,
    CASE 
        WHEN ai_confidence_score >= 0.9 THEN '0.90-1.00 (Very High)'
        WHEN ai_confidence_score >= 0.8 THEN '0.80-0.89 (High)'
        WHEN ai_confidence_score >= 0.7 THEN '0.70-0.79 (Good)'
        WHEN ai_confidence_score >= 0.5 THEN '0.50-0.69 (Moderate)'
        WHEN ai_confidence_score > 0 THEN '0.01-0.49 (Low)'
        ELSE '0.00 (No Confidence)'
    END as confidence_range,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) || '%' as percentage
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%'
GROUP BY 
    CASE 
        WHEN ai_confidence_score >= 0.9 THEN '0.90-1.00 (Very High)'
        WHEN ai_confidence_score >= 0.8 THEN '0.80-0.89 (High)'
        WHEN ai_confidence_score >= 0.7 THEN '0.70-0.79 (Good)'
        WHEN ai_confidence_score >= 0.5 THEN '0.50-0.69 (Moderate)'
        WHEN ai_confidence_score > 0 THEN '0.01-0.49 (Low)'
        ELSE '0.00 (No Confidence)'
    END
ORDER BY confidence_range DESC;

-- ============================================
-- BACKTEST 5: Agreement vs Disagreement Analysis
-- ============================================

SELECT 
    '=== AGREEMENT ANALYSIS ===' as section,
    CASE WHEN both_prompts_agreed THEN 'Agreed' ELSE 'Disagreed' END as agreement_type,
    COUNT(*) as count,
    ROUND(AVG(ai_confidence_score), 3) as avg_confidence,
    string_agg(sender_name, ', ') as contacts
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%'
  AND both_prompts_agreed IS NOT NULL
GROUP BY both_prompts_agreed
ORDER BY both_prompts_agreed DESC;

-- ============================================
-- BACKTEST 6: Timing Analysis
-- ============================================

SELECT 
    '=== TIMING ANALYSIS ===' as section,
    sender_name,
    EXTRACT(EPOCH FROM (ai_analyzed_at - created_at)) as seconds_to_analyze,
    CASE 
        WHEN EXTRACT(EPOCH FROM (ai_analyzed_at - created_at)) < 3 THEN '✅ Fast'
        WHEN EXTRACT(EPOCH FROM (ai_analyzed_at - created_at)) < 10 THEN '✅ Normal'
        WHEN EXTRACT(EPOCH FROM (ai_analyzed_at - created_at)) < 30 THEN '⚠️  Slow'
        ELSE '❌ Very Slow'
    END as performance
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%'
  AND ai_analyzed_at IS NOT NULL
ORDER BY seconds_to_analyze;

-- ============================================
-- BACKTEST 7: Failure Pattern Analysis
-- ============================================

-- Identify patterns in mis-sorted contacts
WITH issues AS (
    SELECT 
        po.sender_name,
        po.sender_id,
        mc.last_message,
        CASE 
            WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
            WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
            WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
        END as expected_stage,
        ps.name as actual_stage,
        po.ai_analysis_result->'global_analysis'->>'reasoning' as ai_reasoning,
        po.ai_confidence_score,
        po.both_prompts_agreed
    FROM pipeline_opportunities po
    JOIN pipeline_stages ps ON po.stage_id = ps.id
    JOIN messenger_conversations mc ON po.conversation_id = mc.id
    WHERE po.user_id = 'YOUR_USER_ID'
      AND po.sender_id LIKE 'TEST_%'
      AND (
          ps.name != CASE 
              WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
              WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
              WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
          END
          OR ps.is_default = true
      )
)
SELECT 
    '=== FAILURE PATTERNS ===' as section,
    CASE WHEN COUNT(*) = 0 THEN '✅ No failures - all sorted correctly!' ELSE '⚠️  Found ' || COUNT(*) || ' mis-sorted contact(s)' END as status,
    COALESCE(string_agg(sender_name || ': Expected ' || expected_stage || ', Got ' || actual_stage, E'\n'), 'None') as details
FROM issues;

-- Show detailed failure analysis if any
SELECT 
    '=== DETAILED FAILURE ANALYSIS ===' as section,
    po.sender_name,
    mc.last_message as message_content,
    CASE 
        WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
        WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
        WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
    END as expected,
    ps.name as got,
    po.ai_confidence_score,
    po.both_prompts_agreed,
    po.ai_analysis_result->'global_analysis'->>'recommended_stage' as global_rec,
    po.ai_analysis_result->'global_analysis'->>'reasoning' as why_global_chose_this,
    CASE 
        WHEN po.both_prompts_agreed = false THEN 'Stage-specific AI disagreed with global'
        WHEN ps.is_default = true THEN 'Moved to default due to disagreement'
        ELSE 'Unknown reason'
    END as failure_reason
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
JOIN messenger_conversations mc ON po.conversation_id = mc.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'TEST_%'
  AND (
      ps.name != CASE 
          WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
          WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
          WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
      END
      OR ps.is_default = true
  );

-- ============================================
-- BACKTEST 8: Confidence vs Correctness Correlation
-- ============================================

WITH results AS (
    SELECT 
        po.sender_name,
        CASE 
            WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
            WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
            WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
        END as expected,
        ps.name as actual,
        po.ai_confidence_score,
        CASE WHEN ps.name = CASE 
            WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
            WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
            WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
        END THEN true ELSE false END as is_correct
    FROM pipeline_opportunities po
    JOIN pipeline_stages ps ON po.stage_id = ps.id
    WHERE po.user_id = 'YOUR_USER_ID'
      AND po.sender_id LIKE 'TEST_%'
)
SELECT 
    '=== CONFIDENCE CORRELATION ===' as section,
    CASE 
        WHEN ai_confidence_score >= 0.8 THEN 'High (≥0.8)'
        WHEN ai_confidence_score >= 0.7 THEN 'Good (0.7-0.8)'
        WHEN ai_confidence_score >= 0.5 THEN 'Moderate (0.5-0.7)'
        ELSE 'Low (<0.5)'
    END as confidence_level,
    COUNT(*) as total,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
    ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) || '%' as accuracy_at_level
FROM results
GROUP BY confidence_level
ORDER BY MIN(ai_confidence_score) DESC;

-- ============================================
-- BACKTEST 9: Time Series Analysis
-- ============================================

SELECT 
    '=== PROCESSING TIME ANALYSIS ===' as section,
    sender_name,
    ai_analyzed_at - created_at as time_to_analyze,
    EXTRACT(EPOCH FROM (ai_analyzed_at - created_at)) as seconds,
    CASE 
        WHEN EXTRACT(EPOCH FROM (ai_analyzed_at - created_at)) < 5 THEN '✅ Excellent'
        WHEN EXTRACT(EPOCH FROM (ai_analyzed_at - created_at)) < 10 THEN '✅ Good'
        WHEN EXTRACT(EPOCH FROM (ai_analyzed_at - created_at)) < 30 THEN '⚠️  Acceptable'
        ELSE '❌ Too Slow'
    END as performance_rating
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%'
  AND ai_analyzed_at IS NOT NULL
ORDER BY seconds;

-- Average processing time
SELECT 
    '=== AVG PROCESSING TIME ===' as metric,
    ROUND(AVG(EXTRACT(EPOCH FROM (ai_analyzed_at - created_at))), 2) || ' seconds' as average,
    MIN(EXTRACT(EPOCH FROM (ai_analyzed_at - created_at))) || ' seconds' as fastest,
    MAX(EXTRACT(EPOCH FROM (ai_analyzed_at - created_at))) || ' seconds' as slowest,
    CASE 
        WHEN AVG(EXTRACT(EPOCH FROM (ai_analyzed_at - created_at))) < 5 THEN '✅ Excellent performance'
        WHEN AVG(EXTRACT(EPOCH FROM (ai_analyzed_at - created_at))) < 10 THEN '✅ Good performance'
        ELSE '⚠️  Could be faster'
    END as performance_verdict
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%'
  AND ai_analyzed_at IS NOT NULL;

-- ============================================
-- BACKTEST 10: Final Grade
-- ============================================

WITH metrics AS (
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ps.name = CASE 
            WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
            WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
            WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
        END THEN 1 ELSE 0 END) as correct,
        ROUND(AVG(COALESCE(po.ai_confidence_score, 0)), 2) as avg_conf,
        SUM(CASE WHEN po.both_prompts_agreed = true THEN 1 ELSE 0 END) as agreed
    FROM pipeline_opportunities po
    JOIN pipeline_stages ps ON po.stage_id = ps.id
    WHERE po.user_id = 'YOUR_USER_ID'
      AND po.sender_id LIKE 'TEST_%'
)
SELECT 
    '=== FINAL GRADE ===' as section,
    total || ' contacts tested' as test_scope,
    correct || '/' || total || ' correct' as correctness,
    ROUND(100.0 * correct / NULLIF(total, 0), 1) || '%' as accuracy,
    avg_conf || ' avg confidence' as confidence_metric,
    agreed || '/' || total || ' agreements' as agreement_metric,
    CASE 
        WHEN ROUND(100.0 * correct / NULLIF(total, 0), 1) >= 90 AND avg_conf >= 0.8 THEN '🏆 A+ (Excellent)'
        WHEN ROUND(100.0 * correct / NULLIF(total, 0), 1) >= 80 AND avg_conf >= 0.7 THEN '✅ A (Very Good)'
        WHEN ROUND(100.0 * correct / NULLIF(total, 0), 1) >= 70 THEN '✅ B (Good)'
        WHEN ROUND(100.0 * correct / NULLIF(total, 0), 1) >= 50 THEN '⚠️  C (Fair - needs improvement)'
        ELSE '❌ D/F (Poor - requires fixes)'
    END as final_grade,
    CASE 
        WHEN ROUND(100.0 * correct / NULLIF(total, 0), 1) >= 80 THEN '✅ READY FOR PRODUCTION'
        WHEN ROUND(100.0 * correct / NULLIF(total, 0), 1) >= 60 THEN '⚠️  ADJUST PROMPTS, THEN DEPLOY'
        ELSE '❌ FIX ISSUES BEFORE DEPLOYING'
    END as deployment_recommendation
FROM metrics;

-- ============================================
-- RECOMMENDATIONS BASED ON RESULTS
-- ============================================

/*

INTERPRETATION:

Grade A+ (90-100% accuracy, >0.8 confidence):
  ✅ Excellent! Ready for production
  → Clean up test data
  → Start using with real contacts
  → Monitor for edge cases

Grade A/B (70-89% accuracy):
  ✅ Good! Working well with minor issues
  → Review the mis-sorted contacts
  → Adjust prompts for those cases
  → Test again to verify improvement

Grade C (50-69% accuracy):
  ⚠️  Fair - needs prompt adjustment
  → Prompts might be too strict
  → Check disagreement patterns
  → Make stage criteria more general
  → Re-test after changes

Grade D/F (<50% accuracy):
  ❌ Not working correctly
  → Check if AI analysis actually ran
  → Review global vs stage prompt alignment
  → Simplify prompts significantly
  → Start with just 2 stages for testing

SPECIFIC FIXES:

If "New Lead" has low accuracy:
  → Make prompt more inclusive
  → Add more general browsing keywords
  → Lower the criteria bar

If "Qualified" has low accuracy:
  → May be too broad or too narrow
  → Check if overlaps with New Lead or Hot Lead
  → Define clearer boundaries

If "Hot Lead" has low accuracy:
  → Might be too strict (requiring too many signals)
  → Accept any one of: quote request, purchase intent, timeline
  → Don't require all criteria

If All disagreements:
  → Global and stage prompts contradict each other
  → Rewrite to use same language and keywords
  → Ensure consistency in criteria

*/

