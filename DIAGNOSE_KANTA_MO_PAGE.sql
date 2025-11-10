-- ================================================================
-- DIAGNOSTIC: Why "Kanta Mo Kwento Mo" Not Fetching All Contacts
-- Run this in Supabase SQL Editor
-- ================================================================

-- ================================================================
-- STEP 1: Find the Page
-- ================================================================

SELECT 
  '=== STEP 1: Find Kanta Mo Kwento Mo Page ===' as step,
  id as page_id,
  facebook_page_id,
  name,
  last_synced_at,
  CASE 
    WHEN last_synced_at IS NULL THEN '✅ Will do FULL sync'
    WHEN last_synced_at > NOW() - INTERVAL '15 minutes' THEN '⚠️ Will do INCREMENTAL (synced recently)'
    ELSE '✅ Will do FULL sync (synced >15 min ago)'
  END as next_sync_mode,
  access_token IS NOT NULL as has_token,
  LENGTH(access_token) as token_length
FROM facebook_pages
WHERE name ILIKE '%kanta%mo%'
   OR name ILIKE '%kwento%mo%'
ORDER BY name;

-- ================================================================
-- STEP 2: Count Current Conversations for This Page
-- ================================================================

SELECT 
  '=== STEP 2: Current Count ===' as step,
  COUNT(*) as total_conversations,
  COUNT(DISTINCT sender_id) as unique_contacts,
  MIN(last_message_time) as oldest_message,
  MAX(last_message_time) as newest_message,
  MIN(created_at) as first_synced,
  MAX(created_at) as last_synced
FROM messenger_conversations
WHERE page_id IN (
  SELECT facebook_page_id 
  FROM facebook_pages 
  WHERE name ILIKE '%kanta%mo%' 
     OR name ILIKE '%kwento%mo%'
);

-- ================================================================
-- STEP 3: Check if Participants Are Being Filtered
-- ================================================================

-- Check for conversations where all participants were filtered out
SELECT 
  '=== STEP 3: Filtering Check ===' as step,
  'This shows if participant filtering is causing issues' as info;

-- Note: We can't directly check Facebook data, but we can check patterns

-- ================================================================
-- STEP 4: Compare to Other Pages
-- ================================================================

SELECT 
  '=== STEP 4: Page Comparison ===' as step,
  fp.name,
  COUNT(mc.id) as conversations,
  COUNT(DISTINCT mc.sender_id) as unique_contacts,
  MAX(mc.last_message_time) as most_recent_message
FROM facebook_pages fp
LEFT JOIN messenger_conversations mc ON mc.page_id = fp.facebook_page_id
GROUP BY fp.id, fp.name
ORDER BY conversations DESC;

-- ================================================================
-- STEP 5: Check for Sync Errors
-- ================================================================

SELECT 
  '=== STEP 5: Recent Sync Activity ===' as step,
  name,
  last_synced_at,
  EXTRACT(EPOCH FROM (NOW() - last_synced_at))/60 as minutes_ago,
  CASE 
    WHEN last_synced_at IS NULL THEN 'Never synced'
    WHEN last_synced_at > NOW() - INTERVAL '15 minutes' THEN 'Very recent (<15 min) - will use incremental'
    WHEN last_synced_at > NOW() - INTERVAL '1 hour' THEN 'Recent (<1 hour) - will use FULL'
    WHEN last_synced_at > NOW() - INTERVAL '24 hours' THEN 'Today - will use FULL'
    ELSE 'Old sync - will use FULL'
  END as sync_mode_next
FROM facebook_pages
WHERE name ILIKE '%kanta%mo%' 
   OR name ILIKE '%kwento%mo%';

-- ================================================================
-- STEP 6: Get Sample Conversation Data
-- ================================================================

SELECT 
  '=== STEP 6: Sample Data ===' as step,
  sender_id,
  sender_name,
  last_message_time,
  created_at,
  conversation_status
FROM messenger_conversations
WHERE page_id IN (
  SELECT facebook_page_id 
  FROM facebook_pages 
  WHERE name ILIKE '%kanta%mo%' 
     OR name ILIKE '%kwento%mo%'
)
ORDER BY last_message_time DESC
LIMIT 10;

-- ================================================================
-- STEP 7: Clear Last Sync for This Page ONLY
-- ================================================================

-- Uncomment and run this to force full sync for just this page:
/*
UPDATE facebook_pages 
SET last_synced_at = NULL
WHERE name ILIKE '%kanta%mo%' 
   OR name ILIKE '%kwento%mo%';

SELECT 
  'Cleared! Run sync now for this page.' as status,
  name,
  last_synced_at
FROM facebook_pages
WHERE name ILIKE '%kanta%mo%' 
   OR name ILIKE '%kwento%mo%';
*/

-- ================================================================
-- SUMMARY & RECOMMENDATIONS
-- ================================================================

SELECT 
  '=== SUMMARY ===' as section,
  (SELECT COUNT(*) FROM messenger_conversations WHERE page_id IN (
    SELECT facebook_page_id FROM facebook_pages WHERE name ILIKE '%kanta%mo%' OR name ILIKE '%kwento%mo%'
  )) as kanta_mo_conversations,
  (SELECT COUNT(*) FROM messenger_conversations) as total_all_pages,
  (SELECT COUNT(*) FROM facebook_pages WHERE name ILIKE '%kanta%mo%') as pages_found;

-- ================================================================
-- NEXT STEPS
-- ================================================================

SELECT 
  '=== NEXT STEPS ===' as section,
  CASE 
    WHEN (SELECT COUNT(*) FROM facebook_pages WHERE name ILIKE '%kanta%mo%') = 0 
      THEN '❌ Page not found - check page name spelling'
    WHEN (SELECT last_synced_at FROM facebook_pages WHERE name ILIKE '%kanta%mo%' LIMIT 1) IS NULL
      THEN '✅ Ready for full sync - just click sync button'
    WHEN (SELECT last_synced_at FROM facebook_pages WHERE name ILIKE '%kanta%mo%' LIMIT 1) > NOW() - INTERVAL '15 minutes'
      THEN '⚠️ Synced recently - will use incremental. Wait 15 min OR uncomment STEP 7 to force full'
    ELSE '✅ Will use FULL sync automatically - just click sync button'
  END as recommendation;

