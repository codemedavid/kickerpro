-- ================================================================
-- FORCE FULL SYNC - Clear last_synced_at to Force Full Sync
-- Run this in Supabase SQL Editor
-- ================================================================

-- This will make the next sync fetch ALL conversations
-- instead of just recent ones

-- ================================================================
-- STEP 1: Check Current Status
-- ================================================================

SELECT 
  name,
  facebook_page_id,
  last_synced_at,
  CASE 
    WHEN last_synced_at IS NULL THEN '✅ Next sync will be FULL (gets ALL conversations)'
    ELSE '❌ Next sync will be INCREMENTAL (only gets recent conversations)'
  END as current_mode
FROM facebook_pages
ORDER BY name;

-- ================================================================
-- STEP 2: Clear last_synced_at to Force Full Sync
-- ================================================================

-- Option A: Clear for ALL pages
UPDATE facebook_pages 
SET last_synced_at = NULL;

-- Option B: Clear for specific page only
-- UPDATE facebook_pages 
-- SET last_synced_at = NULL
-- WHERE facebook_page_id = 'YOUR_FACEBOOK_PAGE_ID';

-- ================================================================
-- STEP 3: Verify It Was Cleared
-- ================================================================

SELECT 
  name,
  facebook_page_id,
  last_synced_at,
  CASE 
    WHEN last_synced_at IS NULL THEN '✅ READY for full sync'
    ELSE '❌ Still has timestamp'
  END as status
FROM facebook_pages
ORDER BY name;

-- ================================================================
-- STEP 4: Check Current Conversation Count
-- ================================================================

SELECT 
  page_id,
  COUNT(*) as conversations_in_database,
  COUNT(DISTINCT sender_id) as unique_contacts,
  MIN(last_message_time) as oldest_message,
  MAX(last_message_time) as newest_message
FROM messenger_conversations
GROUP BY page_id;

-- ================================================================
-- NEXT STEP
-- ================================================================

-- After running this SQL:
-- 1. Go back to your app
-- 2. Click "Sync from Facebook" again
-- 3. It will now do a FULL sync (get ALL conversations)
-- 4. Check count increases

SELECT '✅ last_synced_at cleared! Next sync will fetch ALL conversations.' as status;

