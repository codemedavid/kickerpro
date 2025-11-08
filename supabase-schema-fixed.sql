-- Facebook Bulk Messenger - Supabase Database Schema (FIXED VERSION)
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
    facebook_access_token TEXT,
    facebook_token_updated_at TIMESTAMPTZ,
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

-- Message Batches table
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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Activity table
CREATE TABLE IF NOT EXISTS message_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(created_by, name)
);

-- Conversation tags junction table
CREATE TABLE IF NOT EXISTS conversation_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, tag_id)
);

-- Message Auto Tags table (NOW AFTER tags table)
CREATE TABLE IF NOT EXISTS message_auto_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id)
);

-- Pipeline Stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Pipeline Opportunities table
CREATE TABLE IF NOT EXISTS pipeline_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    value DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_user_id ON facebook_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_page_id ON messages(page_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_by ON messages(created_by);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_message_batches_message_id ON message_batches(message_id);
CREATE INDEX IF NOT EXISTS idx_message_batches_status ON message_batches(status);
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_page ON messenger_conversations(page_id);
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_sender ON messenger_conversations(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_activity_message_id ON message_activity(message_id);
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON tags(created_by);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_conversation_id ON conversation_tags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag_id ON conversation_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_message_auto_tags_message_id ON message_auto_tags(message_id);
CREATE INDEX IF NOT EXISTS idx_message_auto_tags_tag_id ON message_auto_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_id ON pipeline_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_user_id ON pipeline_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_conversation_id ON pipeline_opportunities(conversation_id);

-- Enable RLS
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

-- RLS Policies (simplified for easier setup)
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (id::text = auth.uid()::text);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (id::text = auth.uid()::text);

CREATE POLICY "Users manage own pages" ON facebook_pages FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users manage own messages" ON messages FOR ALL USING (created_by::text = auth.uid()::text);
CREATE POLICY "Users manage own conversations" ON messenger_conversations FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users manage own tags" ON tags FOR ALL USING (created_by::text = auth.uid()::text);
CREATE POLICY "Users manage own pipeline stages" ON pipeline_stages FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users manage own opportunities" ON pipeline_opportunities FOR ALL USING (user_id::text = auth.uid()::text);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;



