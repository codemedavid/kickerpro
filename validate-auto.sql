-- ============================================
-- AUTO VALIDATE: Pipeline Sorting Results
-- Automatically uses current user - NO MANUAL REPLACEMENT NEEDED
-- ============================================

-- Get current user automatically
DO $$
DECLARE
    v_user_id UUID;
    v_total INT;
    v_correct INT;
    v_accuracy NUMERIC;
BEGIN
    -- Get user_id
    SELECT COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1))
    INTO v_user_id;
    
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE '  PIPELINE SORTING VALIDATION';
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE '';
    
    -- Check if any test contacts in pipeline
    SELECT COUNT(*) INTO v_total
    FROM pipeline_opportunities
    WHERE user_id = v_user_id AND sender_id LIKE 'TEST_%';
    
    IF v_total = 0 THEN
        RAISE NOTICE '❌ No test contacts in pipeline yet';
        RAISE NOTICE '';
        RAISE NOTICE '📋 Next steps:';
        RAISE NOTICE '1. Run: setup-pipeline-auto.sql';
        RAISE NOTICE '2. Go to Conversations page';
        RAISE NOTICE '3. Select TEST_ contacts';
        RAISE NOTICE '4. Click "Add to Pipeline"';
        RAISE NOTICE '5. Run this script again';
        RETURN;
    END IF;
    
    -- Calculate accuracy
    WITH expected AS (
        SELECT sender_id,
            CASE 
                WHEN sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
                WHEN sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
                WHEN sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
            END as expected_stage
        FROM messenger_conversations
        WHERE user_id = v_user_id AND sender_id LIKE 'TEST_%'
    ),
    actual AS (
        SELECT po.sender_id, ps.name as actual_stage, ps.is_default,
               po.ai_confidence_score, po.both_prompts_agreed
        FROM pipeline_opportunities po
        JOIN pipeline_stages ps ON po.stage_id = ps.id
        WHERE po.user_id = v_user_id AND po.sender_id LIKE 'TEST_%'
    )
    SELECT 
        COUNT(*),
        SUM(CASE WHEN a.actual_stage = e.expected_stage THEN 1 ELSE 0 END)
    INTO v_total, v_correct
    FROM expected e
    JOIN actual a ON e.sender_id = a.sender_id;
    
    v_accuracy := ROUND(100.0 * v_correct / NULLIF(v_total, 0), 1);
    
    RAISE NOTICE '📊 RESULTS:';
    RAISE NOTICE '  Total tested: %', v_total;
    RAISE NOTICE '  Correct: %', v_correct;
    RAISE NOTICE '  Accuracy: %%', v_accuracy;
    RAISE NOTICE '';
    
    IF v_accuracy >= 80 THEN
        RAISE NOTICE '✅ EXCELLENT! Accuracy > 80%%';
        RAISE NOTICE '✅ Ready for production!';
    ELSIF v_accuracy >= 60 THEN
        RAISE NOTICE '⚠️  GOOD but could be better (60-80%%)';
        RAISE NOTICE '   Review mis-sorted contacts and adjust prompts';
    ELSE
        RAISE NOTICE '❌ LOW accuracy (<60%%)';
        RAISE NOTICE '   Check if AI analysis ran';
        RAISE NOTICE '   Review prompts - might be too strict';
    END IF;
    
    RAISE NOTICE '';
    
END $$;

-- ============================================
-- DETAILED RESULTS
-- ============================================

WITH v_user AS (
    SELECT COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)) as uid
),
expected AS (
    SELECT 
        mc.sender_id,
        mc.sender_name,
        CASE 
            WHEN mc.sender_id IN ('TEST_BROWSE_001', 'TEST_BROWSE_002') THEN 'New Lead'
            WHEN mc.sender_id IN ('TEST_QUALIFIED_001', 'TEST_QUALIFIED_002') THEN 'Qualified'
            WHEN mc.sender_id IN ('TEST_HOT_001', 'TEST_HOT_002') THEN 'Hot Lead'
        END as expected_stage
    FROM messenger_conversations mc, v_user
    WHERE mc.user_id = v_user.uid AND mc.sender_id LIKE 'TEST_%'
),
actual AS (
    SELECT 
        po.sender_id,
        po.sender_name,
        ps.name as actual_stage,
        ps.is_default,
        po.ai_confidence_score,
        po.both_prompts_agreed
    FROM pipeline_opportunities po
    JOIN pipeline_stages ps ON po.stage_id = ps.id
    CROSS JOIN v_user
    WHERE po.user_id = v_user.uid AND po.sender_id LIKE 'TEST_%'
)
SELECT 
    e.sender_name as contact,
    e.expected_stage as expected,
    COALESCE(a.actual_stage, 'NOT ADDED') as actual,
    CASE 
        WHEN a.actual_stage = e.expected_stage THEN '✅ CORRECT'
        WHEN a.is_default = true THEN '⚠️  DEFAULT'
        WHEN a.actual_stage IS NULL THEN '❌ NOT ADDED'
        ELSE '❌ WRONG'
    END as result,
    a.ai_confidence_score as confidence,
    a.both_prompts_agreed as agreed
FROM expected e
LEFT JOIN actual a ON e.sender_id = a.sender_id
ORDER BY e.sender_name;

