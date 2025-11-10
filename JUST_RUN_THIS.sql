-- ============================================
-- JUST RUN THIS - Super Simple Setup
-- ============================================
-- BEFORE RUNNING:
-- 1. Run this query to get your user_id:
--    SELECT id FROM auth.users LIMIT 1;
-- 
-- 2. Copy the id (looks like: a1b2c3d4-e5f6-1234...)
-- 
-- 3. In this file below, put your cursor on line 19
-- 4. Replace the text YOUR_USER_ID_HERE with your actual id
-- 5. Do the same on line 24 (get page_id from: SELECT id FROM facebook_pages LIMIT 1;)
-- 6. Then run this entire file
-- ============================================

-- 🔽 EDIT THIS LINE - Replace YOUR_USER_ID_HERE with your actual user_id:
DO $$ 
DECLARE 
    v_user_id uuid := 'YOUR_USER_ID_HERE';  
    -- 🔽 EDIT THIS LINE - Replace YOUR_PAGE_ID_HERE with your actual page_id:
    v_page_id uuid := 'YOUR_PAGE_ID_HERE';
BEGIN

-- Clean old data
DELETE FROM pipeline_settings WHERE user_id = v_user_id;
DELETE FROM pipeline_stages WHERE user_id = v_user_id AND name IN ('New Lead', 'Qualified', 'Hot Lead');
DELETE FROM messenger_conversations WHERE user_id = v_user_id AND sender_id LIKE 'TEST_%';

-- Create settings
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES (v_user_id, 'Analyze contact for stage. NEW LEAD: browsing. QUALIFIED: pricing questions. HOT LEAD: ready to buy.', true);

RAISE NOTICE 'Created pipeline settings';

-- Create stages
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES 
    (v_user_id, 'New Lead', 'Browsing', '#3b82f6', 'New Lead if browsing or first message.', false, true, 0),
    (v_user_id, 'Qualified', 'Interested', '#22c55e', 'Qualified if pricing questions.', false, true, 1),
    (v_user_id, 'Hot Lead', 'Buying', '#ef4444', 'Hot Lead if ready to buy.', false, true, 2);

RAISE NOTICE 'Created 3 pipeline stages';

-- Create test contacts
INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active, created_at, updated_at)
VALUES 
    (v_user_id, v_page_id, 'TEST_BROWSE_001', 'John Browser', 'Hi curious about products', NOW(), 'active', 1, true, NOW(), NOW()),
    (v_user_id, v_page_id, 'TEST_QUALIFIED_001', 'Maria Interested', 'How much is premium?', NOW(), 'active', 3, true, NOW(), NOW()),
    (v_user_id, v_page_id, 'TEST_HOT_001', 'Carlos Buyer', 'Want to order 50 units', NOW(), 'active', 5, true, NOW(), NOW());

RAISE NOTICE 'Created 3 test contacts';
RAISE NOTICE 'SETUP COMPLETE! Go test in your app now.';

END $$;

-- Verify
SELECT 'Check Results:' as step;
SELECT 'Settings' as type, COUNT(*) FROM pipeline_settings;
SELECT 'Stages' as type, name FROM pipeline_stages ORDER BY position LIMIT 10;
SELECT 'Tests' as type, sender_name FROM messenger_conversations WHERE sender_id LIKE 'TEST_%' LIMIT 10;

