-- ================================================================
-- 🔧 MULTI-TENANT FIX: Allow Multiple Users to Manage Same Page
-- ================================================================
-- This allows different users to add the same Facebook page to their account.
-- The same page can now be managed by multiple users.
-- ================================================================

-- Step 1: Drop the UNIQUE constraint on facebook_page_id
ALTER TABLE facebook_pages 
DROP CONSTRAINT IF EXISTS facebook_pages_facebook_page_id_key;

-- Step 2: Add composite unique constraint (user_id + facebook_page_id)
-- This prevents the SAME USER from adding the SAME PAGE twice
-- But allows DIFFERENT USERS to add the SAME PAGE
ALTER TABLE facebook_pages
DROP CONSTRAINT IF EXISTS facebook_pages_user_page_unique;

ALTER TABLE facebook_pages
ADD CONSTRAINT facebook_pages_user_page_unique 
UNIQUE (user_id, facebook_page_id);

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_facebook_pages_user_page 
ON facebook_pages(user_id, facebook_page_id);

-- ================================================================
-- ✅ DONE! Now multiple users can manage the same Facebook page
-- ================================================================

