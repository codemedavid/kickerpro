-- Add message_auto_tags table to existing database
-- Run this in Supabase SQL Editor

-- Message Auto Tags table (for automatic tagging when messages are sent)
CREATE TABLE IF NOT EXISTS message_auto_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_auto_tags_message_id ON message_auto_tags(message_id);
CREATE INDEX IF NOT EXISTS idx_message_auto_tags_tag_id ON message_auto_tags(tag_id);

-- Add RLS policies
ALTER TABLE message_auto_tags ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see auto-tags for their own messages
CREATE POLICY "Users can view their own message auto tags" ON message_auto_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM messages 
            WHERE messages.id = message_auto_tags.message_id 
            AND messages.created_by = auth.uid()
        )
    );

-- Policy: Users can create auto-tags for their own messages
CREATE POLICY "Users can create auto tags for their own messages" ON message_auto_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM messages 
            WHERE messages.id = message_auto_tags.message_id 
            AND messages.created_by = auth.uid()
        )
    );

-- Policy: Users can update auto-tags for their own messages
CREATE POLICY "Users can update auto tags for their own messages" ON message_auto_tags
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM messages 
            WHERE messages.id = message_auto_tags.message_id 
            AND messages.created_by = auth.uid()
        )
    );

-- Policy: Users can delete auto-tags for their own messages
CREATE POLICY "Users can delete auto tags for their own messages" ON message_auto_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM messages 
            WHERE messages.id = message_auto_tags.message_id 
            AND messages.created_by = auth.uid()
        )
    );
