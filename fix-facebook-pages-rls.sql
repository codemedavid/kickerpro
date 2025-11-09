-- Fix RLS for Facebook Pages table
-- This allows the app to fetch and store pages

-- Drop existing policy if any
DROP POLICY IF EXISTS "Allow all on facebook_pages" ON facebook_pages;
DROP POLICY IF EXISTS "Users manage own pages" ON facebook_pages;

-- Create permissive policy for facebook_pages
CREATE POLICY "Allow all operations on facebook_pages"
  ON facebook_pages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Make sure all other tables are also permissive
DROP POLICY IF EXISTS "Allow all on messenger_conversations" ON messenger_conversations;
CREATE POLICY "Allow all operations on messenger_conversations"
  ON messenger_conversations FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on messages" ON messages;
CREATE POLICY "Allow all operations on messages"
  ON messages FOR ALL
  USING (true)
  WITH CHECK (true);





