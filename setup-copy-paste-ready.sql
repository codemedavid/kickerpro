-- ============================================
-- COPY-PASTE READY: Pipeline Setup
-- ============================================
-- INSTRUCTIONS:
-- 1. First, run these 2 queries to get your IDs:
--
--    SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1;
--    SELECT id FROM facebook_pages ORDER BY created_at DESC LIMIT 1;
--
-- 2. Copy your user_id and page_id
-- 3. In THIS file, use Find & Replace (Ctrl+H):
--    Find: REPLACE_USER_ID
--    Replace: your-actual-user-id
--    Replace All
-- 4. Do the same for page_id:
--    Find: REPLACE_PAGE_ID
--    Replace: your-actual-page-id
--    Replace All
-- 5. Copy this ENTIRE file and run in Supabase
-- ============================================

-- Delete old configuration
DELETE FROM pipeline_settings WHERE user_id = 'REPLACE_USER_ID';

-- Create pipeline settings
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES (
    'REPLACE_USER_ID',
    'Analyze this contact to determine their pipeline stage. NEW LEAD means browsing or general questions. QUALIFIED means showing interest or asking about pricing. HOT LEAD means ready to buy or requesting quote. Choose the stage that best matches.',
    true
);

-- Create New Lead stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'REPLACE_USER_ID',
    'New Lead',
    'Early exploration',
    '#3b82f6',
    'New Lead if first message or general browsing questions. Keywords: info, curious, what, tell me.',
    false,
    true,
    0
)
ON CONFLICT (user_id, name) DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    color = EXCLUDED.color,
    description = EXCLUDED.description;

-- Create Qualified stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'REPLACE_USER_ID',
    'Qualified',
    'Showing interest',
    '#22c55e',
    'Qualified if showing interest in products or asking about pricing. Keywords: price, cost, interested, need.',
    false,
    true,
    1
)
ON CONFLICT (user_id, name) DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    color = EXCLUDED.color,
    description = EXCLUDED.description;

-- Create Hot Lead stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'REPLACE_USER_ID',
    'Hot Lead',
    'Ready to buy',
    '#ef4444',
    'Hot Lead if ready to buy or requesting quote or urgent need. Keywords: buy, order, quote, ASAP.',
    false,
    true,
    2
)
ON CONFLICT (user_id, name) DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    color = EXCLUDED.color,
    description = EXCLUDED.description;

-- Create/update default stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'REPLACE_USER_ID',
    'Unmatched',
    'Needs review',
    '#94a3b8',
    'Default for uncertain contacts.',
    true,
    true,
    999
)
ON CONFLICT (user_id, name) DO UPDATE SET 
    is_default = true;

-- Delete old test data
DELETE FROM messenger_conversations WHERE sender_id LIKE 'TEST_%' AND user_id = 'REPLACE_USER_ID';

-- Create test conversations
INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active, created_at, updated_at)
VALUES 
    ('REPLACE_USER_ID', 'REPLACE_PAGE_ID', 'TEST_BROWSE_001', 'John Browser', 'Hi curious about products', NOW(), 'active', 1, true, NOW(), NOW()),
    ('REPLACE_USER_ID', 'REPLACE_PAGE_ID', 'TEST_QUALIFIED_001', 'Maria Interested', 'How much is the premium package?', NOW(), 'active', 3, true, NOW(), NOW()),
    ('REPLACE_USER_ID', 'REPLACE_PAGE_ID', 'TEST_HOT_001', 'Carlos Buyer', 'Want to order 50 units, send quote', NOW(), 'active', 5, true, NOW(), NOW());

-- Show what was created
SELECT 'SETUP COMPLETE!' as status;
SELECT 'Settings:' as type, COUNT(*) FROM pipeline_settings WHERE user_id = 'REPLACE_USER_ID';
SELECT 'Stages:' as type, name FROM pipeline_stages WHERE user_id = 'REPLACE_USER_ID' ORDER BY position;
SELECT 'Test Contacts:' as type, sender_name FROM messenger_conversations WHERE sender_id LIKE 'TEST_%' AND user_id = 'REPLACE_USER_ID';

