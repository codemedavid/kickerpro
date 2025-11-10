-- Compute timing for "Kanta mo, kwento mo" page contacts
-- This will help identify the conversation IDs that need computing

-- Step 1: Get all conversation IDs for "Kanta mo, kwento mo" page
SELECT 
  'Conversations needing computation' as info,
  mc.id as conversation_id,
  mc.sender_name,
  mc.sender_id,
  mc.last_message_time,
  mc.user_id
FROM messenger_conversations mc
LEFT JOIN contact_timing_recommendations ctr 
  ON mc.id = ctr.conversation_id
WHERE mc.page_id = '505302195998738' -- Kanta mo, kwento mo
  AND ctr.id IS NULL -- No recommendation exists
ORDER BY mc.last_message_time DESC
LIMIT 50; -- Show first 50 for verification

-- Step 2: Count by user to verify correct user_id
SELECT 
  'User ID verification' as info,
  mc.user_id,
  COUNT(*) as conversation_count,
  COUNT(ctr.id) as recommendation_count
FROM messenger_conversations mc
LEFT JOIN contact_timing_recommendations ctr 
  ON mc.id = ctr.conversation_id
WHERE mc.page_id = '505302195998738'
GROUP BY mc.user_id;

-- Step 3: Verify page ownership
SELECT 
  'Page ownership check' as info,
  fp.facebook_page_id,
  fp.name,
  fp.user_id,
  COUNT(mc.id) as total_conversations
FROM facebook_pages fp
LEFT JOIN messenger_conversations mc 
  ON fp.facebook_page_id = mc.page_id
WHERE fp.facebook_page_id = '505302195998738'
GROUP BY fp.facebook_page_id, fp.name, fp.user_id;

-- Step 4: Sample conversation details (to verify Prince CJ Lara is here)
SELECT 
  'Sample conversations' as info,
  mc.sender_name,
  mc.sender_id,
  mc.last_message_time,
  mc.message_count
FROM messenger_conversations mc
WHERE mc.page_id = '505302195998738'
  AND (
    mc.sender_name ILIKE '%prince%' 
    OR mc.sender_name ILIKE '%cj%' 
    OR mc.sender_name ILIKE '%lara%'
  )
ORDER BY mc.last_message_time DESC;

-- NOTES:
-- After reviewing these results:
-- 1. Go to Dashboard → Best Time to Contact
-- 2. Filter by "Kanta mo, kwento mo" page
-- 3. Click "Compute All" button
-- 4. Wait 2-5 minutes for 1,132 contacts to process
-- 5. Search for "Prince CJ Lara"

