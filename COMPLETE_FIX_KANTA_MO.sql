-- ================================================================
-- COMPLETE FIX: Get ALL Kanta Mo Kwento Mo Contacts
-- Run this in Supabase SQL Editor (ALL STEPS)
-- ================================================================

-- ================================================================
-- STEP 1: Check Current Status
-- ================================================================

SELECT 
  '=== CURRENT STATUS ===' as section,
  fp.name,
  fp.facebook_page_id,
  COUNT(mc.id) as conversations_in_db,
  fp.last_synced_at,
  EXTRACT(EPOCH FROM (NOW() - fp.last_synced_at))/60 as minutes_ago
FROM facebook_pages fp
LEFT JOIN messenger_conversations mc ON mc.page_id = fp.facebook_page_id
WHERE fp.facebook_page_id = '505302195998738'  -- Kanta mo, kwento mo
GROUP BY fp.id, fp.name, fp.facebook_page_id, fp.last_synced_at;

-- ================================================================
-- STEP 2: Clear Last Sync to Force FULL Sync
-- ================================================================

UPDATE facebook_pages 
SET last_synced_at = NULL
WHERE facebook_page_id = '505302195998738';  -- Kanta mo, kwento mo

-- ================================================================
-- STEP 3: Verify It Was Cleared
-- ================================================================

SELECT 
  '=== AFTER CLEARING ===' as section,
  name,
  facebook_page_id,
  last_synced_at,
  CASE 
    WHEN last_synced_at IS NULL THEN '✅ READY for full sync'
    ELSE '❌ Still has timestamp'
  END as status
FROM facebook_pages
WHERE facebook_page_id = '505302195998738';

-- ================================================================
-- STEP 4: Check Total Conversations Before Sync
-- ================================================================

SELECT 
  '=== BEFORE SYNC ===' as section,
  COUNT(*) as conversations_before_sync
FROM messenger_conversations
WHERE page_id = '505302195998738';

-- ================================================================
-- INSTRUCTIONS FOR NEXT STEP
-- ================================================================

SELECT 
  '=== NEXT STEP ===' as instructions,
  'Go to /admin/sync-all and click "Force Full Sync ALL Pages"' as action,
  'This will fetch ALL conversations from Facebook for this page' as what_happens,
  'Expected: 1,000-10,000+ conversations' as expected_result;

-- ================================================================
-- STEP 5: After Sync - Verify New Conversations
-- ================================================================

-- Run this AFTER you click sync button:
/*
SELECT 
  '=== AFTER SYNC ===' as section,
  COUNT(*) as conversations_after_sync,
  COUNT(*) - (SELECT COUNT(*) FROM messenger_conversations WHERE page_id = '505302195998738' AND created_at < NOW() - INTERVAL '5 minutes') as new_conversations_added
FROM messenger_conversations
WHERE page_id = '505302195998738';
*/

-- ================================================================
-- STEP 6: Check if Contacts Show in Best Time Page
-- ================================================================

-- Run this after sync and compute:
/*
SELECT 
  '=== BEST TIME TO CONTACT ===' as section,
  COUNT(mc.id) as total_conversations,
  COUNT(ctr.id) as has_timing_recommendations,
  COUNT(mc.id) - COUNT(ctr.id) as missing_recommendations
FROM messenger_conversations mc
LEFT JOIN contact_timing_recommendations ctr ON ctr.conversation_id = mc.id
WHERE mc.page_id = '505302195998738';
*/

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

SELECT 
  '✅ last_synced_at cleared for Kanta Mo Kwento Mo!' as status,
  'NOW: Go to /admin/sync-all and click sync button' as next_action,
  'Will fetch ALL conversations from Facebook' as expected;

