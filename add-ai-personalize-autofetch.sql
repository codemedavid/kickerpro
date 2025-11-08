-- Add AI Personalization for Auto-Fetched Contacts in Scheduled Messages
-- Run this in your Supabase SQL Editor

-- Add new column to messages table for AI personalization on auto-fetch
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS ai_personalize_auto_fetch BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_custom_instructions TEXT;

-- Add comments for documentation
COMMENT ON COLUMN messages.ai_personalize_auto_fetch IS 'Whether to generate AI-personalized messages for auto-fetched contacts before sending';
COMMENT ON COLUMN messages.ai_custom_instructions IS 'Custom instructions for AI message generation during auto-fetch';

-- Create index for better performance on scheduled message queries with AI personalization
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_ai_autofetch 
ON messages(scheduled_for, auto_fetch_enabled, ai_personalize_auto_fetch) 
WHERE status = 'scheduled' AND auto_fetch_enabled = true AND ai_personalize_auto_fetch = true;

-- Update existing scheduled messages to have ai_personalize_auto_fetch = false by default
UPDATE messages 
SET ai_personalize_auto_fetch = false 
WHERE ai_personalize_auto_fetch IS NULL;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'messages' 
AND column_name IN (
    'ai_personalize_auto_fetch', 
    'ai_custom_instructions'
)
ORDER BY ordinal_position;

