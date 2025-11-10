-- ============================================
-- SETUP: Pipeline Configuration for Testing
-- This script sets up everything needed for auto-sorting
-- ============================================
-- INSTRUCTIONS:
-- 1. Replace 'YOUR_USER_ID' with your actual user_id throughout this file
-- 2. Run this ENTIRE script in Supabase SQL Editor
-- 3. After running, test by adding a contact to pipeline
-- ============================================

-- Get your user_id if you don't know it:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- ============================================
-- STEP 1: Create/Update Pipeline Settings
-- ============================================

-- Delete existing settings (if any) to start fresh
DELETE FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID';

-- Insert comprehensive global analysis prompt
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES (
    'YOUR_USER_ID',
    'You are analyzing sales leads to determine their pipeline stage based on conversation content.

ANALYSIS CRITERIA:

1. NEW LEAD - Early exploration:
   - First or second message
   - General questions about products/services
   - No specific product interest expressed
   - Just browsing or gathering basic information
   - Keywords: "info", "what do you", "tell me about", "curious", "browsing"

2. QUALIFIED - Showing interest:
   - Expressed interest in specific products/services
   - Asked about features, pricing, or availability
   - Discussed their needs or use case
   - Comparing options or evaluating solutions
   - Keywords: "price", "cost", "interested in", "need", "how much", "available"

3. HOT LEAD - Ready to purchase:
   - Discussing payment terms, delivery, or purchase process
   - Requested quote or proposal
   - Expressed intent to buy or commit
   - Mentioned timeline for purchase
   - Keywords: "buy", "purchase", "order", "quote", "ready to", "when can I"

INSTRUCTIONS:
- Read the conversation carefully
- Match the contact to the stage that best fits their current status
- Be confident in your recommendation
- If unclear, default to the earlier stage (New Lead over Qualified)

Respond with the stage name that best matches the conversation.',
    true
);

-- Verify settings were created
SELECT 
    '✅ Settings Created' as status,
    LENGTH(global_analysis_prompt) as prompt_length,
    auto_analyze
FROM pipeline_settings 
WHERE user_id = 'YOUR_USER_ID';

-- ============================================
-- STEP 2: Create Pipeline Stages with Analysis Prompts
-- ============================================

-- Delete existing stages to start fresh (optional - comment out if you want to keep existing)
-- DELETE FROM pipeline_stages WHERE user_id = 'YOUR_USER_ID';

-- Create New Lead Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'YOUR_USER_ID',
    'New Lead',
    'Early exploration - first contact or general inquiry',
    '#3b82f6',  -- Blue
    'This contact belongs in "New Lead" stage if they are in the early exploration phase.

CRITERIA:
- This is their first or second message to your business
- They are asking general questions like "what do you offer", "tell me about your products"
- No specific product or service interest expressed yet
- Just browsing, gathering information, or exploring options
- No discussion of pricing, features, or buying
- Casual inquiry with no urgency

KEYWORDS TO LOOK FOR:
"info", "information", "what do you", "tell me about", "curious", "browsing", "just looking", "exploring", "general question"

DOES NOT BELONG if:
- Already discussed specific products
- Asked about pricing or availability
- Showed clear buying intent

Analyze the conversation and determine if this contact fits the "New Lead" criteria.',
    false,  -- Not default
    true,   -- Active
    0       -- First position
)
ON CONFLICT (user_id, name) 
DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    description = EXCLUDED.description,
    color = EXCLUDED.color;

-- Create Qualified Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'YOUR_USER_ID',
    'Qualified',
    'Showing clear interest in products/services',
    '#22c55e',  -- Green
    'This contact belongs in "Qualified" stage if they have shown clear interest beyond general browsing.

CRITERIA:
- Expressed interest in specific products or services
- Asked about features, specifications, or availability
- Discussed their specific needs or use case
- Asked about pricing, costs, or package options
- Comparing your offering with competitors
- Evaluating solutions or gathering detailed information
- May have mentioned budget or timeline

KEYWORDS TO LOOK FOR:
"price", "cost", "how much", "interested in", "need", "looking for", "want to", "available", "features", "details", "bulk", "package", "options"

DOES NOT BELONG if:
- Still in general browsing phase (no specific interest)
- Already committed to buying (that is Hot Lead)
- Just asking "what do you sell" type questions

Analyze the conversation and determine if this contact has progressed beyond browsing to showing genuine interest.',
    false,  -- Not default
    true,   -- Active
    1       -- Second position
)
ON CONFLICT (user_id, name) 
DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    description = EXCLUDED.description,
    color = EXCLUDED.color;

