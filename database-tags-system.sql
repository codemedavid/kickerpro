-- Tags System for Conversations
-- Run this in your Supabase SQL Editor

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color code
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, created_by) -- Prevent duplicate tag names per user
);

-- Create conversation_tags junction table
CREATE TABLE IF NOT EXISTS conversation_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, tag_id) -- Prevent duplicate tag assignments
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON tags(created_by);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_conversation_id ON conversation_tags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag_id ON conversation_tags(tag_id);

-- Add RLS policies
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tags ENABLE ROW LEVEL SECURITY;

-- Tags policies
CREATE POLICY "Users can view their own tags" ON tags
FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create their own tags" ON tags
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own tags" ON tags
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own tags" ON tags
FOR DELETE USING (created_by = auth.uid());

-- Conversation tags policies
CREATE POLICY "Users can view conversation tags" ON conversation_tags
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messenger_conversations mc 
    WHERE mc.id = conversation_tags.conversation_id 
    AND mc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversation tags" ON conversation_tags
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM messenger_conversations mc 
    WHERE mc.id = conversation_tags.conversation_id 
    AND mc.user_id = auth.uid()
  ) AND
  EXISTS (
    SELECT 1 FROM tags t 
    WHERE t.id = conversation_tags.tag_id 
    AND t.created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete conversation tags" ON conversation_tags
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM messenger_conversations mc 
    WHERE mc.id = conversation_tags.conversation_id 
    AND mc.user_id = auth.uid()
  )
);

-- Add updated_at trigger for tags
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some default tags
INSERT INTO tags (name, color, created_by) VALUES
  ('Important', '#EF4444', (SELECT id FROM auth.users LIMIT 1)),
  ('Follow Up', '#F59E0B', (SELECT id FROM auth.users LIMIT 1)),
  ('VIP', '#8B5CF6', (SELECT id FROM auth.users LIMIT 1)),
  ('Support', '#10B981', (SELECT id FROM auth.users LIMIT 1)),
  ('Sales', '#3B82F6', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (name, created_by) DO NOTHING;
