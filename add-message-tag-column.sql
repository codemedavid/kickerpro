-- Add message_tag column to messages table
-- Run this in Supabase SQL Editor

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_tag TEXT 
CHECK (message_tag IN ('ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE', 'HUMAN_AGENT'));

-- Add comment
COMMENT ON COLUMN messages.message_tag IS 'Optional Facebook message tag to bypass 24-hour window. NULL = no tag (standard messaging)';

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name = 'message_tag';

