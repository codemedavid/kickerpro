-- ============================================
-- PIPELINE SORTING METRICS AND ANALYTICS
-- Comprehensive analysis of sorting performance
-- Replace 'YOUR_USER_ID' with your actual user ID
-- ============================================

-- ============================================
-- METRIC 1: Overall Performance
-- ============================================

SELECT 
    '=== OVERALL PERFORMANCE ===' as metric_type,
    COUNT(*) as total_contacts,
    COUNT(CASE WHEN ai_analyzed_at IS NOT NULL THEN 1 END) as analyzed_count,
    ROUND(
        (COUNT(CASE WHEN ai_analyzed_at IS NOT NULL THEN 1 END)::NUMERIC / 
         NULLIF(COUNT(*), 0)::NUMERIC) * 100, 
        1
    ) as analysis_rate_percentage,
    COUNT(CASE WHEN both_prompts_agreed = true THEN 1 END) as high_confidence,
    COUNT(CASE WHEN both_prompts_agreed = false THEN 1 END) as uncertain,
    COUNT(CASE WHEN both_prompts_agreed IS NULL THEN 1 END) as not_analyzed,
    ROUND(AVG(CASE WHEN ai_confidence_score IS NOT NULL THEN ai_confidence_score ELSE 0 END), 3) as avg_confidence
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID';

-- ============================================
-- METRIC 2: Stage Distribution
-- ============================================

