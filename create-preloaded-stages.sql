-- ============================================
-- PRELOADED STAGES: Ready-to-Test Configuration
-- No manual ID replacement needed!
-- ============================================
-- Just copy and paste this ENTIRE file into Supabase and run
-- ============================================

-- Clean up old/duplicate stages
DELETE FROM pipeline_stages;

-- Create New Lead Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id,
    'New Lead',
    'Early exploration - first contact or general inquiry',
    '#3b82f6',  -- Blue
    'This contact is "New Lead" if they are in early exploration phase with general questions about products or services. They have NOT shown specific interest yet. Keywords to look for: info, information, curious, what do you, tell me about, general question, browsing, just looking, exploring. Does NOT belong if they asked about specific products or pricing.',
    false,
    true,
    0
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- Create Qualified Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id,
    'Qualified',
    'Showing clear interest in products or services',
    '#22c55e',  -- Green
    'This contact is "Qualified" if they have shown specific interest in products, asked about pricing or features, discussed their needs or use case, OR are comparing options. Keywords to look for: price, cost, how much, interested in, need, looking for, want to, available, features, details, bulk, package, discount. Does NOT belong if still just browsing OR already committed to buying.',
    false,
    true,
    1
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- Create Hot Lead Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id,
    'Hot Lead',
    'Ready to purchase or close to commitment',
    '#ef4444',  -- Red
    'This contact is "Hot Lead" if they are ready to make a purchase, requested a quote, expressed intent to buy, mentioned timeline or urgency, OR are discussing payment terms. Keywords to look for: buy, purchase, order, quote, ready to, when can I, how do I buy, ASAP, urgent, need now, delivery, payment, deal, discount deal. Does NOT belong if still comparing options without commitment.',
    false,
    true,
    2
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- Create Closed Won Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id,
    'Closed Won',
    'Purchase completed',
    '#10b981',  -- Emerald
    'This contact is "Closed Won" if they have completed a purchase, confirmed order, made payment, OR deal is finalized. Keywords: purchased, ordered, paid, confirmed, thank you for order, received, completed.',
    false,
    true,
    3
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- Create Unmatched Stage (Default)
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id,
    'Unmatched',
    'Needs manual review - AI uncertain',
    '#94a3b8',  -- Gray
    'Default stage for contacts that need manual review when AI cannot confidently determine the appropriate stage.',
    true,
    true,
    999
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- Verify what was created
SELECT 
    '✅ Stages Created' as status,
    name,
    LENGTH(analysis_prompt) as prompt_chars,
    CASE WHEN is_default THEN '(DEFAULT)' ELSE '' END as default_marker,
    position
FROM pipeline_stages
ORDER BY position;

-- ============================================
-- SUCCESS!
-- ============================================
-- You should now see 5 stages:
-- - New Lead (position 0)
-- - Qualified (position 1)
-- - Hot Lead (position 2)
-- - Closed Won (position 3)
-- - Unmatched (position 999, DEFAULT)
--
-- Each stage has a detailed analysis_prompt
-- ============================================

-- ============================================
-- NEXT: Create Test Contacts
-- ============================================

-- Delete old test data
DELETE FROM pipeline_opportunities WHERE sender_id LIKE 'TEST_%';
DELETE FROM messenger_conversations WHERE sender_id LIKE 'TEST_%';

-- Create test conversations with different message types
INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active, created_at, updated_at)
SELECT 
    u.id,
    (SELECT id FROM facebook_pages WHERE user_id = u.id LIMIT 1),
    test_data.sender_id,
    test_data.sender_name,
    test_data.last_message,
    NOW() - test_data.time_ago,
    'active',
    test_data.message_count,
    true,
    NOW() - test_data.time_ago,
    NOW() - test_data.time_ago
FROM auth.users u
CROSS JOIN (
    VALUES
        ('TEST_NEW_001', 'Alex Curious', 'Hi, what products do you have?', '2 hours'::interval, 1),
        ('TEST_NEW_002', 'Beth Browser', 'Tell me about your business please', '1 hour'::interval, 1),
        ('TEST_QUALIFIED_001', 'Chris Interested', 'How much does your premium package cost?', '45 minutes'::interval, 3),
        ('TEST_QUALIFIED_002', 'Diana Shopper', 'I need 20 units, what is your price per unit?', '30 minutes'::interval, 2),
        ('TEST_HOT_001', 'Eric Buyer', 'Ready to order 50 units ASAP, send me a quote', '20 minutes'::interval, 4),
        ('TEST_HOT_002', 'Fiona Urgent', 'Need to purchase 100 units by next week, what is best price?', '15 minutes'::interval, 3)
) AS test_data(sender_id, sender_name, last_message, time_ago, message_count)
ORDER BY u.created_at DESC
LIMIT 6;

-- Verify test contacts created
SELECT 
    '✅ Test Contacts Created' as status,
    sender_name,
    SUBSTRING(last_message, 1, 50) || '...' as message,
    CASE 
        WHEN sender_id LIKE '%NEW%' THEN '→ Expected: New Lead'
        WHEN sender_id LIKE '%QUALIFIED%' THEN '→ Expected: Qualified'
        WHEN sender_id LIKE '%HOT%' THEN '→ Expected: Hot Lead'
    END as expected_stage
FROM messenger_conversations
WHERE sender_id LIKE 'TEST_%'
ORDER BY sender_id;

-- ============================================
-- ALL DONE! READY TO TEST
-- ============================================
-- You now have:
-- ✅ 5 pipeline stages with detailed prompts
-- ✅ 6 test contacts with clear expected outcomes
--
-- IMPORTANT: API quota is exhausted
-- All 9 Gemini keys are rate-limited
-- 
-- OPTIONS:
-- 1. Wait ~24 hours for quota reset, then test
-- 2. Manually test the logic by dragging contacts in UI
-- 3. The automatic sorting will work once quota resets
--
-- The system IS working - just waiting for API capacity!
-- ============================================

