-- ================================================================
-- DATABASE DIAGNOSTIC - Why No Conversations Being Added
-- Run this in Supabase SQL Editor
-- ================================================================

-- ================================================================
-- TEST 1: Check Current Conversation Count
-- ================================================================

SELECT 
  'TEST 1: Current Count' as test_name,
  page_id,
  COUNT(*) as total_conversations,
  MIN(created_at) as oldest_created,
  MAX(created_at) as newest_created,
  MAX(updated_at) as last_updated
FROM messenger_conversations
GROUP BY page_id;

-- ================================================================
-- TEST 2: Check Unique Constraint
-- ================================================================

-- This constraint determines if conversations can be inserted
SELECT 
  'TEST 2: Unique Constraint' as test_name,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'messenger_conversations'::regclass
  AND contype = 'u';  -- unique constraints

-- ================================================================
-- TEST 3: Check for Duplicate Violations
-- ================================================================

SELECT 
  'TEST 3: Potential Duplicates' as test_name,
  page_id,
  sender_id,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id) as conversation_ids
FROM messenger_conversations
GROUP BY page_id, sender_id
HAVING COUNT(*) > 1;

-- ================================================================
-- TEST 4: Check RLS Policies
-- ================================================================

SELECT 
  'TEST 4: RLS Policies' as test_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'messenger_conversations';

-- ================================================================
-- TEST 5: Test Manual Insert
-- ================================================================

-- Try to manually insert a test conversation
INSERT INTO messenger_conversations (
  user_id,
  page_id,
  sender_id,
  sender_name,
  last_message_time,
  conversation_status
)
VALUES (
  (SELECT id FROM users LIMIT 1),  -- Your user ID
  'test_page_id_12345',
  'test_sender_id_67890',
  'Test Contact',
  NOW(),
  'active'
)
ON CONFLICT (page_id, sender_id) 
DO UPDATE SET 
  updated_at = NOW(),
  sender_name = EXCLUDED.sender_name
RETURNING 
  id,
  created_at,
  updated_at,
  CASE 
    WHEN created_at = updated_at THEN 'INSERTED (new)'
    ELSE 'UPDATED (existing)'
  END as action;

-- ================================================================
-- TEST 6: Check Last Sync Timestamp
-- ================================================================

SELECT 
  'TEST 6: Last Sync Time' as test_name,
  name,
  facebook_page_id,
  last_synced_at,
  CASE 
    WHEN last_synced_at IS NULL THEN '✅ Will do FULL sync'
    WHEN last_synced_at > NOW() - INTERVAL '1 hour' THEN '⚠️ Synced recently - incremental mode'
    ELSE '✅ Old sync - will get updates'
  END as sync_mode,
  EXTRACT(EPOCH FROM (NOW() - last_synced_at))/60 as minutes_since_sync
FROM facebook_pages;

-- ================================================================
-- TEST 7: Check User ID Matching
-- ================================================================

SELECT 
  'TEST 7: User ID Check' as test_name,
  u.id as user_id,
  u.email,
  COUNT(DISTINCT mc.id) as conversations_count,
  COUNT(DISTINCT fp.id) as pages_count
FROM users u
LEFT JOIN facebook_pages fp ON fp.user_id = u.id
LEFT JOIN messenger_conversations mc ON mc.user_id = u.id
GROUP BY u.id, u.email;

-- ================================================================
-- TEST 8: Check Table Permissions
-- ================================================================

SELECT 
  'TEST 8: Table Owner & Permissions' as test_name,
  tableowner,
  tablename,
  hasindexes,
  hastriggers,
  rowsecurity as has_rls
FROM pg_tables
WHERE tablename = 'messenger_conversations';

-- ================================================================
-- TEST 9: Check Recent Sync Attempts
-- ================================================================

-- Check if conversations were created recently but not showing up
SELECT 
  'TEST 9: Recent Activity' as test_name,
  COUNT(*) as conversations_created_last_hour,
  COUNT(DISTINCT page_id) as pages_affected,
  MAX(created_at) as most_recent_creation
FROM messenger_conversations
WHERE created_at > NOW() - INTERVAL '1 hour';

-- ================================================================
-- CLEANUP: Remove Test Data
-- ================================================================

-- Remove the test insert from TEST 5
DELETE FROM messenger_conversations
WHERE sender_id = 'test_sender_id_67890';

-- ================================================================
-- SUMMARY
-- ================================================================

SELECT 
  '=== SUMMARY ===' as section,
  (SELECT COUNT(*) FROM messenger_conversations) as total_conversations_in_db,
  (SELECT COUNT(*) FROM facebook_pages) as total_pages_connected,
  (SELECT COUNT(*) FROM users) as total_users;

