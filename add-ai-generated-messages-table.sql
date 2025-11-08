-- Add AI Generated Messages table
-- Run this in your Supabase SQL Editor

-- Create table for storing AI-generated follow-up messages
CREATE TABLE IF NOT EXISTS ai_generated_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  generated_message TEXT NOT NULL,
  reasoning TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_generated_conversation 
ON ai_generated_messages(conversation_id, created_by);

CREATE INDEX IF NOT EXISTS idx_ai_generated_created_by 
ON ai_generated_messages(created_by, created_at DESC);

-- Enable RLS
ALTER TABLE ai_generated_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own AI messages" 
ON ai_generated_messages
FOR SELECT 
USING (created_by = auth.uid());

CREATE POLICY "Users can create their own AI messages" 
ON ai_generated_messages
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own AI messages" 
ON ai_generated_messages
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own AI messages" 
ON ai_generated_messages
FOR DELETE 
USING (created_by = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE ai_generated_messages IS 'Stores AI-generated follow-up messages for conversations';
COMMENT ON COLUMN ai_generated_messages.generated_message IS 'The AI-generated follow-up message';
COMMENT ON COLUMN ai_generated_messages.reasoning IS 'AI reasoning for why this message was generated';
COMMENT ON COLUMN ai_generated_messages.used IS 'Whether this message has been used/sent';
COMMENT ON COLUMN ai_generated_messages.used_at IS 'When this message was used';

