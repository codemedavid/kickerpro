-- ================================================================
-- ADD SYNC CHECKPOINT COLUMN TO FACEBOOK PAGES
-- ================================================================
-- Purpose: Store sync progress for resume capability
-- Run this in Supabase SQL Editor
-- ================================================================

-- Add sync_checkpoint column to facebook_pages table
ALTER TABLE facebook_pages 
ADD COLUMN IF NOT EXISTS sync_checkpoint JSONB DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN facebook_pages.sync_checkpoint IS 
'Stores sync progress (current, total, inserted, updated, lastSyncedId) for resume capability';

-- Create index for faster checkpoint queries
CREATE INDEX IF NOT EXISTS idx_facebook_pages_sync_checkpoint 
ON facebook_pages(id) 
WHERE sync_checkpoint IS NOT NULL;

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'facebook_pages' 
AND column_name = 'sync_checkpoint';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ sync_checkpoint column added successfully to facebook_pages table';
    RAISE NOTICE '📊 This column stores sync progress for resume capability';
    RAISE NOTICE '🔄 Pages can now resume interrupted syncs from where they left off';
END $$;

