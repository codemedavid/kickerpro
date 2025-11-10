-- ============================================
-- VALIDATE TEST RESULTS
-- Run after analysis to check if contacts sorted correctly
-- Replace 'YOUR_USER_ID' with your actual user ID
-- ============================================

-- View results with expected vs actual stages
SELECT 
    po.sender_name,
    po.sender_id,
    CASE 
        WHEN po.sender_id = 'TEST_PSID_001_EARLY_BROWSER' THEN 'New Lead'
        WHEN po.sender_id = 'TEST_PSID_002_INTERESTED' THEN 'Qualified'
        WHEN po.sender_id = 'TEST_PSID_003_READY_TO_BUY' THEN 'Hot Lead'
        WHEN po.sender_id = 'TEST_PSID_004_BULK_ORDER' THEN 'Hot Lead'
        WHEN po.sender_id = 'TEST_PSID_005_GENERAL' THEN 'New Lead'
        WHEN po.sender_id = 'TEST_PSID_006_COMPARING' THEN 'Qualified'
        ELSE 'Unknown'
    END as expected_stage,
    ps.name as actual_stage,
    CASE 
        WHEN ps.name = CASE 
            WHEN po.sender_id = 'TEST_PSID_001_EARLY_BROWSER' THEN 'New Lead'
            WHEN po.sender_id = 'TEST_PSID_002_INTERESTED' THEN 'Qualified'
            WHEN po.sender_id = 'TEST_PSID_003_READY_TO_BUY' THEN 'Hot Lead'
            WHEN po.sender_id = 'TEST_PSID_004_BULK_ORDER' THEN 'Hot Lead'
            WHEN po.sender_id = 'TEST_PSID_005_GENERAL' THEN 'New Lead'
            WHEN po.sender_id = 'TEST_PSID_006_COMPARING' THEN 'Qualified'
        END THEN '✅ CORRECT'
        ELSE '❌ WRONG'
    END as result,
    po.ai_confidence_score as confidence,
    po.both_prompts_agreed as agreed,
    CASE 
        WHEN po.ai_analyzed_at IS NULL THEN '❌ NOT ANALYZED'
        WHEN po.both_prompts_agreed = true THEN '✅ HIGH CONFIDENCE'
        WHEN po.both_prompts_agreed = false THEN '⚠️  UNCERTAIN'
        ELSE '❓ UNKNOWN'
    END as status,
    po.ai_analyzed_at
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'TEST_%'
ORDER BY po.sender_id;

-- Show AI reasoning for each contact
SELECT 
    po.sender_name,
    ps.name as assigned_stage,
    po.ai_analysis_result->'global_analysis'->>'recommended_stage' as ai_recommended,
    po.ai_analysis_result->'global_analysis'->>'reasoning' as ai_reasoning,
    po.ai_analysis_result->'global_analysis'->>'confidence' as global_confidence,
    po.ai_confidence_score as final_confidence
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'TEST_%'
  AND po.ai_analysis_result IS NOT NULL
ORDER BY po.sender_id;

-- Summary statistics
SELECT 
    'TEST SUMMARY' as report,
    COUNT(*) as total_test_contacts,
    COUNT(CASE WHEN ai_analyzed_at IS NOT NULL THEN 1 END) as analyzed,
    COUNT(CASE WHEN both_prompts_agreed = true THEN 1 END) as high_confidence,
    COUNT(CASE WHEN both_prompts_agreed = false THEN 1 END) as uncertain,
    ROUND(AVG(CASE WHEN ai_confidence_score IS NOT NULL THEN ai_confidence_score ELSE 0 END), 2) as avg_confidence,
    COUNT(CASE 
        WHEN ps.name = CASE 
            WHEN po.sender_id = 'TEST_PSID_001_EARLY_BROWSER' THEN 'New Lead'
            WHEN po.sender_id = 'TEST_PSID_002_INTERESTED' THEN 'Qualified'
            WHEN po.sender_id = 'TEST_PSID_003_READY_TO_BUY' THEN 'Hot Lead'
            WHEN po.sender_id = 'TEST_PSID_004_BULK_ORDER' THEN 'Hot Lead'
            WHEN po.sender_id = 'TEST_PSID_005_GENERAL' THEN 'New Lead'
            WHEN po.sender_id = 'TEST_PSID_006_COMPARING' THEN 'Qualified'
        END THEN 1 
    END) as correctly_sorted,
    ROUND(
        (COUNT(CASE 
            WHEN ps.name = CASE 
                WHEN po.sender_id = 'TEST_PSID_001_EARLY_BROWSER' THEN 'New Lead'
                WHEN po.sender_id = 'TEST_PSID_002_INTERESTED' THEN 'Qualified'
                WHEN po.sender_id = 'TEST_PSID_003_READY_TO_BUY' THEN 'Hot Lead'
                WHEN po.sender_id = 'TEST_PSID_004_BULK_ORDER' THEN 'Hot Lead'
                WHEN po.sender_id = 'TEST_PSID_005_GENERAL' THEN 'New Lead'
                WHEN po.sender_id = 'TEST_PSID_006_COMPARING' THEN 'Qualified'
            END THEN 1 
        END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
        1
    ) as accuracy_percentage
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'TEST_%';
