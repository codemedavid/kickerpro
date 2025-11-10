-- ============================================
-- WORKING SETUP - Copy and Paste This Entire File
-- No editing needed! Uses subquery for automatic user detection
-- ============================================

-- Delete duplicate stages
DELETE FROM pipeline_stages WHERE name = 'Unmatched' AND user_id IN (SELECT id FROM auth.users);
DELETE FROM pipeline_stages WHERE name LIKE '%messaged%';

-- Create New Lead Stage  
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id as user_id,
    'New Lead' as name,
    'Early exploration - first contact or general inquiry' as description,
    '#3b82f6' as color,
    'This contact is New Lead if they are browsing, asking general questions, or in first/second message. Keywords: info, curious, what, tell me, browsing, just looking.' as analysis_prompt,
    false as is_default,
    true as is_active,
    0 as position
FROM auth.users
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (user_id, name) DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    description = EXCLUDED.description;

-- Create Qualified Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id,
    'Qualified',
    'Showing clear interest in products',
    '#22c55e',
    'This contact is Qualified if they asked about pricing, showed interest in specific products, or discussed needs. Keywords: price, cost, interested, need, how much, features.',
    false,
    true,
    1
FROM auth.users
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (user_id, name) DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    description = EXCLUDED.description;

-- Create Hot Lead Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id,
    'Hot Lead',
    'Ready to purchase',
    '#ef4444',
    'This contact is Hot Lead if they want to buy, requested quote, mentioned timeline, or showing urgency. Keywords: buy, order, quote, ASAP, ready, purchase, urgent.',
    false,
    true,
    2
FROM auth.users
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (user_id, name) DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    description = EXCLUDED.description;

-- Create Unmatched Stage (Default)
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    id,
    'Unmatched',
    'Needs manual review',
    '#94a3b8',
    'Default stage when AI is uncertain.',
    true,
    true,
    999
FROM auth.users
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (user_id, name) DO UPDATE SET 
    is_default = true;

-- Ensure only one default
UPDATE pipeline_stages 
SET is_default = false 
WHERE name != 'Unmatched' 
  AND is_default = true
  AND user_id IN (SELECT id FROM auth.users);

-- Delete old test conversations
DELETE FROM messenger_conversations WHERE sender_id LIKE 'TEST_%';

-- Create test conversations (WITHOUT is_active column)
INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, created_at, updated_at)
SELECT 
    u.id as user_id,
    (SELECT facebook_page_id FROM facebook_pages WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as page_id,
    t.sender_id,
    t.sender_name,
    t.last_message,
    NOW() - t.time_ago as last_message_time,
    'active' as conversation_status,
    t.message_count,
    NOW() - t.time_ago as created_at,
    NOW() - t.time_ago as updated_at
FROM auth.users u
CROSS JOIN (
    VALUES
        ('TEST_NEW_001', 'Alex Curious', 'Hi what products do you have?', '2 hours'::interval, 1),
        ('TEST_NEW_002', 'Beth Browser', 'Tell me about your business', '1 hour'::interval, 1),
        ('TEST_QUAL_001', 'Chris Interested', 'How much is premium package?', '45 min'::interval, 3),
        ('TEST_QUAL_002', 'Diana Shopper', 'Need 20 units what is price?', '30 min'::interval, 2),
        ('TEST_HOT_001', 'Eric Buyer', 'Ready to order 50 units send quote', '20 min'::interval, 4),
        ('TEST_HOT_002', 'Fiona Urgent', 'Need 100 units ASAP best price?', '15 min'::interval, 3)
) AS t(sender_id, sender_name, last_message, time_ago, message_count)
ORDER BY u.created_at DESC
LIMIT 6;

-- VERIFY WHAT WAS CREATED
SELECT '=== STAGES CREATED ===' as section, name, LENGTH(analysis_prompt) as prompt_len, is_default, position 
FROM pipeline_stages 
ORDER BY position;

SELECT '=== TEST CONTACTS ===' as section, sender_name, last_message, sender_id
FROM messenger_conversations 
WHERE sender_id LIKE 'TEST_%'
ORDER BY sender_id;

SELECT '=== READY TO TEST ===' as status, 
    'Go to Conversations page, select TEST_ contacts, click Add to Pipeline' as next_step;

