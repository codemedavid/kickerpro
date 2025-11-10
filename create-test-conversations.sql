-- ============================================
-- CREATE TEST DATA: Pipeline Sorting Test Conversations
-- ============================================
-- INSTRUCTIONS:
-- 1. First run: setup-pipeline-for-testing.sql
-- 2. Replace 'YOUR_USER_ID' with your actual user_id
-- 3. Replace 'YOUR_PAGE_ID' with your actual facebook page_id
-- 4. Run this entire script in Supabase SQL Editor
-- ============================================

-- Get your user_id and page_id:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
-- SELECT id, facebook_page_id, name FROM facebook_pages WHERE user_id = 'YOUR_USER_ID' LIMIT 1;

-- ============================================
-- CLEAN UP OLD TEST DATA (if re-running)
-- ============================================

-- Remove old test data
DELETE FROM pipeline_stage_history WHERE opportunity_id IN 
  (SELECT id FROM pipeline_opportunities WHERE sender_id LIKE 'TEST_%');
DELETE FROM pipeline_opportunities WHERE sender_id LIKE 'TEST_%';
DELETE FROM messenger_conversations WHERE sender_id LIKE 'TEST_%';

-- ============================================
-- TEST CONVERSATION 1: Just Browsing (→ New Lead)
-- ============================================

INSERT INTO messenger_conversations (
    id,
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_BROWSE_001',
    'John Browser',
    'Hi, just curious about what products you offer. Can you tell me more about your business?',
    NOW() - INTERVAL '2 hours',
    'active',
    1,
    true,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
);

-- ============================================
-- TEST CONVERSATION 2: Asking About Pricing (→ Qualified)
-- ============================================

INSERT INTO messenger_conversations (
    id,
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_QUALIFIED_001',
    'Maria Interested',
    'How much is your premium package? I need this for my business and want to know the pricing details.',
    NOW() - INTERVAL '1 hour',
    'active',
    3,
    true,
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '1 hour'
);

-- ============================================
-- TEST CONVERSATION 3: Ready to Buy (→ Hot Lead)
-- ============================================

INSERT INTO messenger_conversations (
    id,
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_HOT_001',
    'Carlos Buyer',
    'I want to order 50 units. Can you send me a quote today? I need them by next week.',
    NOW() - INTERVAL '30 minutes',
    'active',
    5,
    true,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '30 minutes'
);

-- ============================================
-- TEST CONVERSATION 4: Bulk Order Inquiry (→ Hot Lead)
-- ============================================

INSERT INTO messenger_conversations (
    id,
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_HOT_002',
    'Sarah Urgent',
    'Need 100 units ASAP! Ready to purchase if price is right. What is your best deal for bulk orders?',
    NOW() - INTERVAL '15 minutes',
    'active',
    2,
    true,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '15 minutes'
);

-- ============================================
-- TEST CONVERSATION 5: Product Info Request (→ New Lead)
-- ============================================

INSERT INTO messenger_conversations (
    id,
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_BROWSE_002',
    'Lisa Explorer',
    'Hello! I saw your page and wanted to learn more about your products and services. What do you specialize in?',
    NOW() - INTERVAL '45 minutes',
    'active',
    1,
    true,
    NOW() - INTERVAL '45 minutes',
    NOW() - INTERVAL '45 minutes'
);

-- ============================================
-- TEST CONVERSATION 6: Comparison Shopping (→ Qualified)
-- ============================================

INSERT INTO messenger_conversations (
    id,
    user_id,
    page_id,
    sender_id,
    sender_name,
    last_message,
    last_message_time,
    conversation_status,
    message_count,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'YOUR_USER_ID',
    'YOUR_PAGE_ID',
    'TEST_QUALIFIED_002',
    'Tom Comparer',
    'I am comparing prices from different suppliers. What is your cost per unit for a 20-unit order? Do you offer discounts?',
    NOW() - INTERVAL '1 hour',
    'active',
    4,
    true,
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '1 hour'
);

-- ============================================
-- VERIFY TEST DATA CREATED
-- ============================================

SELECT 
    '=== TEST CONVERSATIONS CREATED ===' as section,
    sender_id,
    sender_name,
    SUBSTRING(last_message, 1, 60) || '...' as message_preview,
    CASE 
        WHEN last_message LIKE '%just curious%' OR last_message LIKE '%tell me more%' 
        THEN '→ Expected: New Lead'
        WHEN last_message LIKE '%price%' OR last_message LIKE '%cost%' OR last_message LIKE '%comparing%'
        THEN '→ Expected: Qualified'
        WHEN last_message LIKE '%order%' OR last_message LIKE '%buy%' OR last_message LIKE '%quote%' OR last_message LIKE '%ASAP%'
        THEN '→ Expected: Hot Lead'
        ELSE '→ Expected: To be determined'
    END as expected_stage,
    created_at
FROM messenger_conversations
WHERE sender_id LIKE 'TEST_%'
ORDER BY created_at;

-- ============================================
-- READY FOR TESTING
-- ============================================

/*

✅ TEST DATA CREATED!

You now have 6 test conversations:

1. John Browser (TEST_BROWSE_001)
   Message: "just curious about what products you offer"
   Expected Stage: New Lead

2. Maria Interested (TEST_QUALIFIED_001)
   Message: "How much is your premium package?"
   Expected Stage: Qualified

3. Carlos Buyer (TEST_HOT_001)
   Message: "I want to order 50 units. Send quote"
   Expected Stage: Hot Lead

4. Sarah Urgent (TEST_HOT_002)
   Message: "Need 100 units ASAP! Ready to purchase"
   Expected Stage: Hot Lead

5. Lisa Explorer (TEST_BROWSE_002)
   Message: "wanted to learn more about your products"
   Expected Stage: New Lead

6. Tom Comparer (TEST_QUALIFIED_002)
   Message: "comparing prices... What is your cost per unit?"
   Expected Stage: Qualified

NEXT STEPS:

METHOD 1: Test via UI (Recommended)
1. Go to Conversations page in your app
2. You should see these 6 test contacts
3. Select all 6 (or just a few)
4. Click "Add to Pipeline"
5. Watch server console for analysis logs
6. Go to Pipeline page
7. Verify contacts are in expected stages

METHOD 2: Test via API (Direct)
1. Get the conversation IDs:
   SELECT id FROM messenger_conversations WHERE sender_id LIKE 'TEST_%';
2. Use the test script: test-pipeline-sorting-logic.js
3. Pass conversation IDs to test

METHOD 3: Test via SQL (Manual)
1. Insert opportunities directly
2. Call analyze function
3. Check results

*/

-- Get conversation IDs for testing (copy these for later use)
SELECT 
    'Copy these IDs for testing:' as note,
    sender_name,
    id as conversation_id,
    sender_id
FROM messenger_conversations
WHERE sender_id LIKE 'TEST_%'
ORDER BY sender_name;
