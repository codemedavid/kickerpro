-- Facebook Bulk Messenger - Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    profile_picture TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'editor', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Facebook Pages table
CREATE TABLE IF NOT EXISTS facebook_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_page_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    profile_picture TEXT,
    follower_count INTEGER DEFAULT 0,
    access_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT facebook_pages_user_page_unique UNIQUE (user_id, facebook_page_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    page_id UUID NOT NULL REFERENCES facebook_pages(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('all', 'active', 'selected')),
    recipient_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  error_message TEXT,
  selected_recipients TEXT[],
  selected_contacts_data JSONB,
  message_tag TEXT CHECK (message_tag IN ('ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE', 'HUMAN_AGENT')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Batches table (for splitting large sends into batches of 100)
CREATE TABLE IF NOT EXISTS message_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    total_batches INTEGER NOT NULL,
    recipients TEXT[] NOT NULL,
    recipient_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_message_batches_message_id ON message_batches(message_id);
CREATE INDEX IF NOT EXISTS idx_message_batches_status ON message_batches(status);

-- Messenger Conversations table
CREATE TABLE IF NOT EXISTS messenger_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    last_message TEXT,
    last_message_time TIMESTAMPTZ NOT NULL,
    conversation_status TEXT NOT NULL DEFAULT 'active' CHECK (conversation_status IN ('active', 'inactive', 'blocked')),
    message_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, page_id, sender_id)
);

-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'editor', 'member')),
    permissions TEXT[] DEFAULT '{}',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Activity table
CREATE TABLE IF NOT EXISTS message_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('created', 'scheduled', 'sent', 'delivered', 'opened', 'clicked', 'failed')),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_facebook_pages_user_id ON facebook_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_page_id ON messages(page_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_by ON messages(created_by);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_for ON messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_user_page ON messenger_conversations(user_id, page_id);
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_sender ON messenger_conversations(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_activity_message_id ON message_activity(message_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_facebook_pages_updated_at BEFORE UPDATE ON facebook_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messenger_conversations_updated_at BEFORE UPDATE ON messenger_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Can read their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid()::text = id::text OR auth.uid()::text = facebook_id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid()::text = id::text OR auth.uid()::text = facebook_id);

-- Facebook Pages: Users can manage their own pages
CREATE POLICY "Users can read own pages" ON facebook_pages
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own pages" ON facebook_pages
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own pages" ON facebook_pages
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own pages" ON facebook_pages
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Messages: Users can manage their own messages
CREATE POLICY "Users can read own messages" ON messages
    FOR SELECT USING (
        auth.uid()::text = created_by::text OR
        auth.uid()::text IN (SELECT user_id::text FROM facebook_pages WHERE id = messages.page_id)
    );

CREATE POLICY "Users can insert own messages" ON messages
    FOR INSERT WITH CHECK (auth.uid()::text = created_by::text);

CREATE POLICY "Users can update own messages" ON messages
    FOR UPDATE USING (auth.uid()::text = created_by::text);

CREATE POLICY "Users can delete own messages" ON messages
    FOR DELETE USING (auth.uid()::text = created_by::text);

-- Messenger Conversations: Users can read conversations for their pages
CREATE POLICY "Users can read own conversations" ON messenger_conversations
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own conversations" ON messenger_conversations
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own conversations" ON messenger_conversations
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Team Members: Can read team data
CREATE POLICY "Users can read team members" ON team_members
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage team members" ON team_members
    FOR ALL USING (
        auth.uid()::text IN (
            SELECT id::text FROM users WHERE role = 'admin'
        )
    );

-- Message Activity: Users can read activity for their messages
CREATE POLICY "Users can read message activity" ON message_activity
    FOR SELECT USING (
        message_id IN (
            SELECT id FROM messages WHERE created_by::text = auth.uid()::text
        )
    );

CREATE POLICY "System can insert message activity" ON message_activity
    FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create a function to get user by Facebook ID
CREATE OR REPLACE FUNCTION get_user_by_facebook_id(fb_id TEXT)
RETURNS SETOF users AS $$
BEGIN
    RETURN QUERY SELECT * FROM users WHERE facebook_id = fb_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

