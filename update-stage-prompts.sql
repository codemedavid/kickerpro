-- ============================================
-- UPDATE: Better Stage-Specific Prompts
-- Run this AFTER updating global prompt
-- ============================================

-- Update New Lead Stage
UPDATE pipeline_stages
SET analysis_prompt = 'Analyze if this contact belongs in the NEW LEAD stage.

NEW LEAD CRITERIA:
This contact is in early exploration phase if they are:
- Making their first or second contact
- Asking general questions: "What do you sell?", "Tell me about your business"
- Showing curiosity but no specific product interest yet
- Gathering basic information without commitment
- Using exploratory language: browsing, looking around, just curious

KEYWORDS THAT INDICATE NEW LEAD:
- info, information, curious, browsing, exploring
- what do you, tell me about, learn more, general question
- just looking, just curious, want to know more

DOES NOT BELONG IN NEW LEAD IF:
- They asked about specific products or services
- They mentioned pricing, costs, or "how much"
- They discussed their specific needs or requirements
- They show clear buying intent or urgency

DECISION:
Does this contact match the NEW LEAD criteria above? 
Respond with true (belongs) or false (does not belong) based on their conversation content.',
    description = 'Early exploration - first contact, general inquiry, browsing phase'
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556'
  AND name = 'New Lead';

-- Update Qualified Stage
UPDATE pipeline_stages
SET analysis_prompt = 'Analyze if this contact belongs in the QUALIFIED stage.

QUALIFIED CRITERIA:
This contact has progressed beyond browsing if they:
- Expressed specific interest in particular products or services
- Asked about pricing: "How much is...", "What does it cost..."
- Discussed features, specifications, or availability
- Shared their specific needs or use case
- Are comparing options or evaluating solutions
- Asked detailed questions beyond general browsing

KEYWORDS THAT INDICATE QUALIFIED:
- price, pricing, cost, how much, what''s the cost
- interested in, need, looking for, require, want
- features, specifications, details, availability
- bulk, quantity, package, options, discount
- for my business, for my company, we need

DOES NOT BELONG IN QUALIFIED IF:
- Still in general browsing mode (no specific interest)
- Already showing strong purchase intent (that''s Hot Lead)
- Just asking "what do you sell" type questions

DECISION:
Does this contact match the QUALIFIED criteria above?
Respond with true (belongs) or false (does not belong) based on their conversation showing specific interest or pricing questions.',
    description = 'Active interest - pricing questions, evaluating options, discussing needs'
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556'
  AND name = 'Qualified';

-- Update Hot Lead Stage
UPDATE pipeline_stages
SET analysis_prompt = 'Analyze if this contact belongs in the HOT LEAD stage.

HOT LEAD CRITERIA:
This contact is ready to purchase if they:
- Expressed clear intent to buy or order
- Requested a formal quote or proposal
- Asked "how do I buy", "when can I order", "how to purchase"
- Mentioned urgency: ASAP, urgent, need now, need by [date]
- Discussed payment terms, delivery details, or order process
- Showed commitment language: "I want to order", "ready to buy"
- Mentioned specific purchase timeline or deadline

KEYWORDS THAT INDICATE HOT LEAD:
- buy, purchase, order, ordering, place an order
- quote, proposal, send me a quote
- ready to, ready to buy, ready to order
- ASAP, urgent, urgently need, need now, need by
- when can I, how do I buy, how to order
- payment, pay, delivery, ship, shipping
- deal, close the deal, let''s proceed

DOES NOT BELONG IN HOT LEAD IF:
- Still comparing options without commitment (that''s Qualified)
- Just asking about pricing without purchase intent
- No urgency or timeline mentioned
- Casual interest without commitment signals

DECISION:
Does this contact show clear purchase intent matching HOT LEAD criteria?
Respond with true (belongs) or false (does not belong) based on their readiness to buy.',
    description = 'Purchase intent - ready to buy, requesting quotes, showing urgency'
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556'
  AND name = 'Hot Lead';

-- Verify all updates
SELECT 
    '✅ Stage Prompts Updated' as status,
    name,
    LENGTH(analysis_prompt) as new_prompt_length,
    LENGTH(description) as desc_length
FROM pipeline_stages
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556'
ORDER BY position;

-- ============================================
-- EXPECTED OUTPUT:
-- ============================================
-- New Lead   | 800+  | 70+
-- Qualified  | 900+  | 70+
-- Hot Lead   | 900+  | 70+
-- Unmatched  | 64    | 20+
--
-- All stages now have comprehensive prompts!
-- ============================================