-- Create Hot Lead Stage
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'YOUR_USER_ID',
    'Hot Lead',
    'Ready to purchase or discussing terms',
    '#ef4444',  -- Red
    'This contact belongs in "Hot Lead" stage if they are ready to make a purchase or close to committing.

CRITERIA:
- Discussing payment terms, delivery details, or purchase process
- Requested a formal quote or proposal
- Expressed clear intent to buy or purchase
- Asked about "when can I order", "how do I buy", "ready to proceed"
- Negotiating price, asking for discounts
- Mentioned specific purchase timeline or deadline
- Working through final objections or questions before buying

KEYWORDS TO LOOK FOR:
"buy", "purchase", "order", "quote", "ready to", "when can I", "how do I buy", "discount", "deal", "payment", "delivery", "ship", "urgent", "need ASAP", "deadline"

DOES NOT BELONG if:
- Still comparing options (that is Qualified)
- Just asking about pricing without commitment signals
- No urgency or purchase timeline mentioned

Analyze the conversation and determine if this contact is ready to buy or very close to making a purchase decision.',
    false,  -- Not default
    true,   -- Active
    2       -- Third position
)
ON CONFLICT (user_id, name) 
DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    description = EXCLUDED.description,
    color = EXCLUDED.color;

-- Create/Update Unmatched Stage (Default)
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'YOUR_USER_ID',
    'Unmatched',
    'Contacts that need manual review or unclear classification',
    '#94a3b8',  -- Gray
    'This is the default stage for contacts that do not clearly fit into any specific category or when AI is uncertain.

Contacts should stay in Unmatched if:
- Conversation history is too limited to make a determination
- Messages are unclear or ambiguous
- AI analysis disagreed on classification
- Contact needs manual review

This stage is intentionally conservative to avoid misclassification.',
    true,   -- IS DEFAULT
    true,   -- Active
    999     -- Last position
)
ON CONFLICT (user_id, name) 
DO UPDATE SET 
    analysis_prompt = EXCLUDED.analysis_prompt,
    is_default = EXCLUDED.is_default,
    description = EXCLUDED.description;

-- Ensure only one default stage per user
UPDATE pipeline_stages 
SET is_default = false 
WHERE user_id = 'YOUR_USER_ID' 
  AND name != 'Unmatched' 
  AND is_default = true;

-- Verify stages were created
SELECT 
    '✅ Stage Created: ' || name as status,
    CASE WHEN is_default THEN '(DEFAULT)' ELSE '' END as marker,
    LENGTH(analysis_prompt) as prompt_chars,
    position
FROM pipeline_stages 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY position;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Final check - should all show ✅
SELECT 
    '=== FINAL VERIFICATION ===' as check_type,
    CASE WHEN EXISTS(SELECT 1 FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID')
         THEN '✅ Pipeline settings configured'
         ELSE '❌ Settings missing' END as settings_check,
    (SELECT COUNT(*) FROM pipeline_stages WHERE user_id = 'YOUR_USER_ID' AND is_active = true) as active_stages,
    (SELECT COUNT(*) FROM pipeline_stages WHERE user_id = 'YOUR_USER_ID' AND analysis_prompt IS NOT NULL AND LENGTH(analysis_prompt) > 50) as stages_with_good_prompts,
    (SELECT name FROM pipeline_stages WHERE user_id = 'YOUR_USER_ID' AND is_default = true LIMIT 1) as default_stage_name;

-- ============================================
-- SUCCESS CRITERIA
-- ============================================

/*

✅ SUCCESS - All these should be true:
- Pipeline settings: "✅ Pipeline settings configured"
- Active stages: >= 3
- Stages with good prompts: >= 3
- Default stage name: "Unmatched"

If all checks pass, you're ready to test!

NEXT STEP:
1. Go to Conversations page
2. Select 1 contact
3. Click "Add to Pipeline"
4. Check if it sorts to appropriate stage (not just Unmatched)

*/

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If you need to delete everything and start over:
/*
DELETE FROM pipeline_stage_history WHERE opportunity_id IN 
  (SELECT id FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID');
DELETE FROM pipeline_opportunities WHERE user_id = 'YOUR_USER_ID';
DELETE FROM pipeline_stages WHERE user_id = 'YOUR_USER_ID';
DELETE FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID';

-- Then run this script again
*/
