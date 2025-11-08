-- Fix ALL RLS Policies - Allow All Operations
-- This fixes issues with users, pages, conversations, messages, etc.
-- Run this in Supabase SQL Editor

-- Drop ALL existing restrictive policies
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow all operations on users" ON users;
DROP POLICY IF EXISTS "Users manage own pages" ON facebook_pages;
DROP POLICY IF EXISTS "Allow all on facebook_pages" ON facebook_pages;
DROP POLICY IF EXISTS "Allow all operations on facebook_pages" ON facebook_pages;
DROP POLICY IF EXISTS "Users manage own messages" ON messages;
DROP POLICY IF EXISTS "Allow all on messages" ON messages;
DROP POLICY IF EXISTS "Allow all operations on messages" ON messages;
DROP POLICY IF EXISTS "Users manage own conversations" ON messenger_conversations;
DROP POLICY IF EXISTS "Allow all on messenger_conversations" ON messenger_conversations;
DROP POLICY IF EXISTS "Allow all operations on messenger_conversations" ON messenger_conversations;
DROP POLICY IF EXISTS "Users manage own tags" ON tags;
DROP POLICY IF EXISTS "Allow all on tags" ON tags;
DROP POLICY IF EXISTS "Allow all operations on tags" ON tags;
DROP POLICY IF EXISTS "Users manage own pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Allow all on pipeline_stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Allow all operations on pipeline_stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users manage own opportunities" ON pipeline_opportunities;
DROP POLICY IF EXISTS "Allow all on pipeline_opportunities" ON pipeline_opportunities;
DROP POLICY IF EXISTS "Allow all operations on pipeline_opportunities" ON pipeline_opportunities;
DROP POLICY IF EXISTS "Users manage own automations" ON ai_automation_rules;
DROP POLICY IF EXISTS "Allow all on ai_automation_rules" ON ai_automation_rules;
DROP POLICY IF EXISTS "Allow all operations on ai_automation_rules" ON ai_automation_rules;
DROP POLICY IF EXISTS "Allow all on message_batches" ON message_batches;
DROP POLICY IF EXISTS "Allow all on message_activity" ON message_activity;
DROP POLICY IF EXISTS "Allow all on conversation_tags" ON conversation_tags;
DROP POLICY IF EXISTS "Allow all on message_auto_tags" ON message_auto_tags;

-- Create permissive policies for ALL tables (allows everything)
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON facebook_pages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON message_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON messenger_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON message_activity FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON conversation_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON message_auto_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON pipeline_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON pipeline_opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ai_automation_rules FOR ALL USING (true) WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_auto_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automation_rules ENABLE ROW LEVEL SECURITY;



