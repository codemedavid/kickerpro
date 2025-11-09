-- ================================================================
-- 🚀 RUN THIS SQL NOW IN SUPABASE
-- ================================================================
-- This adds all missing columns and tables for:
-- • Selected recipients
-- • Message tags  
-- • Batch processing
-- ================================================================

-- 1. Fix recipient_type constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_recipient_type_check;

ALTER TABLE messages 
ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));

-- 1b. Fix status constraint to include 'cancelled'
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_status_check;

ALTER TABLE messages 
ADD CONSTRAINT messages_status_check 
CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'));

-- 2. Add selected_recipients column (if not exists)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];

-- 3. Add message_tag column (if not exists)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_tag TEXT 
CHECK (message_tag IN ('ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE', 'HUMAN_AGENT'));

-- 4. Create message_batches table (if not exists)
CREATE TABLE IF NOT EXISTS message_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    total_batches INTEGER NOT NULL,
    recipients TEXT[] NOT NULL,
    recipient_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, batch_number)
);

-- 4b. Fix existing batch status constraint to include 'cancelled'
ALTER TABLE message_batches 
DROP CONSTRAINT IF EXISTS message_batches_status_check;

ALTER TABLE message_batches 
ADD CONSTRAINT message_batches_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_message_batches_message_id ON message_batches(message_id);
CREATE INDEX IF NOT EXISTS idx_message_batches_status ON message_batches(status);

-- ================================================================
-- ✅ VERIFICATION - Check if everything worked
-- ================================================================

-- Check columns exist
SELECT 
  column_name, 
  data_type,
  CASE 
    WHEN column_name = 'selected_recipients' THEN '✅ For selected contacts'
    WHEN column_name = 'message_tag' THEN '✅ For bypassing 24h window'
    ELSE 'Other'
  END as purpose
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('selected_recipients', 'message_tag');

-- Check message_batches table exists
SELECT 
  '✅ message_batches table created' as status,
  COUNT(*) as initial_count
FROM message_batches;

-- Check constraint
SELECT 
  '✅ Constraint allows: all, active, selected' as status,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
AND conname = 'messages_recipient_type_check';

-- ================================================================
-- 🔧 MULTI-TENANT FIX: Allow Multiple Users to Manage Same Page
-- ================================================================

-- Drop the UNIQUE constraint on facebook_page_id
ALTER TABLE facebook_pages 
DROP CONSTRAINT IF EXISTS facebook_pages_facebook_page_id_key;

-- Add composite unique constraint (user_id + facebook_page_id)
-- This prevents the SAME USER from adding the SAME PAGE twice
-- But allows DIFFERENT USERS to add the SAME PAGE
ALTER TABLE facebook_pages
DROP CONSTRAINT IF EXISTS facebook_pages_user_page_unique;

ALTER TABLE facebook_pages
ADD CONSTRAINT facebook_pages_user_page_unique 
UNIQUE (user_id, facebook_page_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_facebook_pages_user_page 
ON facebook_pages(user_id, facebook_page_id);

-- ================================================================
-- 🎉 SUCCESS MESSAGE
-- ================================================================

SELECT 
  '🎉 ALL MIGRATIONS COMPLETE!' as message,
  'You can now:' as info,
  '• Send to selected contacts (up to 2000)' as feature_1,
  '• Use message tags (bypass 24h window)' as feature_2,
  '• Process in batches (100 per batch)' as feature_3,
  '• Track batch progress' as feature_4,
  '• Multiple users can manage the same page!' as feature_5;

