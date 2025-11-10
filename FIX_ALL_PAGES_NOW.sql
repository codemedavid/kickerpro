-- ================================================================
-- PERMANENT FIX: Clear ALL Pages - Get ALL Conversations
-- This fixes the issue for ALL pages, ALL users
-- Run this in Supabase SQL Editor
-- ================================================================

-- ================================================================
-- STEP 1: Show Current Status (All Pages)
-- ================================================================

SELECT 
  '=== BEFORE CLEARING ===' as section,
  name,
  facebook_page_id,
  last_synced_at,
  EXTRACT(EPOCH FROM (NOW() - last_synced_at))/60 as minutes_ago,
  (SELECT COUNT(*) FROM messenger_conversations mc WHERE mc.page_id = fp.facebook_page_id) as conversations
FROM facebook_pages fp
ORDER BY name;

-- ================================================================
-- STEP 2: Clear last_synced_at for ALL Pages
-- ================================================================

UPDATE facebook_pages 
SET last_synced_at = NULL;

-- ================================================================
-- STEP 3: Verify All Pages Cleared
-- ================================================================

SELECT 
  '=== AFTER CLEARING ===' as section,
  name,
  facebook_page_id,
  last_synced_at,
  CASE 
    WHEN last_synced_at IS NULL THEN '✅ Ready for FULL sync'
    ELSE '❌ Still has timestamp'
  END as status,
  (SELECT COUNT(*) FROM messenger_conversations mc WHERE mc.page_id = fp.facebook_page_id) as current_conversations
FROM facebook_pages fp
ORDER BY name;

-- ================================================================
-- STEP 4: Summary
-- ================================================================

SELECT 
  '=== SUMMARY ===' as section,
  COUNT(*) as total_pages,
  SUM(CASE WHEN last_synced_at IS NULL THEN 1 ELSE 0 END) as pages_ready_for_full_sync,
  (SELECT COUNT(*) FROM messenger_conversations) as total_conversations_before_sync
FROM facebook_pages;

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

SELECT 
  '✅ ALL PAGES CLEARED!' as status,
  'Next: Go to /admin/sync-all and click "Force Full Sync ALL Pages"' as action,
  'Will fetch ALL conversations from ALL pages' as expected,
  'Time: 10-20 minutes for all 26 pages' as duration,
  'Result: Complete conversation data for all pages' as result;

