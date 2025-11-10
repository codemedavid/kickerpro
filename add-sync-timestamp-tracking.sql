-- Add sync timestamp tracking to facebook_pages for incremental syncing
-- This enables faster subsequent syncs by only fetching updated conversations

-- Add last_synced_at column to facebook_pages table
ALTER TABLE facebook_pages 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_facebook_pages_last_synced_at 
ON facebook_pages(last_synced_at);

-- Add comment to explain the column
COMMENT ON COLUMN facebook_pages.last_synced_at IS 
'Timestamp of the last successful conversation sync. Used for incremental syncing to only fetch conversations updated since this time.';

-- Show success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Successfully added sync timestamp tracking!';
    RAISE NOTICE 'Incremental sync is now enabled for faster subsequent syncs.';
    RAISE NOTICE 'First sync will be full, subsequent syncs will only fetch new/updated conversations.';
END $$;

