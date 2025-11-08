-- Fix RLS Policies to Allow User Creation
-- Run this in Supabase SQL Editor

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users manage own pages" ON facebook_pages;
DROP POLICY IF EXISTS "Users manage own messages" ON messages;
DROP POLICY IF EXISTS "Users manage own conversations" ON messenger_conversations;
DROP POLICY IF EXISTS "Users manage own tags" ON tags;
DROP POLICY IF EXISTS "Users manage own pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users manage own opportunities" ON pipeline_opportunities;

-- Create permissive policies for users table
CREATE POLICY "Allow all operations on users"
  ON users FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create permissive policies for other tables
CREATE POLICY "Allow all on facebook_pages"
  ON facebook_pages FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on messages"
  ON messages FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on message_batches"
  ON message_batches FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on messenger_conversations"
  ON messenger_conversations FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on message_activity"
  ON message_activity FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on tags"
  ON tags FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on conversation_tags"
  ON conversation_tags FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on message_auto_tags"
  ON message_auto_tags FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on pipeline_stages"
  ON pipeline_stages FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on pipeline_opportunities"
  ON pipeline_opportunities FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on ai_automation_rules"
  ON ai_automation_rules FOR ALL
  USING (true)
  WITH CHECK (true);



