-- Add AI Bulk Send support to messages table
-- Run this in your Supabase SQL Editor

-- Add columns for AI personalized bulk sending
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS use_ai_bulk_send BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_messages_map JSONB;

-- Add comment for documentation
COMMENT ON COLUMN messages.use_ai_bulk_send IS 'Whether to send unique AI-generated message to each recipient';
COMMENT ON COLUMN messages.ai_messages_map IS 'JSON map of sender_id to personalized AI message';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_messages_ai_bulk_send 
ON messages(use_ai_bulk_send) 
WHERE use_ai_bulk_send = true;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'messages' 
AND column_name IN ('use_ai_bulk_send', 'ai_messages_map')
ORDER BY ordinal_position;




