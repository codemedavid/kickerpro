-- 🔧 SAFE RLS Fix - Won't fail if policies exist
-- Run this in Supabase SQL Editor

-- Use DO block to handle existing policies safely
DO $$ 
BEGIN
  -- Users table
  DROP POLICY IF EXISTS "allow_all_users" ON users;
  DROP POLICY IF EXISTS "Allow all" ON users;
  DROP POLICY IF EXISTS "Users can view own data" ON users;
  DROP POLICY IF EXISTS "Users can update own data" ON users;
  CREATE POLICY "allow_all_users" ON users FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Facebook Pages
  DROP POLICY IF EXISTS "allow_all_facebook_pages" ON facebook_pages;
  DROP POLICY IF EXISTS "Allow all" ON facebook_pages;
  DROP POLICY IF EXISTS "Users manage own pages" ON facebook_pages;
  CREATE POLICY "allow_all_facebook_pages" ON facebook_pages FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Messenger Conversations
  DROP POLICY IF EXISTS "allow_all_messenger_conversations" ON messenger_conversations;
  DROP POLICY IF EXISTS "Allow all" ON messenger_conversations;
  DROP POLICY IF EXISTS "Users manage own conversations" ON messenger_conversations;
  DROP POLICY IF EXISTS "Allow all operations" ON messenger_conversations;
  CREATE POLICY "allow_all_messenger_conversations" ON messenger_conversations FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Messages
  DROP POLICY IF EXISTS "allow_all_messages" ON messages;
  DROP POLICY IF EXISTS "Allow all" ON messages;
  CREATE POLICY "allow_all_messages" ON messages FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Message Batches
  DROP POLICY IF EXISTS "allow_all_message_batches" ON message_batches;
  DROP POLICY IF EXISTS "Allow all" ON message_batches;
  CREATE POLICY "allow_all_message_batches" ON message_batches FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Message Activity
  DROP POLICY IF EXISTS "allow_all_message_activity" ON message_activity;
  DROP POLICY IF EXISTS "Allow all" ON message_activity;
  CREATE POLICY "allow_all_message_activity" ON message_activity FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Tags
  DROP POLICY IF EXISTS "allow_all_tags" ON tags;
  DROP POLICY IF EXISTS "Allow all" ON tags;
  CREATE POLICY "allow_all_tags" ON tags FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Conversation Tags
  DROP POLICY IF EXISTS "allow_all_conversation_tags" ON conversation_tags;
  DROP POLICY IF EXISTS "Allow all" ON conversation_tags;
  CREATE POLICY "allow_all_conversation_tags" ON conversation_tags FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Message Auto Tags
  DROP POLICY IF EXISTS "allow_all_message_auto_tags" ON message_auto_tags;
  DROP POLICY IF EXISTS "Allow all" ON message_auto_tags;
  CREATE POLICY "allow_all_message_auto_tags" ON message_auto_tags FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Pipeline Stages
  DROP POLICY IF EXISTS "allow_all_pipeline_stages" ON pipeline_stages;
  DROP POLICY IF EXISTS "Allow all" ON pipeline_stages;
  CREATE POLICY "allow_all_pipeline_stages" ON pipeline_stages FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- Pipeline Opportunities
  DROP POLICY IF EXISTS "allow_all_pipeline_opportunities" ON pipeline_opportunities;
  DROP POLICY IF EXISTS "Allow all" ON pipeline_opportunities;
  CREATE POLICY "allow_all_pipeline_opportunities" ON pipeline_opportunities FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
  
  -- AI Automation Rules
  DROP POLICY IF EXISTS "allow_all_ai_automation_rules" ON ai_automation_rules;
  DROP POLICY IF EXISTS "Allow all" ON ai_automation_rules;
  CREATE POLICY "allow_all_ai_automation_rules" ON ai_automation_rules FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);
END $$;

-- Grant permissions
GRANT ALL ON users TO public, anon, authenticated, service_role;
GRANT ALL ON facebook_pages TO public, anon, authenticated, service_role;
GRANT ALL ON messenger_conversations TO public, anon, authenticated, service_role;
GRANT ALL ON messages TO public, anon, authenticated, service_role;
GRANT ALL ON message_batches TO public, anon, authenticated, service_role;
GRANT ALL ON message_activity TO public, anon, authenticated, service_role;
GRANT ALL ON tags TO public, anon, authenticated, service_role;
GRANT ALL ON conversation_tags TO public, anon, authenticated, service_role;
GRANT ALL ON message_auto_tags TO public, anon, authenticated, service_role;
GRANT ALL ON pipeline_stages TO public, anon, authenticated, service_role;
GRANT ALL ON pipeline_opportunities TO public, anon, authenticated, service_role;
GRANT ALL ON ai_automation_rules TO public, anon, authenticated, service_role;

-- Success!
SELECT '✅ All RLS policies fixed! Test your app now.' as result;



