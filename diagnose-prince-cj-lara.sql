-- Diagnostic Query: Find Missing Contact in Best Time to Contact
-- Run this to see why Prince CJ Lara is not appearing

-- STEP 1: Check if Prince CJ Lara exists in messenger_conversations
SELECT 
  'STEP 1: Conversations' as check_type,
  id,
  user_id,
  page_id,
  sender_id,
  sender_name,
  last_message_time,
  created_at
FROM messenger_conversations
WHERE sender_name ILIKE '%prince%cj%lara%'
   OR sender_name ILIKE '%prince cj%'
   OR sender_name ILIKE '%cj lara%';

-- STEP 2: Check if Prince CJ Lara has interaction events
SELECT 
  'STEP 2: Interaction Events' as check_type,
  ce.id,
  ce.conversation_id,
  ce.sender_id,
  ce.event_type,
  ce.event_timestamp,
  ce.is_outbound,
  ce.is_success,
  mc.sender_name,
  mc.page_id
FROM contact_interaction_events ce
JOIN messenger_conversations mc ON ce.conversation_id = mc.id
WHERE mc.sender_name ILIKE '%prince%cj%lara%'
   OR mc.sender_name ILIKE '%prince cj%'
   OR mc.sender_name ILIKE '%cj lara%'
ORDER BY ce.event_timestamp DESC
LIMIT 20;

-- STEP 3: Check if Prince CJ Lara has a timing recommendation
SELECT 
  'STEP 3: Timing Recommendations' as check_type,
  ctr.id,
  ctr.conversation_id,
  ctr.sender_name,
  ctr.timezone,
  ctr.composite_score,
  ctr.is_active,
  ctr.cooldown_until,
  ctr.last_computed_at,
  mc.page_id
FROM contact_timing_recommendations ctr
JOIN messenger_conversations mc ON ctr.conversation_id = mc.id
WHERE ctr.sender_name ILIKE '%prince%cj%lara%'
   OR ctr.sender_name ILIKE '%prince cj%'
   OR ctr.sender_name ILIKE '%cj lara%';

-- STEP 4: Check all conversations for your selected page
-- Replace 'YOUR_PAGE_ID_HERE' with the actual page ID you're filtering by
SELECT 
  'STEP 4: All Conversations for Page' as check_type,
  mc.id,
  mc.page_id,
  mc.sender_name,
  mc.sender_id,
  mc.last_message_time,
  CASE 
    WHEN ctr.id IS NOT NULL THEN 'Has Recommendation'
    ELSE 'Missing Recommendation'
  END as has_recommendation
FROM messenger_conversations mc
LEFT JOIN contact_timing_recommendations ctr ON mc.id = ctr.conversation_id
WHERE mc.page_id = 'YOUR_PAGE_ID_HERE'
ORDER BY mc.last_message_time DESC;

-- STEP 5: Check if user_id matches between conversations and recommendations
SELECT 
  'STEP 5: User ID Mismatch Check' as check_type,
  mc.id as conversation_id,
  mc.sender_name,
  mc.user_id as conversation_user_id,
  mc.page_id,
  ctr.id as recommendation_id,
  ctr.user_id as recommendation_user_id,
  CASE 
    WHEN mc.user_id = ctr.user_id THEN 'MATCH'
    WHEN ctr.id IS NULL THEN 'NO RECOMMENDATION'
    ELSE 'MISMATCH!'
  END as user_id_status
FROM messenger_conversations mc
LEFT JOIN contact_timing_recommendations ctr ON mc.id = ctr.conversation_id
WHERE mc.sender_name ILIKE '%prince%'
   OR mc.sender_name ILIKE '%cj%'
   OR mc.sender_name ILIKE '%lara%';

-- STEP 6: Count total conversations vs recommendations by page
SELECT 
  'STEP 6: Conversations vs Recommendations Count' as check_type,
  mc.page_id,
  fp.name as page_name,
  COUNT(DISTINCT mc.id) as total_conversations,
  COUNT(DISTINCT ctr.id) as total_recommendations,
  COUNT(DISTINCT mc.id) - COUNT(DISTINCT ctr.id) as missing_recommendations
FROM messenger_conversations mc
LEFT JOIN facebook_pages fp ON mc.page_id = fp.facebook_page_id
LEFT JOIN contact_timing_recommendations ctr ON mc.id = ctr.conversation_id
GROUP BY mc.page_id, fp.name
ORDER BY missing_recommendations DESC;

