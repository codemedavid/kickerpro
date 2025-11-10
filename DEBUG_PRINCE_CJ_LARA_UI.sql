-- DEBUG: Why Prince CJ Lara is NOT showing in Best Time to Contact UI
-- Conversation ID: 25db0e5e-83c9-4bf0-a40a-1e6e39ebc37f

-- ============================================
-- STEP 1: CHECK IF RECOMMENDATION EXISTS
-- ============================================
SELECT 
  '1️⃣ RECOMMENDATION CHECK' as step,
  ctr.id,
  ctr.user_id,
  ctr.conversation_id,
  ctr.sender_name,
  ctr.is_active,
  ctr.cooldown_until,
  ctr.composite_score,
  ctr.last_computed_at
FROM contact_timing_recommendations ctr
WHERE ctr.conversation_id = '25db0e5e-83c9-4bf0-a40a-1e6e39ebc37f';

-- If this returns NO ROWS → Compute never ran or failed
-- If this returns rows but is_active = false → Contact is deactivated
-- If this returns rows but cooldown_until is in the future → Contact is in cooldown

-- ============================================
-- STEP 2: CHECK CONVERSATION DETAILS
-- ============================================
SELECT 
  '2️⃣ CONVERSATION CHECK' as step,
  mc.id,
  mc.user_id,
  mc.page_id,
  mc.sender_name,
  mc.sender_id,
  mc.last_message_time,
  mc.conversation_status,
  fp.name as page_name
FROM messenger_conversations mc
LEFT JOIN facebook_pages fp ON mc.page_id = fp.facebook_page_id
WHERE mc.id = '25db0e5e-83c9-4bf0-a40a-1e6e39ebc37f';

-- ============================================
-- STEP 3: CHECK USER_ID MATCH
-- ============================================
SELECT 
  '3️⃣ USER_ID MISMATCH CHECK' as step,
  mc.user_id as conversation_user_id,
  ctr.user_id as recommendation_user_id,
  CASE 
    WHEN mc.user_id = ctr.user_id THEN '✅ MATCH'
    WHEN ctr.id IS NULL THEN '⚠️ NO RECOMMENDATION'
    ELSE '❌ MISMATCH - THIS IS THE PROBLEM!'
  END as status
FROM messenger_conversations mc
LEFT JOIN contact_timing_recommendations ctr 
  ON mc.id = ctr.conversation_id
WHERE mc.id = '25db0e5e-83c9-4bf0-a40a-1e6e39ebc37f';

-- ============================================
-- STEP 4: CHECK IF PAGE EXISTS IN YOUR PAGES
-- ============================================
SELECT 
  '4️⃣ PAGE OWNERSHIP CHECK' as step,
  fp.facebook_page_id,
  fp.name,
  fp.user_id,
  mc.page_id as conversation_page_id,
  CASE 
    WHEN fp.facebook_page_id IS NOT NULL THEN '✅ You own this page'
    ELSE '❌ Page not in your facebook_pages table'
  END as status
FROM messenger_conversations mc
LEFT JOIN facebook_pages fp ON mc.page_id = fp.facebook_page_id
WHERE mc.id = '25db0e5e-83c9-4bf0-a40a-1e6e39ebc37f';

-- ============================================
-- STEP 5: CHECK INTERACTION EVENTS
-- ============================================
SELECT 
  '5️⃣ INTERACTION EVENTS CHECK' as step,
  COUNT(*) as total_events,
  COUNT(CASE WHEN is_outbound THEN 1 END) as outbound_events,
  COUNT(CASE WHEN is_success THEN 1 END) as success_events,
  MIN(event_timestamp) as first_event,
  MAX(event_timestamp) as last_event
FROM contact_interaction_events
WHERE conversation_id = '25db0e5e-83c9-4bf0-a40a-1e6e39ebc37f';

-- If total_events = 0 → No events to compute from, algorithm will fail

-- ============================================
-- STEP 6: WHAT THE UI QUERY WOULD SEE
-- ============================================
-- This simulates what the Best Time to Contact page query does
SELECT 
  '6️⃣ WHAT UI SEES' as step,
  ctr.id,
  ctr.sender_name,
  ctr.composite_score,
  ctr.is_active,
  ctr.cooldown_until,
  mc.page_id,
  fp.name as page_name,
  NOW() as current_time,
  CASE 
    WHEN ctr.id IS NULL THEN '❌ No recommendation = NOT VISIBLE'
    WHEN ctr.is_active = false THEN '❌ Inactive = NOT VISIBLE'
    WHEN ctr.cooldown_until > NOW() THEN '❌ In cooldown = NOT VISIBLE'
    ELSE '✅ SHOULD BE VISIBLE'
  END as visibility_status
FROM contact_timing_recommendations ctr
JOIN messenger_conversations mc ON ctr.conversation_id = mc.id
LEFT JOIN facebook_pages fp ON mc.page_id = fp.facebook_page_id
WHERE ctr.conversation_id = '25db0e5e-83c9-4bf0-a40a-1e6e39ebc37f';

-- ============================================
-- STEP 7: CHECK YOUR CURRENT USER_ID
-- ============================================
SELECT 
  '7️⃣ YOUR USER ID' as step,
  id as your_user_id,
  email
FROM users
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- DIAGNOSIS GUIDE
-- ============================================
-- 
-- STEP 1 returns NO ROWS?
--   → Compute was never run or failed
--   → FIX: Run compute via API or UI
--
-- STEP 1 shows is_active = false?
--   → Contact was deactivated
--   → FIX: UPDATE contact_timing_recommendations SET is_active = true WHERE conversation_id = '...'
--
-- STEP 1 shows cooldown_until in the future?
--   → Contact is in cooldown period
--   → FIX: UPDATE contact_timing_recommendations SET cooldown_until = NULL WHERE conversation_id = '...'
--
-- STEP 3 shows MISMATCH?
--   → Conversation has different user_id than recommendation
--   → FIX: Delete recommendation and recompute, or fix user_id
--
-- STEP 4 shows page not owned?
--   → You don't have access to this page
--   → FIX: This is a data issue, contact shouldn't be in your conversations
--
-- STEP 5 shows 0 events?
--   → No interaction history to compute from
--   → FIX: Sync conversation again to create events
--
-- STEP 6 shows "SHOULD BE VISIBLE" but you don't see it?
--   → Clear browser cache and refresh
--   → Check if you're filtering by the wrong page

