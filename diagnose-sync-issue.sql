-- ============================================
-- 🔍 Comprehensive Sync Diagnostic Script
-- ============================================
-- Run this in Supabase SQL Editor to diagnose sync issues

-- 1. Check if last_synced_at column exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'facebook_pages'
  AND column_name = 'last_synced_at';

-- If empty result, you need to run:
-- ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ============================================

-- 2. Check Facebook pages and their tokens
SELECT 
  id,
  name,
  facebook_page_id,
  user_id,
  last_synced_at,
  CASE 
    WHEN access_token IS NULL THEN '❌ Missing'
    WHEN LENGTH(access_token) < 50 THEN '⚠️ Too Short (Invalid)'
    ELSE '✅ Present'
  END as token_status,
  created_at,
  updated_at
FROM facebook_pages
ORDER BY created_at DESC;

-- ============================================

-- 3. Check conversation sync status
SELECT 
  COUNT(*) as total_conversations,
  COUNT(DISTINCT page_id) as unique_pages,
  MAX(last_message_time) as most_recent_message,
  MIN(last_message_time) as oldest_message,
  COUNT(CASE WHEN conversation_status = 'active' THEN 1 END) as active_count,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN 1 END) as synced_last_24h,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as synced_last_hour
FROM messenger_conversations;

-- ============================================

-- 4. Check for sync errors or gaps
SELECT 
  page_id,
  COUNT(*) as conversation_count,
  MAX(last_message_time) as latest_message,
  MAX(updated_at) as last_sync_update,
  AGE(NOW(), MAX(updated_at)) as time_since_last_sync
FROM messenger_conversations
GROUP BY page_id
ORDER BY last_sync_update DESC;

-- ============================================

-- 5. Check webhook events (if any)
SELECT 
  COUNT(*) as total_events,
  COUNT(DISTINCT sender_id) as unique_senders,
  MAX(event_timestamp) as most_recent_event,
  COUNT(CASE WHEN event_timestamp > NOW() - INTERVAL '1 hour' THEN 1 END) as events_last_hour
FROM contact_interaction_events
WHERE channel = 'messenger';

-- ============================================

-- 6. Test token validity (this will show if tokens are present)
SELECT 
  'Check token expiry by testing Facebook API' as next_step,
  'Visit: /api/diagnostics-facebook in your browser' as action;

-- ============================================
-- 📋 Interpretation Guide:
-- ============================================
-- 
-- **token_status = '❌ Missing'**
--   → Go to Dashboard → Pages → Connect Facebook
-- 
-- **token_status = '⚠️ Too Short'**
--   → Token corrupted, reconnect Facebook page
-- 
-- **synced_last_hour = 0**
--   → Sync not running, check if you clicked sync button
-- 
-- **time_since_last_sync > 1 day**
--   → Sync is not working, tokens may be expired
-- 
-- **most_recent_message is old (> 7 days)**
--   → Not syncing new conversations, check Facebook connection
-- 
-- ============================================

