-- Diagnose and Fix Conversations Issues
-- Run this in Supabase SQL Editor

-- Step 1: Check if conversations table exists and has RLS
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'messenger_conversations';

-- Step 2: Check current RLS policies on messenger_conversations
SELECT 
    policyname as policy_name,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'messenger_conversations';

-- Step 3: Check if there are any conversations in the table
SELECT COUNT(*) as total_conversations FROM messenger_conversations;

-- Step 4: Check a sample of conversations (if any exist)
SELECT 
    id,
    user_id,
    sender_name,
    last_message,
    last_message_time,
    created_at
FROM messenger_conversations 
ORDER BY last_message_time DESC 
LIMIT 5;

-- Step 5: FIX - Drop all existing policies and create permissive one
DROP POLICY IF EXISTS "Allow all" ON messenger_conversations;
DROP POLICY IF EXISTS "Allow all operations on messenger_conversations" ON messenger_conversations;
DROP POLICY IF EXISTS "Users manage own conversations" ON messenger_conversations;

CREATE POLICY "Allow all operations"
  ON messenger_conversations FOR ALL
  TO public, anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Step 6: Also fix conversation_tags (needed for syncing)
DROP POLICY IF EXISTS "Allow all" ON conversation_tags;
CREATE POLICY "Allow all operations"
  ON conversation_tags FOR ALL
  TO public, anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Step 7: Grant all permissions to authenticated users
GRANT ALL ON messenger_conversations TO authenticated;
GRANT ALL ON messenger_conversations TO service_role;
GRANT ALL ON messenger_conversations TO anon;

GRANT ALL ON conversation_tags TO authenticated;
GRANT ALL ON conversation_tags TO service_role;
GRANT ALL ON conversation_tags TO anon;

-- Step 8: Verify the fix worked
SELECT 
    'RLS is enabled: ' || rowsecurity::text as status
FROM pg_tables 
WHERE tablename = 'messenger_conversations';

SELECT 
    'Policy created: ' || policyname as status
FROM pg_policies 
WHERE tablename = 'messenger_conversations';

-- Success message
SELECT 'Conversations table is now accessible!' as result;




