-- ============================================
-- CREATE TEST CONVERSATIONS FOR PIPELINE SORTING
-- This creates 6 test contacts with different conversation profiles
-- Run this in Supabase SQL Editor
-- ============================================

-- INSTRUCTIONS:
-- 1. Get your user ID: SELECT id FROM auth.users WHERE email = 'your-email';
-- 2. Get a page ID: SELECT id, facebook_page_id FROM facebook_pages WHERE user_id = 'YOUR_USER_ID' LIMIT 1;
-- 3. Replace 'YOUR_USER_ID' and 'YOUR_PAGE_ID' below
-- 4. Run this script

-- ============================================
-- CLEANUP: Remove old test data
-- ============================================

DELETE FROM pipeline_opportunities 
WHERE user_id = 'YOUR_USER_ID' 
  AND sender_id LIKE 'TEST_%';

DELETE FROM messenger_conversations 
WHERE user_id = 'YOUR_USER_ID' 
  AND sender_id LIKE 'TEST_%';

-- ============================================
-- TEST CONTACTS: 6 Different Profiles
-- ============================================

-- Test Contact 1: Early Browser (Should → New Lead)
INSERT INTO messenger_conversations (
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active
) VALUES (
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_PSID_001_EARLY_BROWSER',
    'Test User 1 - Early Browser',
    'Hi there! Just browsing and curious about what products you offer. Can you tell me more about your business?',
    NOW() - INTERVAL '2 hours',
    'active',
    1,
    true
);

-- Test Contact 2: Interested Shopper (Should → Qualified)
INSERT INTO messenger_conversations (
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active
) VALUES (
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_PSID_002_INTERESTED',
    'Test User 2 - Interested Shopper',
    'Hi! I''m interested in your premium package. How much does it cost and what features are included? I need this for my business.',
    NOW() - INTERVAL '1 hour',
    'active',
    3,
    true
);

-- Test Contact 3: Ready to Buy (Should → Hot Lead)
INSERT INTO messenger_conversations (
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active
) VALUES (
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_PSID_003_READY_TO_BUY',
    'Test User 3 - Ready Buyer',
    'I''m ready to purchase! Can you send me a quote for 50 units? I need them delivered by next Friday. What payment methods do you accept?',
    NOW() - INTERVAL '30 minutes',
    'active',
    5,
    true
);

-- Test Contact 4: Bulk Order Inquiry (Should → Hot Lead)
INSERT INTO messenger_conversations (
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active
) VALUES (
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_PSID_004_BULK_ORDER',
    'Test User 4 - Bulk Buyer',
    'Need 100 units ASAP for my company. What''s your best price for bulk orders? Can you deliver this week?',
    NOW() - INTERVAL '45 minutes',
    'active',
    4,
    true
);

-- Test Contact 5: General Inquiry (Should → New Lead)
INSERT INTO messenger_conversations (
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active
) VALUES (
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_PSID_005_GENERAL',
    'Test User 5 - General Inquiry',
    'Hello, I saw your page and wanted to know what kind of products you have. Just exploring my options for now.',
    NOW() - INTERVAL '3 hours',
    'active',
    2,
    true
);

-- Test Contact 6: Price Comparison (Should → Qualified)
INSERT INTO messenger_conversations (
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active
) VALUES (
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_PSID_006_COMPARING',
    'Test User 6 - Price Shopper',
    'I''m comparing prices from different suppliers. What''s your price for the standard package? Also, what''s included in the warranty?',
    NOW() - INTERVAL '90 minutes',
    'active',
    3,
    true
);

-- ============================================
-- VERIFY TEST DATA CREATED
-- ============================================

SELECT 
    'Test Conversations Created' as status,
    COUNT(*) as total_test_contacts,
    STRING_AGG(sender_name, ', ') as contact_names
FROM messenger_conversations
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%';

-- Show test contacts with expected stages
SELECT 
    sender_id,
    sender_name,
    SUBSTRING(last_message, 1, 60) as message_preview,
    CASE 
        WHEN sender_id = 'TEST_PSID_001_EARLY_BROWSER' THEN 'New Lead'
        WHEN sender_id = 'TEST_PSID_002_INTERESTED' THEN 'Qualified'
        WHEN sender_id = 'TEST_PSID_003_READY_TO_BUY' THEN 'Hot Lead'
        WHEN sender_id = 'TEST_PSID_004_BULK_ORDER' THEN 'Hot Lead'
        WHEN sender_id = 'TEST_PSID_005_GENERAL' THEN 'New Lead'
        WHEN sender_id = 'TEST_PSID_006_COMPARING' THEN 'Qualified'
    END as expected_stage
FROM messenger_conversations
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'TEST_%'
ORDER BY sender_id;

-- ============================================
-- NEXT STEPS
-- ============================================

-- After running this script:
-- 1. Note the conversation IDs for the test contacts
-- 2. Use the Node.js test script to add them to pipeline
-- 3. Verify they get sorted to expected stages
-- 4. Review AI reasoning for each assignment
