-- ============================================
-- CLEANUP: Remove Test Data
-- Run this after testing is complete
-- ============================================
-- Replace 'YOUR_USER_ID' with your actual user_id
-- ============================================

-- ============================================
-- BEFORE CLEANUP: Save Test Results
-- ============================================

-- First, let's save the test results for reference
SELECT 
    '=== SAVING TEST RESULTS BEFORE CLEANUP ===' as note,
    po.sender_name,
    ps.name as final_stage,
    po.ai_confidence_score,
    po.both_prompts_agreed,
    po.ai_analyzed_at,
    CASE 
        WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
        WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
        WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
    END as expected_stage,
    CASE 
        WHEN ps.name = CASE 
            WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
            WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
            WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
        END THEN '✅ CORRECT'
        WHEN ps.is_default THEN '⚠️  DEFAULT'
        ELSE '❌ WRONG'
    END as result
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'TEST_%'
ORDER BY po.sender_name;

-- Save summary metrics
SELECT 
    '=== FINAL TEST METRICS ===' as summary,
    COUNT(*) as total_tested,
    SUM(CASE WHEN ps.name = CASE 
        WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
        WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
        WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
    END THEN 1 ELSE 0 END) as correct,
    ROUND(100.0 * SUM(CASE WHEN ps.name = CASE 
        WHEN po.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
        WHEN po.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
        WHEN po.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
    END THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) || '%' as accuracy,
    ROUND(AVG(po.ai_confidence_score), 3) as avg_confidence
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'TEST_%';

-- ============================================
-- CLEANUP: Delete Test Data
-- ============================================

-- Step 1: Delete stage history for test opportunities
DELETE FROM pipeline_stage_history 
WHERE opportunity_id IN (
    SELECT id FROM pipeline_opportunities 
    WHERE user_id = 'YOUR_USER_ID'
      AND sender_id LIKE 'TEST_%'
);

-- Verify deletion
SELECT 
    '✅ Deleted ' || ROW_COUNT() || ' stage history records' as step_1;

-- Step 2: Delete test opportunities
DELETE FROM pipeline_opportunities 
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%';

-- Verify deletion
SELECT 
    '✅ Deleted test opportunities' as step_2,
    COUNT(*) as remaining_test_opps
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%';

-- Step 3: Delete test conversations
DELETE FROM messenger_conversations 
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%';

-- Verify deletion
SELECT 
    '✅ Deleted test conversations' as step_3,
    COUNT(*) as remaining_test_convs
FROM messenger_conversations
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%';

-- ============================================
-- OPTIONAL: Keep or Remove Test Stages
-- ============================================

-- If you want to keep the test stages for future testing:
-- Just leave them as is

-- If you want to remove them and start fresh:
/*
DELETE FROM pipeline_stages 
WHERE user_id = 'YOUR_USER_ID'
  AND name IN ('New Lead', 'Qualified', 'Hot Lead');
*/

-- If you want to remove test settings:
/*
DELETE FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID';
*/

-- ============================================
-- VERIFY CLEANUP
-- ============================================

SELECT 
    '=== CLEANUP VERIFICATION ===' as section,
    (SELECT COUNT(*) FROM messenger_conversations WHERE user_id = 'YOUR_USER_ID' AND sender_id LIKE 'TEST_%') as test_conversations_remaining,
    (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID' AND sender_id LIKE 'TEST_%') as test_opportunities_remaining,
    (SELECT COUNT(*) FROM pipeline_stage_history WHERE opportunity_id IN (SELECT id FROM pipeline_opportunities WHERE sender_id LIKE 'TEST_%')) as test_history_remaining,
    CASE 
        WHEN (SELECT COUNT(*) FROM messenger_conversations WHERE user_id = 'YOUR_USER_ID' AND sender_id LIKE 'TEST_%') = 0
         AND (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID' AND sender_id LIKE 'TEST_%') = 0
        THEN '✅ All test data cleaned up'
        ELSE '⚠️  Some test data remains'
    END as cleanup_status;

-- ============================================
-- NOTES
-- ============================================

/*

WHAT WAS DELETED:
- Test conversations (sender_id LIKE 'TEST_%')
- Test pipeline opportunities
- Test stage history records

WHAT WAS KEPT:
- Pipeline stages (New Lead, Qualified, Hot Lead, Unmatched)
- Pipeline settings (global_analysis_prompt)
- Real conversations and opportunities

WHY KEEP STAGES AND SETTINGS:
- These are properly configured now
- Ready for production use with real contacts
- No need to reconfigure

TO START FRESH COMPLETELY:
- Uncomment the DELETE statements for stages and settings
- Run again
- Will need to reconfigure from scratch

*/
