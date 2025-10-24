-- Auto-tag system for messages
-- Run this in your Supabase SQL Editor

-- Create message_auto_tags table
CREATE TABLE IF NOT EXISTS message_auto_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id) -- One auto-tag per message
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_auto_tags_message_id ON message_auto_tags(message_id);
CREATE INDEX IF NOT EXISTS idx_message_auto_tags_tag_id ON message_auto_tags(tag_id);

-- Add RLS policies
ALTER TABLE message_auto_tags ENABLE ROW LEVEL SECURITY;

-- Message auto-tags policies
CREATE POLICY "Users can view their own message auto-tags" ON message_auto_tags
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m 
    WHERE m.id = message_auto_tags.message_id 
    AND m.created_by = auth.uid()
  )
);

CREATE POLICY "Users can create their own message auto-tags" ON message_auto_tags
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages m 
    WHERE m.id = message_auto_tags.message_id 
    AND m.created_by = auth.uid()
  ) AND
  EXISTS (
    SELECT 1 FROM tags t 
    WHERE t.id = message_auto_tags.tag_id 
    AND t.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update their own message auto-tags" ON message_auto_tags
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM messages m 
    WHERE m.id = message_auto_tags.message_id 
    AND m.created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete their own message auto-tags" ON message_auto_tags
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM messages m 
    WHERE m.id = message_auto_tags.message_id 
    AND m.created_by = auth.uid()
  )
);
