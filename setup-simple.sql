-- ============================================
-- SIMPLE SETUP: Pipeline Configuration
-- ============================================
-- STEP 1: Get your user_id and page_id FIRST by running this:
-- ============================================

SELECT 
    'YOUR USER ID:' as label,
    id as user_id,
    email
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

SELECT 
    'YOUR PAGE ID:' as label,
    id as page_id,
    name as page_name
FROM facebook_pages
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- STEP 2: Copy your user_id and page_id from above
-- STEP 3: Replace in the lines below:
-- ============================================
-- Set your IDs here (replace the values):
\set user_id 'PASTE-YOUR-USER-ID-HERE'
\set page_id 'PASTE-YOUR-PAGE-ID-HERE'

-- ============================================
-- STEP 4: Run the rest of this script
-- ============================================

-- Clean up old data
DELETE FROM pipeline_settings WHERE user_id = :'user_id';
DELETE FROM pipeline_stages WHERE user_id = :'user_id' AND name IN ('New Lead', 'Qualified', 'Hot Lead');

-- Create Pipeline Settings
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES (
    :'user_id',
    'Analyze this contact to determine their pipeline stage. NEW LEAD: First message, general questions, browsing. QUALIFIED: Specific interest, pricing questions. HOT LEAD: Ready to buy, requesting quote. Match to the best stage.',
    true
);

-- Create New Lead Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    :'user_id',
    'New Lead',
    'Early exploration',
    '#3b82f6',
    'This is New Lead if: First message OR asking general questions OR no buying intent. Keywords: info, curious, what, tell me.',
    false,
    true,
    0
);

-- Create Qualified Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    :'user_id',
    'Qualified',
    'Showing interest',
    '#22c55e',
    'This is Qualified if: Interested in products OR asked about pricing OR discussed needs. Keywords: price, cost, interested, need.',
    false,
    true,
    1
);

-- Create Hot Lead Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    :'user_id',
    'Hot Lead',
    'Ready to buy',
    '#ef4444',
    'This is Hot Lead if: Ready to buy OR requested quote OR urgent. Keywords: buy, order, quote, ASAP, ready.',
    false,
    true,
    2
);

-- Update Unmatched to be default
UPDATE pipeline_stages 
SET is_default = true 
WHERE user_id = :'user_id' 
  AND name = 'Unmatched';

-- Or create if doesn't exist
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    :'user_id',
    'Unmatched',
    'Needs review',
    '#94a3b8',
    'Default stage for uncertain cases.',
    true,
    true,
    999
)
ON CONFLICT (user_id, name) DO UPDATE SET is_default = true;

-- Create Test Conversations
DELETE FROM messenger_conversations WHERE sender_id LIKE 'TEST_%' AND user_id = :'user_id';

INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active)
VALUES 
    (:'user_id', :'page_id', 'TEST_BROWSE_001', 'John Browser', 'Hi, just curious about what products you offer', NOW() - INTERVAL '2 hours', 'active', 1, true),
    (:'user_id', :'page_id', 'TEST_BROWSE_002', 'Lisa Explorer', 'Hello! I wanted to learn more about your products', NOW() - INTERVAL '45 minutes', 'active', 1, true),
    (:'user_id', :'page_id', 'TEST_QUALIFIED_001', 'Maria Interested', 'How much is your premium package? I need pricing details', NOW() - INTERVAL '1 hour', 'active', 3, true),
    (:'user_id', :'page_id', 'TEST_QUALIFIED_002', 'Tom Comparer', 'I am comparing prices. What is your cost per unit for 20 units?', NOW() - INTERVAL '1 hour', 'active', 4, true),
    (:'user_id', :'page_id', 'TEST_HOT_001', 'Carlos Buyer', 'I want to order 50 units. Can you send me a quote today?', NOW() - INTERVAL '30 minutes', 'active', 5, true),
    (:'user_id', :'page_id', 'TEST_HOT_002', 'Sarah Urgent', 'Need 100 units ASAP! Ready to purchase if price is right', NOW() - INTERVAL '15 minutes', 'active', 2, true);

-- Verify Setup
SELECT 'Pipeline Settings' as created, COUNT(*) as count FROM pipeline_settings WHERE user_id = :'user_id';
SELECT 'Pipeline Stages' as created, name, LENGTH(analysis_prompt) as prompt_chars FROM pipeline_stages WHERE user_id = :'user_id' ORDER BY position;
SELECT 'Test Conversations' as created, sender_name, SUBSTRING(last_message, 1, 40) as message FROM messenger_conversations WHERE sender_id LIKE 'TEST_%' AND user_id = :'user_id';

-- ============================================
-- SUCCESS!
-- ============================================
-- You should see:
-- ✅ 1 pipeline_settings record
-- ✅ 4 pipeline_stages (New Lead, Qualified, Hot Lead, Unmatched)
-- ✅ 6 test conversations
--
-- NEXT: Go to Conversations page, select TEST_ contacts, click "Add to Pipeline"
-- ============================================

