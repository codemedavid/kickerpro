-- ============================================
-- CLEANUP TEST DATA
-- Remove test conversations and opportunities
-- Run this after testing is complete
-- Replace 'YOUR_USER_ID' with your actual user ID
-- ============================================

-- ============================================
-- BACKUP: Show what will be deleted
-- ============================================

SELECT 
    'Conversations to be deleted:' as info,
    COUNT(*) as count
FROM messenger_conversations
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%';

SELECT 
    'Opportunities to be deleted:' as info,
    COUNT(*) as count
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%';

-- Show details before deletion
SELECT 
    'Test conversations:' as type,
    sender_id,
    sender_name,
    created_at
FROM messenger_conversations
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%'
ORDER BY created_at;

SELECT 
    'Test opportunities:' as type,
    po.sender_id,
    po.sender_name,
    ps.name as stage,
    po.ai_confidence_score,
    po.both_prompts_agreed
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'TEST_%'
ORDER BY po.created_at;

-- ============================================
-- CLEANUP: Delete test data
-- ============================================

-- Delete test opportunities first (foreign key)
DELETE FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%';

-- Delete test conversations
DELETE FROM messenger_conversations
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%';

-- ============================================
-- VERIFY: Confirm deletion
-- ============================================

SELECT 
    'Cleanup complete!' as status,
    (SELECT COUNT(*) FROM messenger_conversations WHERE user_id = 'YOUR_USER_ID' AND sender_id LIKE 'TEST_%') as remaining_conversations,
    (SELECT COUNT(*) FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID' AND sender_id LIKE 'TEST_%') as remaining_opportunities;

-- ============================================
-- OPTIONAL: Keep test stages for reference
-- ============================================

-- Test stages are NOT deleted by default
-- They remain configured for future testing
-- If you want to remove them too, uncomment:

/*
DELETE FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID'
  AND name IN ('New Lead', 'Qualified', 'Hot Lead')
  AND created_at > NOW() - INTERVAL '1 day';
*/

-- ============================================
-- OPTIONAL: Reset pipeline settings
-- ============================================

-- Pipeline settings are NOT deleted by default
-- If you want to remove test settings, uncomment:

/*
DELETE FROM pipeline_settings
WHERE user_id = 'YOUR_USER_ID';
*/
