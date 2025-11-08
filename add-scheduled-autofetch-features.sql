-- Add Auto-Fetch and Tag Filtering features to Scheduled Messages
-- Run this in your Supabase SQL Editor

-- Add new columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS auto_fetch_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_fetch_page_id TEXT,
ADD COLUMN IF NOT EXISTS include_tag_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS exclude_tag_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_fetch_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fetch_count INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN messages.auto_fetch_enabled IS 'Whether to automatically fetch new conversations before sending';
COMMENT ON COLUMN messages.auto_fetch_page_id IS 'Facebook page ID to fetch conversations from';
COMMENT ON COLUMN messages.include_tag_ids IS 'Array of tag IDs to include (must have at least one)';
COMMENT ON COLUMN messages.exclude_tag_ids IS 'Array of tag IDs to exclude (must not have any)';
COMMENT ON COLUMN messages.last_fetch_at IS 'Timestamp of last auto-fetch';
COMMENT ON COLUMN messages.fetch_count IS 'Number of times conversations have been auto-fetched';

-- Create index for better performance on scheduled message queries
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_autofetch 
ON messages(scheduled_for, auto_fetch_enabled) 
WHERE status = 'scheduled' AND auto_fetch_enabled = true;

-- Update existing scheduled messages to have auto_fetch_enabled = false by default
UPDATE messages 
SET auto_fetch_enabled = false 
WHERE auto_fetch_enabled IS NULL;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'messages' 
AND column_name IN (
    'auto_fetch_enabled', 
    'auto_fetch_page_id', 
    'include_tag_ids', 
    'exclude_tag_ids',
    'last_fetch_at',
    'fetch_count'
)
ORDER BY ordinal_position;

