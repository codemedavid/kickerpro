-- ============================================
-- SIMPLE STAGE CREATION - Run Each Query Separately
-- ============================================
-- STEP 1: Get your user_id
-- ============================================

SELECT id, email FROM auth.users LIMIT 1;

-- Copy the 'id' value from above
-- Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890

-- ============================================
-- STEP 2: Replace YOUR_USER_ID in queries below
-- ============================================
-- In each of the 3 queries below:
-- 1. Replace YOUR_USER_ID with your actual user_id
-- 2. Run the query
-- 3. Wait for "Success"
-- 4. Move to next query
-- ============================================

-- QUERY 1: Create New Lead
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'YOUR_USER_ID',
    'New Lead',
    'Early exploration',
    '#3b82f6',
    'New Lead if browsing or first message. Keywords: info, curious, what, tell me.',
    false,
    true,
    0
);

-- QUERY 2: Create Qualified  
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'YOUR_USER_ID',
    'Qualified',
    'Showing interest',
    '#22c55e',
    'Qualified if pricing questions or showing interest. Keywords: price, cost, interested, need.',
    false,
    true,
    1
);

-- QUERY 3: Create Hot Lead
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'YOUR_USER_ID',
    'Hot Lead',
    'Ready to buy',
    '#ef4444',
    'Hot Lead if ready to buy or requesting quote. Keywords: buy, order, quote, ASAP.',
    false,
    true,
    2
);

-- ============================================
-- STEP 3: Verify all 4 stages exist
-- ============================================

SELECT name, LENGTH(analysis_prompt), is_default, position 
FROM pipeline_stages 
ORDER BY position;

-- Should show:
-- New Lead   | 60+ | false | 0
-- Qualified  | 80+ | false | 1
-- Hot Lead   | 70+ | false | 2
-- Unmatched  | 60+ | true  | 999

