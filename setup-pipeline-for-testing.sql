-- ============================================
-- SETUP PIPELINE FOR TESTING
-- This creates complete pipeline configuration
-- Run this in Supabase SQL Editor
-- ============================================

-- INSTRUCTIONS:
-- 1. Get your user ID: SELECT id FROM auth.users WHERE email = 'your-email';
-- 2. Replace 'YOUR_USER_ID' below with your actual user ID
-- 3. Run this entire script
-- 4. Test adding contacts to pipeline

-- ============================================
-- STEP 1: Create/Update Pipeline Settings
-- ============================================

-- Delete existing settings if any (for clean test)
DELETE FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID';

-- Insert comprehensive pipeline settings
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES (
    'YOUR_USER_ID',
    'You are analyzing sales conversations to determine which pipeline stage each contact belongs in.

ANALYSIS CRITERIA:

1. NEW LEAD - Early exploration stage
   - First or second message exchange
   - Asking general questions about products/services
   - No specific product interest yet
   - No buying signals
   - Keywords: "info", "what do you", "tell me about", "curious", "just looking"

2. QUALIFIED - Showing clear interest
   - Expressed interest in specific products
   - Asked about features, pricing, or availability
   - Discussed their specific needs or use case
   - Comparing options or gathering details
   - Keywords: "price", "cost", "how much", "interested in", "need", "looking for", "available"

3. HOT LEAD - Ready to purchase
   - Discussing price, payment terms, or delivery
   - Requested formal quote or proposal
   - Expressed clear intent to purchase
   - Mentioned timeline for buying
   - Working through final details
   - Keywords: "buy", "purchase", "order", "quote", "deal", "discount", "ready", "when can I"

DECISION PROCESS:
- Read the conversation history carefully
- Identify buying signals and intent level
- Match to the stage criteria above
- Recommend the stage that best fits
- Be specific in your reasoning

Respond with the stage name that best matches the contact''s current status.',
    true
)
ON CONFLICT (user_id) 
DO UPDATE SET 
    global_analysis_prompt = EXCLUDED.global_analysis_prompt,
    auto_analyze = EXCLUDED.auto_analyze,
    updated_at = NOW();

-- ============================================
-- STEP 2: Create/Update Pipeline Stages
-- ============================================

-- Get or create default stage first
INSERT INTO pipeline_stages (
    user_id, name, description, color, analysis_prompt, is_default, position, is_active
)
VALUES (
    'YOUR_USER_ID',
    'Unmatched',
    'Contacts that need manual review or AI was uncertain',
    '#94a3b8',
    'This contact goes to "Unmatched" only if the AI is uncertain or the conversation does not clearly fit any other stage criteria. This is a fallback stage for manual review.',
    true,
    999,
    true
)
ON CONFLICT (user_id, name) 
DO UPDATE SET 
    description = EXCLUDED.description,
    analysis_prompt = EXCLUDED.analysis_prompt,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

-- Create New Lead stage
INSERT INTO pipeline_stages (
    user_id, name, description, color, analysis_prompt, is_default, position, is_active
)
VALUES (
    'YOUR_USER_ID',
    'New Lead',
    'Early stage contacts exploring options',
    '#3b82f6',
    'This contact belongs in "New Lead" stage if:

CRITERIA:
- This is their first or second message in the conversation
- They are asking general questions about your products or services
- They have NOT shown specific interest in a particular product yet
- They have NOT discussed pricing, buying, or purchase details
- They appear to be in early exploration or information gathering phase
- The conversation shows curiosity but no commitment

POSITIVE INDICATORS (belongs here):
- Messages like: "Hi, what do you sell?", "Tell me about your products", "I''m curious about..."
- General inquiries without specific product focus
- Browsing or exploring tone
- No mention of pricing, buying, or timeline

NEGATIVE INDICATORS (does NOT belong here):
- Has asked about pricing or specific products
- Mentioned buying, ordering, or purchase intent
- Discussed delivery, payment, or terms
- Multiple message exchanges with deepening interest

KEYWORDS THAT INDICATE NEW LEAD:
"info", "information", "what", "tell me", "curious", "just looking", "browsing", "exploring", "learn more"

Respond with:
- belongs: true if contact matches criteria above
- belongs: false if contact shows more advanced interest
- confidence: 0.8-1.0 for clear matches, 0.5-0.7 for uncertain
- reasoning: Explain which indicators you found',
    false,
    0,
    true
)
ON CONFLICT (user_id, name) 
DO UPDATE SET 
    description = EXCLUDED.description,
    analysis_prompt = EXCLUDED.analysis_prompt,
    color = EXCLUDED.color,
    position = EXCLUDED.position,
    updated_at = NOW();

