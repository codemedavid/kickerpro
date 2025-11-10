-- ============================================
-- CREATE TEST PIPELINE OPPORTUNITIES
-- Run AFTER create-test-conversations.sql
-- ============================================

-- This script adds the test conversations to pipeline
-- so we can test the AI sorting logic

-- Get default/unmatched stage ID
SELECT id, name 
FROM pipeline_stages 
WHERE user_id = 'YOUR_USER_ID' 
  AND is_default = true;

-- Store this ID and replace DEFAULT_STAGE_ID below

-- ============================================
-- STEP 1: Add Test Conversations to Pipeline
-- ============================================

-- Insert test opportunities (all start in default stage)
INSERT INTO pipeline_opportunities (
    user_id,
    conversation_id,
    stage_id,
    sender_id,
    sender_name,
    manually_assigned,
    both_prompts_agreed,
    ai_confidence_score
)
SELECT 
    mc.user_id,
    mc.id as conversation_id,
    'DEFAULT_STAGE_ID' as stage_id,  -- Replace with actual default stage ID
    mc.sender_id,
    mc.sender_name,
    false as manually_assigned,
    null as both_prompts_agreed,
    null as ai_confidence_score
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'
  AND mc.sender_id LIKE 'test_sender%'
  AND NOT EXISTS (
    -- Don't add if already in pipeline
    SELECT 1 FROM pipeline_opportunities po
    WHERE po.conversation_id = mc.id
  );

-- ============================================
-- STEP 2: Create Stage History
-- ============================================

INSERT INTO pipeline_stage_history (
    opportunity_id,
    from_stage_id,
    to_stage_id,
    moved_by,
    moved_by_ai,
    reason
)
SELECT 
    po.id as opportunity_id,
    null as from_stage_id,
    po.stage_id as to_stage_id,
    null as moved_by,
    false as moved_by_ai,
    'Added for testing' as reason
FROM pipeline_opportunities po
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'test_sender%'
  AND NOT EXISTS (
    SELECT 1 FROM pipeline_stage_history psh
    WHERE psh.opportunity_id = po.id
  );

-- ============================================
-- STEP 3: Verify Test Opportunities Created
-- ============================================

SELECT 
    'TEST OPPORTUNITIES CREATED' as info,
    COUNT(*) as total_count
FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID'
  AND sender_id LIKE 'test_sender%';

-- List all test opportunities with expected stages
SELECT 
    po.sender_name,
    ps.name as current_stage,
    ps.is_default as in_default,
    mc.last_message,
    CASE 
        WHEN mc.last_message ILIKE '%browsing%' OR mc.last_message ILIKE '%curious%' 
            OR mc.last_message ILIKE '%tell me about%' THEN 'Expected: New Lead'
        WHEN mc.last_message ILIKE '%price%' OR mc.last_message ILIKE '%cost%' 
            OR mc.last_message ILIKE '%how much%' OR mc.last_message ILIKE '%comparing%' 
            OR mc.last_message ILIKE '%interested in%' THEN 'Expected: Qualified'
        WHEN mc.last_message ILIKE '%ready%' OR mc.last_message ILIKE '%buy%' 
            OR mc.last_message ILIKE '%purchase%' OR mc.last_message ILIKE '%URGENT%' 
            OR mc.last_message ILIKE '%ASAP%' OR mc.last_message ILIKE '%quote%' THEN 'Expected: Hot Lead'
        ELSE 'Expected: Unknown'
    END as expected_stage,
    po.created_at
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
JOIN messenger_conversations mc ON po.conversation_id = mc.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'test_sender%'
ORDER BY po.created_at DESC;

-- ============================================
-- STEP 4: Get Opportunity IDs for Testing
-- ============================================

-- Copy these IDs - you'll need them for the Node.js test script
SELECT 
    'OPPORTUNITY IDS FOR TESTING' as info,
    json_agg(po.id ORDER BY po.sender_name) as opportunity_ids
FROM pipeline_opportunities po
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'test_sender%';

-- Individual IDs with names for reference
SELECT 
    po.id as opportunity_id,
    po.sender_name,
    mc.last_message,
    CASE 
        WHEN mc.last_message ILIKE '%browsing%' OR mc.last_message ILIKE '%curious%' THEN 'New Lead'
        WHEN mc.last_message ILIKE '%price%' OR mc.last_message ILIKE '%interested in%' THEN 'Qualified'
        WHEN mc.last_message ILIKE '%ready%' OR mc.last_message ILIKE '%URGENT%' THEN 'Hot Lead'
    END as expected_stage
FROM pipeline_opportunities po
JOIN messenger_conversations mc ON po.conversation_id = mc.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.sender_id LIKE 'test_sender%'
ORDER BY po.sender_name;

-- ============================================
-- READY FOR TESTING
-- ============================================

/*
✅ Test conversations created
✅ Test opportunities created (in default stage)
✅ Ready to test AI analysis

NEXT STEPS:

1. Copy the opportunity_ids from STEP 4 output
2. Run the Node.js test script: node test-pipeline-sorting-logic.js
3. Or test via API in browser console
4. Check results with validate-test-results.sql

TEST COMMAND (Browser Console):
```javascript
// Replace with actual opportunity IDs from STEP 4
const testOppIds = ['id1', 'id2', 'id3', 'id4', 'id5', 'id6'];

fetch('/api/pipeline/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ opportunity_ids: testOppIds })
})
.then(r => r.json())
.then(data => {
  console.log('Analysis Results:', data);
  console.log('Analyzed:', data.analyzed);
  data.results.forEach(r => {
    console.log(`${r.contact_name}: ${r.both_agreed ? '✅' : '❌'} confidence: ${r.confidence}`);
  });
});
```
*/