SELECT 
    '=== STAGE DISTRIBUTION ===' as metric_type,
    ps.name as stage_name,
    COUNT(*) as contact_count,
    ROUND(
        (COUNT(*)::NUMERIC / 
         (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID')::NUMERIC) * 100,
        1
    ) as percentage,
    ps.is_default,
    COUNT(CASE WHEN po.both_prompts_agreed = true THEN 1 END) as high_confidence_in_stage,
    ROUND(AVG(po.ai_confidence_score), 2) as avg_confidence_in_stage
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
GROUP BY ps.id, ps.name, ps.is_default
ORDER BY contact_count DESC;

-- ============================================
-- METRIC 3: Confidence Score Distribution
-- ============================================

SELECT 
    '=== CONFIDENCE DISTRIBUTION ===' as metric_type,
    CASE 
        WHEN ai_confidence_score >= 0.9 THEN '0.90-1.00 (Very High)'
        WHEN ai_confidence_score >= 0.8 THEN '0.80-0.89 (High)'
        WHEN ai_confidence_score >= 0.7 THEN '0.70-0.79 (Good)'
        WHEN ai_confidence_score >= 0.5 THEN '0.50-0.69 (Medium)'
        WHEN ai_confidence_score > 0 THEN '0.01-0.49 (Low)'
        ELSE '0.00 (Uncertain/Unmatched)'
    END as confidence_range,
    COUNT(*) as contact_count,
    ROUND(
        (COUNT(*)::NUMERIC / 
         (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID')::NUMERIC) * 100,
        1
    ) as percentage
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
GROUP BY confidence_range
ORDER BY MIN(COALESCE(ai_confidence_score, 0)) DESC;

-- ============================================
-- METRIC 4: Agreement Rate Analysis
-- ============================================

SELECT 
    '=== AGREEMENT ANALYSIS ===' as metric_type,
    CASE 
        WHEN both_prompts_agreed = true THEN '✅ Agreed'
        WHEN both_prompts_agreed = false THEN '⚠️  Disagreed'
        ELSE '❌ Not Analyzed'
    END as agreement_status,
    COUNT(*) as count,
    ROUND(
        (COUNT(*)::NUMERIC / 
         (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID')::NUMERIC) * 100,
        1
    ) as percentage
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
GROUP BY both_prompts_agreed
ORDER BY both_prompts_agreed DESC NULLS LAST;

-- ============================================
-- METRIC 5: Time-Based Analysis
-- ============================================

SELECT 
    '=== ANALYSIS BY TIME ===' as metric_type,
    DATE(created_at) as date,
    COUNT(*) as contacts_added,
    COUNT(CASE WHEN ai_analyzed_at IS NOT NULL THEN 1 END) as analyzed,
    COUNT(CASE WHEN both_prompts_agreed = true THEN 1 END) as high_confidence,
    ROUND(AVG(ai_confidence_score), 2) as avg_confidence
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- METRIC 6: Detailed Performance by Stage
-- ============================================

SELECT 
    '=== PERFORMANCE BY STAGE ===' as metric_type,
    ps.name as stage_name,
    COUNT(*) as total_in_stage,
    COUNT(CASE WHEN po.manually_assigned = false THEN 1 END) as ai_assigned,
    COUNT(CASE WHEN po.manually_assigned = true THEN 1 END) as manual_assigned,
    COUNT(CASE WHEN po.both_prompts_agreed = true THEN 1 END) as high_confidence,
    ROUND(AVG(po.ai_confidence_score), 3) as avg_confidence,
    MIN(po.ai_confidence_score) as min_confidence,
    MAX(po.ai_confidence_score) as max_confidence
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
GROUP BY ps.id, ps.name
ORDER BY total_in_stage DESC;

-- ============================================
-- METRIC 7: Problem Areas
-- ============================================

SELECT 
    '=== PROBLEM AREAS ===' as metric_type,
    issue_type,
    contact_count,
    percentage
FROM (
    SELECT 
        'Not Analyzed' as issue_type,
        COUNT(*) as contact_count,
        ROUND((COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID')::NUMERIC) * 100, 1) as percentage
    FROM pipeline_opportunities
    WHERE user_id = 'YOUR_USER_ID'
      AND ai_analyzed_at IS NULL
    
    UNION ALL
    
    SELECT 
        'Low Confidence (< 0.5)' as issue_type,
        COUNT(*) as contact_count,
        ROUND((COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID')::NUMERIC) * 100, 1) as percentage
    FROM pipeline_opportunities
    WHERE user_id = 'YOUR_USER_ID'
      AND ai_confidence_score < 0.5
    
    UNION ALL
    
    SELECT 
        'Disagreement (Unmatched)' as issue_type,
        COUNT(*) as contact_count,
        ROUND((COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID')::NUMERIC) * 100, 1) as percentage
    FROM pipeline_opportunities
    WHERE user_id = 'YOUR_USER_ID'
      AND both_prompts_agreed = false
    
    UNION ALL
    
    SELECT 
        'In Default Stage' as issue_type,
        COUNT(*) as contact_count,
        ROUND((COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID')::NUMERIC) * 100, 1) as percentage
    FROM pipeline_opportunities po
    JOIN pipeline_stages ps ON po.stage_id = ps.id
    WHERE po.user_id = 'YOUR_USER_ID'
      AND ps.is_default = true
) issues
WHERE contact_count > 0
ORDER BY contact_count DESC;

-- ============================================
-- METRIC 8: Recent Performance Trend
-- ============================================

SELECT 
    '=== RECENT TREND (Last 24 hours) ===' as metric_type,
    COUNT(*) as contacts_added,
    COUNT(CASE WHEN ai_analyzed_at IS NOT NULL THEN 1 END) as analyzed,
    COUNT(CASE WHEN both_prompts_agreed = true THEN 1 END) as high_confidence,
    ROUND(AVG(ai_confidence_score), 2) as avg_confidence,
    COUNT(CASE 
        WHEN ps.is_default = false AND both_prompts_agreed = true 
        THEN 1 
    END) as successfully_sorted
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.created_at > NOW() - INTERVAL '24 hours';

-- ============================================
-- SUMMARY SCORECARD
-- ============================================

WITH metrics AS (
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN ai_analyzed_at IS NOT NULL THEN 1 END) as analyzed,
        COUNT(CASE WHEN both_prompts_agreed = true THEN 1 END) as agreed,
        COUNT(CASE WHEN ai_confidence_score >= 0.8 THEN 1 END) as high_conf
    FROM pipeline_opportunities
    WHERE user_id = 'YOUR_USER_ID'
)
SELECT 
    '=== SYSTEM SCORECARD ===' as scorecard,
    CASE 
        WHEN (analyzed::NUMERIC / NULLIF(total, 0)::NUMERIC) >= 0.95 THEN '✅ A+'
        WHEN (analyzed::NUMERIC / NULLIF(total, 0)::NUMERIC) >= 0.85 THEN '✅ A'
        WHEN (analyzed::NUMERIC / NULLIF(total, 0)::NUMERIC) >= 0.75 THEN '✅ B+'
        WHEN (analyzed::NUMERIC / NULLIF(total, 0)::NUMERIC) >= 0.65 THEN '⚠️  B'
        ELSE '❌ C or below'
    END as analysis_coverage_grade,
    CASE 
        WHEN (agreed::NUMERIC / NULLIF(analyzed, 0)::NUMERIC) >= 0.90 THEN '✅ A+'
        WHEN (agreed::NUMERIC / NULLIF(analyzed, 0)::NUMERIC) >= 0.80 THEN '✅ A'
        WHEN (agreed::NUMERIC / NULLIF(analyzed, 0)::NUMERIC) >= 0.70 THEN '✅ B+'
        WHEN (agreed::NUMERIC / NULLIF(analyzed, 0)::NUMERIC) >= 0.60 THEN '⚠️  B'
        ELSE '❌ C or below'
    END as agreement_rate_grade,
    CASE 
        WHEN (high_conf::NUMERIC / NULLIF(total, 0)::NUMERIC) >= 0.80 THEN '✅ A+'
        WHEN (high_conf::NUMERIC / NULLIF(total, 0)::NUMERIC) >= 0.70 THEN '✅ A'
        WHEN (high_conf::NUMERIC / NULLIF(total, 0)::NUMERIC) >= 0.60 THEN '✅ B+'
        WHEN (high_conf::NUMERIC / NULLIF(total, 0)::NUMERIC) >= 0.50 THEN '⚠️  B'
        ELSE '❌ C or below'
    END as confidence_grade,
    total as total_contacts,
    analyzed as analyzed_contacts,
    agreed as agreed_assignments,
    high_conf as high_confidence_count
FROM metrics;