-- Create Qualified stage
INSERT INTO pipeline_stages (
    user_id, name, description, color, analysis_prompt, is_default, position, is_active
)
VALUES (
    'YOUR_USER_ID',
    'Qualified',
    'Contacts showing clear interest and purchase potential',
    '#22c55e',
    'This contact belongs in "Qualified" stage if:

CRITERIA:
- Has expressed clear interest in specific products or services
- Has asked about pricing, features, specifications, or availability
- Has discussed their specific needs, use case, or requirements
- Shows purchase potential but not yet ready to commit
- Comparing options or gathering detailed information
- Multiple message exchanges showing engagement

POSITIVE INDICATORS (belongs here):
- Messages like: "How much is...", "What''s the price for...", "Do you have...", "I need...", "Interested in..."
- Specific product inquiries
- Questions about features or capabilities
- Discussing their situation or needs
- Asking about stock, delivery time, or options

NEGATIVE INDICATORS (does NOT belong here):
- Still in general exploration (too early → New Lead)
- Already discussing payment/delivery terms (too advanced → Hot Lead)
- Ready to buy or requesting quote (→ Hot Lead)
- Just browsing with no specific interest (→ New Lead)

KEYWORDS THAT INDICATE QUALIFIED:
"price", "cost", "how much", "interested in", "need", "looking for", "want", "available", "do you have", "what about", "features", "specifications"

Respond with:
- belongs: true if contact matches criteria above
- belongs: false if too early or too advanced
- confidence: 0.8-1.0 for clear matches, 0.5-0.7 for uncertain
- reasoning: Explain which buying signals you found',
    false,
    1,
    true
)
ON CONFLICT (user_id, name) 
DO UPDATE SET 
    description = EXCLUDED.description,
    analysis_prompt = EXCLUDED.analysis_prompt,
    color = EXCLUDED.color,
    position = EXCLUDED.position,
    updated_at = NOW();

-- Create Hot Lead stage
INSERT INTO pipeline_stages (
    user_id, name, description, color, analysis_prompt, is_default, position, is_active
)
VALUES (
    'YOUR_USER_ID',
    'Hot Lead',
    'Contacts ready to purchase or in final negotiation',
    '#ef4444',
    'This contact belongs in "Hot Lead" stage if:

CRITERIA:
- Actively discussing purchase, pricing, or payment terms
- Has requested a formal quote, proposal, or order details
- Expressed clear and immediate intent to purchase
- Discussing delivery, payment options, or contract terms
- Mentioned specific timeline or urgency for buying
- Asking about discounts, bulk pricing, or final terms
- Ready to move forward with transaction

POSITIVE INDICATORS (belongs here):
- Messages like: "Ready to buy", "Send me a quote", "How can I pay", "What''s your best price", "Need this by...", "Let''s proceed"
- Discussing payment methods or delivery logistics
- Asking for discount or negotiating price
- Mentioned budget or purchase authority
- Specific timeline mentioned ("need by Friday", "ordering this week")
- Direct buying language

NEGATIVE INDICATORS (does NOT belong here):
- Still gathering information (→ Qualified)
- No purchase timeline or commitment
- Just asking about prices without intent (→ Qualified)
- Very early stage questions (→ New Lead)

KEYWORDS THAT INDICATE HOT LEAD:
"buy", "purchase", "order", "quote", "quotation", "price quote", "deal", "discount", "payment", "pay", "delivery", "ship", "ready", "proceed", "go ahead", "let''s do this", "need by", "urgent"

Respond with:
- belongs: true if contact shows strong buying signals
- belongs: false if not yet ready to purchase
- confidence: 0.8-1.0 for clear buying intent, 0.5-0.7 for uncertain
- reasoning: Explain which purchase signals you found',
    false,
    2,
    true
)
ON CONFLICT (user_id, name) 
DO UPDATE SET 
    description = EXCLUDED.description,
    analysis_prompt = EXCLUDED.analysis_prompt,
    color = EXCLUDED.color,
    position = EXCLUDED.position,
    updated_at = NOW();

-- ============================================
-- STEP 3: Verify Setup
-- ============================================

-- Check settings
SELECT 
    'Settings Check' as verification,
    CASE 
        WHEN LENGTH(global_analysis_prompt) > 0 THEN '✅ Global prompt configured'
        ELSE '❌ Failed to create settings'
    END as status
FROM pipeline_settings
WHERE user_id = 'YOUR_USER_ID';

-- Check stages
SELECT 
    'Stages Check' as verification,
    name,
    CASE 
        WHEN LENGTH(analysis_prompt) > 100 THEN '✅ Has detailed prompt'
        ELSE '❌ Prompt too short'
    END as status,
    is_default,
    position
FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID'
ORDER BY position;

-- Summary
SELECT 
    'SETUP COMPLETE' as status,
    COUNT(*) as total_stages,
    COUNT(CASE WHEN analysis_prompt IS NOT NULL THEN 1 END) as stages_with_prompts,
    (SELECT COUNT(*) FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID') as settings_count
FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID';
