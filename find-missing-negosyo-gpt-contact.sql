-- Find the missing contact in Negosyo GPT page
-- You have 15 conversations but only 14 recommendations

-- STEP 1: Find the exact conversation that's missing a recommendation
SELECT 
  'Missing Recommendation' as status,
  mc.id as conversation_id,
  mc.sender_name,
  mc.sender_id,
  mc.last_message_time,
  mc.message_count,
  mc.created_at
FROM messenger_conversations mc
LEFT JOIN contact_timing_recommendations ctr 
  ON mc.id = ctr.conversation_id
WHERE mc.page_id = '834334336429385' -- Negosyo GPT
  AND ctr.id IS NULL -- No recommendation exists
ORDER BY mc.last_message_time DESC;

-- STEP 2: Check if this contact has interaction events
SELECT 
  'Interaction Events Check' as status,
  mc.sender_name,
  mc.id as conversation_id,
  COUNT(cie.id) as event_count,
  MIN(cie.event_timestamp) as first_event,
  MAX(cie.event_timestamp) as last_event
FROM messenger_conversations mc
LEFT JOIN contact_interaction_events cie 
  ON mc.id = cie.conversation_id
LEFT JOIN contact_timing_recommendations ctr 
  ON mc.id = ctr.conversation_id
WHERE mc.page_id = '834334336429385'
  AND ctr.id IS NULL
GROUP BY mc.sender_name, mc.id;

-- STEP 3: Compare all conversations vs recommendations for Negosyo GPT
SELECT 
  mc.sender_name,
  mc.sender_id,
  mc.last_message_time,
  CASE 
    WHEN ctr.id IS NOT NULL THEN '✅ Has Recommendation'
    ELSE '❌ Missing Recommendation'
  END as status,
  ctr.composite_score,
  ctr.last_computed_at
FROM messenger_conversations mc
LEFT JOIN contact_timing_recommendations ctr 
  ON mc.id = ctr.conversation_id
WHERE mc.page_id = '834334336429385'
ORDER BY 
  CASE WHEN ctr.id IS NULL THEN 0 ELSE 1 END, -- Missing first
  mc.last_message_time DESC;

-- STEP 4: Get the conversation ID to recompute
-- Copy this ID and use it in the next step
SELECT 
  '🎯 USE THIS ID TO RECOMPUTE' as action,
  mc.id as conversation_id_to_compute,
  mc.sender_name,
  mc.sender_id
FROM messenger_conversations mc
LEFT JOIN contact_timing_recommendations ctr 
  ON mc.id = ctr.conversation_id
WHERE mc.page_id = '834334336429385'
  AND ctr.id IS NULL;

-- ============================================
-- SOLUTION AFTER RUNNING THE ABOVE QUERIES:
-- ============================================
-- 
-- Option A: In the UI
-- 1. Go to Best Time to Contact page
-- 2. Filter by "Negosyo GPT"
-- 3. Click "Compute All" button
-- 4. Should process the 1 missing contact
-- 
-- Option B: Via API (if you have the conversation ID from above)
-- In browser console on Best Time to Contact page:
-- 
-- fetch('/api/contact-timing/compute', {
--   method: 'POST',
--   headers: { 'Content-Type': 'application/json' },
--   body: JSON.stringify({
--     conversation_ids: ['PASTE_CONVERSATION_ID_FROM_STEP_4']
--   })
-- }).then(r => r.json()).then(console.log)

