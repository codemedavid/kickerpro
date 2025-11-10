-- ============================================
-- 🔧 Fix Common Sync Issues
-- ============================================
-- Run these queries ONE BY ONE in Supabase SQL Editor
-- Check the diagnostic results first to know which fixes you need

-- ============================================
-- FIX #1: Add missing last_synced_at column (Required for incremental sync)
-- ============================================

ALTER TABLE facebook_pages 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_facebook_pages_last_synced_at 
ON facebook_pages(last_synced_at);

-- ============================================
-- FIX #2: Reset sync timestamps (if sync is stuck)
-- ============================================

-- Run this if you want to force a full sync instead of incremental
-- UPDATE facebook_pages SET last_synced_at = NULL;

-- ============================================
-- FIX #3: Clean up duplicate conversations (if any)
-- ============================================

-- Find duplicates
SELECT 
  page_id,
  sender_id,
  COUNT(*) as duplicate_count
FROM messenger_conversations
GROUP BY page_id, sender_id
HAVING COUNT(*) > 1;

-- If you see duplicates, run this to keep only the most recent:
-- WITH duplicates AS (
--   SELECT 
--     id,
--     ROW_NUMBER() OVER (
--       PARTITION BY page_id, sender_id 
--       ORDER BY updated_at DESC
--     ) as rn
--   FROM messenger_conversations
-- )
-- DELETE FROM messenger_conversations
-- WHERE id IN (
--   SELECT id FROM duplicates WHERE rn > 1
-- );

-- ============================================
-- FIX #4: Ensure unique constraints exist
-- ============================================

-- Check if unique constraint exists
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'messenger_conversations'::regclass;

-- If no unique constraint on (page_id, sender_id), add it:
-- Note: Remove duplicates first using FIX #3!
-- ALTER TABLE messenger_conversations
-- ADD CONSTRAINT messenger_conversations_page_sender_unique
-- UNIQUE (page_id, sender_id);

-- ============================================
-- FIX #5: Verify RLS policies (if sync returns empty)
-- ============================================

-- Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('facebook_pages', 'messenger_conversations');

-- Check existing policies
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('facebook_pages', 'messenger_conversations');

-- ============================================
-- FIX #6: Create missing RLS policies (if needed)
-- ============================================

-- If you see RLS is enabled but no policies exist, add them:

-- For facebook_pages:
-- CREATE POLICY "Users can view their own pages"
-- ON facebook_pages FOR SELECT
-- USING (true);  -- Or use: user_id = current_user_id()

-- CREATE POLICY "Users can update their own pages"
-- ON facebook_pages FOR UPDATE
-- USING (true);

-- For messenger_conversations:
-- CREATE POLICY "Users can view conversations from their pages"
-- ON messenger_conversations FOR SELECT
-- USING (true);

-- CREATE POLICY "Users can insert conversations"
-- ON messenger_conversations FOR INSERT
-- WITH CHECK (true);

-- CREATE POLICY "Users can update conversations"
-- ON messenger_conversations FOR UPDATE
-- USING (true);

-- ============================================
-- FIX #7: Test sync is working (Run after fixes)
-- ============================================

-- Check if new conversations are being added
SELECT 
  COUNT(*) as conversations_added_in_last_5_minutes
FROM messenger_conversations
WHERE created_at > NOW() - INTERVAL '5 minutes';

-- If 0, sync is not running or tokens are invalid
-- Go to /api/diagnostics-facebook to test Facebook connection

-- ============================================
-- 📋 Post-Fix Verification
-- ============================================

-- Run these to verify everything is working:

-- 1. Check column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'facebook_pages' AND column_name = 'last_synced_at';
-- Expected: 1 row with 'last_synced_at'

-- 2. Check no duplicates
SELECT page_id, sender_id, COUNT(*) as count
FROM messenger_conversations
GROUP BY page_id, sender_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)

-- 3. Check recent sync activity
SELECT 
  MAX(created_at) as last_conversation_added,
  MAX(updated_at) as last_conversation_updated
FROM messenger_conversations;
-- These should be recent if sync is working

-- ============================================

