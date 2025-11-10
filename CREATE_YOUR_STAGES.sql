-- ============================================
-- READY TO RUN - Your Stages (No Editing Needed!)
-- ============================================
-- Just copy and paste this entire file and run
-- ============================================

-- Create New Lead Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'a3c2696c-1248-4603-9dfb-141879987556',
    'New Lead',
    'Early exploration - first contact or general inquiry',
    '#3b82f6',
    'This contact is New Lead if they are in early browsing phase, asking general questions, or first/second message. Keywords to identify: info, information, curious, what do you, tell me about, browsing, just looking, exploring, general question.',
    false,
    true,
    0
);

-- Create Qualified Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'a3c2696c-1248-4603-9dfb-141879987556',
    'Qualified',
    'Showing clear interest in products or services',
    '#22c55e',
    'This contact is Qualified if they showed specific interest in products, asked about pricing or features, discussed their needs or use case, or are comparing options. Keywords: price, cost, how much, interested in, need, looking for, available, features, bulk, discount.',
    false,
    true,
    1
);

-- Create Hot Lead Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'a3c2696c-1248-4603-9dfb-141879987556',
    'Hot Lead',
    'Ready to purchase or discussing terms',
    '#ef4444',
    'This contact is Hot Lead if they are ready to buy, requested quote, expressed purchase intent, mentioned timeline or urgency, or discussing payment terms. Keywords: buy, purchase, order, quote, ready to, when can I, ASAP, urgent, need now, delivery.',
    false,
    true,
    2
);

-- Verify all stages
SELECT 
    name,
    LENGTH(analysis_prompt) as prompt_chars,
    is_default,
    position
FROM pipeline_stages
ORDER BY position;

-- ============================================
-- EXPECTED OUTPUT:
-- ============================================
-- New Lead   | 180+ | false | 0
-- Qualified  | 200+ | false | 1
-- Hot Lead   | 190+ | false | 2
-- Unmatched  |  64  | true  | 999
--
-- Total: 4 stages
-- ============================================

