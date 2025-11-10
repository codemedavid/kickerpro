-- ============================================
-- SUPER SIMPLE SETUP - Just Edit Line 9 and 10
-- ============================================
-- STEP 1: Run these queries FIRST to get your IDs:
--
--   SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1;
--   SELECT id FROM facebook_pages ORDER BY created_at DESC LIMIT 1;
--
-- STEP 2: Copy the IDs from the results
-- STEP 3: Paste them in lines 9 and 10 below (between the quotes)
-- STEP 4: Run this ENTIRE file
-- ============================================

-- 👇 EDIT THESE TWO LINES - Paste your IDs between the quotes:
WITH my_ids AS (
    SELECT 
        'PASTE-YOUR-USER-ID-HERE'::uuid as user_id,
        'PASTE-YOUR-PAGE-ID-HERE'::uuid as page_id
)
-- ============================================
-- Don't edit below this line
-- ============================================

-- Delete old configuration
, cleanup AS (
    DELETE FROM pipeline_settings WHERE user_id = (SELECT user_id FROM my_ids)
    RETURNING 1
)
-- Insert pipeline settings
, new_settings AS (
    INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
    SELECT 
        user_id,
        'Analyze this contact to determine pipeline stage. NEW LEAD means first message or general browsing questions. QUALIFIED means showing interest or asking about pricing. HOT LEAD means ready to buy or requesting quote. Match to best stage.',
        true
    FROM my_ids
    RETURNING id
)
-- Insert or update stages
, stage1 AS (
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    SELECT 
        user_id,
        'New Lead',
        'Early exploration',
        '#3b82f6',
        'This is New Lead if: first message, general questions, browsing, no specific interest. Keywords: info, curious, what, tell me.',
        false,
        true,
        0
    FROM my_ids
    ON CONFLICT (user_id, name) DO UPDATE SET 
        analysis_prompt = EXCLUDED.analysis_prompt
    RETURNING id
)
, stage2 AS (
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    SELECT 
        user_id,
        'Qualified',
        'Showing interest',
        '#22c55e',
        'This is Qualified if: interested in products, asked about pricing, discussed needs. Keywords: price, cost, interested, need, how much.',
        false,
        true,
        1
    FROM my_ids
    ON CONFLICT (user_id, name) DO UPDATE SET 
        analysis_prompt = EXCLUDED.analysis_prompt
    RETURNING id
)
, stage3 AS (
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    SELECT 
        user_id,
        'Hot Lead',
        'Ready to buy',
        '#ef4444',
        'This is Hot Lead if: ready to buy, requested quote, purchase intent, urgent need. Keywords: buy, order, quote, ASAP, ready, purchase.',
        false,
        true,
        2
    FROM my_ids
    ON CONFLICT (user_id, name) DO UPDATE SET 
        analysis_prompt = EXCLUDED.analysis_prompt
    RETURNING id
)
-- Create test conversations
, cleanup_tests AS (
    DELETE FROM messenger_conversations 
    WHERE user_id = (SELECT user_id FROM my_ids) 
      AND sender_id LIKE 'TEST_%'
    RETURNING 1
)
, test_convs AS (
    INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active, created_at, updated_at)
    SELECT 
        user_id,
        page_id,
        sender_id,
        sender_name,
        last_message,
        NOW() - interval,
        'active',
        msg_count,
        true,
        NOW() - interval,
        NOW() - interval
    FROM my_ids
    CROSS JOIN (VALUES
        ('TEST_BROWSE_001', 'John Browser', 'Hi curious about products', '2 hours'::interval, 1),
        ('TEST_QUALIFIED_001', 'Maria Interested', 'How much is premium package?', '1 hour'::interval, 3),
        ('TEST_HOT_001', 'Carlos Buyer', 'Want to order 50 units send quote', '30 minutes'::interval, 5)
    ) AS t(sender_id, sender_name, last_message, interval, msg_count)
    RETURNING sender_name
)
-- Final summary
SELECT 
    'SETUP COMPLETE!' as status,
    (SELECT COUNT(*) FROM pipeline_settings WHERE user_id = (SELECT user_id FROM my_ids)) as settings_created,
    (SELECT COUNT(*) FROM pipeline_stages WHERE user_id = (SELECT user_id FROM my_ids)) as stages_created,
    (SELECT COUNT(*) FROM messenger_conversations WHERE sender_id LIKE 'TEST_%' AND user_id = (SELECT user_id FROM my_ids)) as test_contacts_created;

-- Show what was created
SELECT 'Settings' as type, LENGTH(global_analysis_prompt) as prompt_length FROM pipeline_settings WHERE user_id = (SELECT 'PASTE-YOUR-USER-ID-HERE'::uuid);
SELECT 'Stages' as type, name, is_default FROM pipeline_stages WHERE user_id = (SELECT 'PASTE-YOUR-USER-ID-HERE'::uuid) ORDER BY position;
SELECT 'Tests' as type, sender_name FROM messenger_conversations WHERE sender_id LIKE 'TEST_%' AND user_id = (SELECT 'PASTE-YOUR-USER-ID-HERE'::uuid);

