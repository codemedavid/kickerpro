-- ================================================================
-- ALL DATABASE MIGRATIONS
-- Run this in Supabase SQL Editor to set up everything
-- ================================================================

-- 1. Add selected_recipients column and update constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_recipient_type_check;

ALTER TABLE messages 
ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];

-- 2. Add message_tag column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_tag TEXT 
CHECK (message_tag IN ('ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE', 'HUMAN_AGENT'));

COMMENT ON COLUMN messages.selected_recipients IS 'Array of Facebook user IDs when recipient_type is selected';
COMMENT ON COLUMN messages.message_tag IS 'Optional Facebook message tag to bypass 24-hour window. NULL = no tag (standard messaging)';

-- 3. Create message_batches table
CREATE TABLE IF NOT EXISTS message_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    total_batches INTEGER NOT NULL,
    recipients TEXT[] NOT NULL,
    recipient_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_message_batches_message_id ON message_batches(message_id);
CREATE INDEX IF NOT EXISTS idx_message_batches_status ON message_batches(status);

COMMENT ON TABLE message_batches IS 'Stores message sending batches (max 100 recipients each) for better performance and tracking';
COMMENT ON COLUMN message_batches.batch_number IS 'Batch number (1, 2, 3, etc.)';
COMMENT ON COLUMN message_batches.total_batches IS 'Total number of batches for this message';
COMMENT ON COLUMN message_batches.recipients IS 'Array of Facebook PSIDs (max 100)';

-- 4. Create trigger for message_batches updated_at
CREATE OR REPLACE FUNCTION update_message_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_batches_updated_at ON message_batches;
CREATE TRIGGER message_batches_updated_at
    BEFORE UPDATE ON message_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_message_batches_updated_at();

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Check if selected_recipients column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('selected_recipients', 'message_tag');

-- Check message_batches table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'message_batches';

-- Check constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
AND conname = 'messages_recipient_type_check';

-- Verify indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'message_batches';

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

SELECT 
  '✅ All migrations completed successfully!' as status,
  'Your database is ready for:' as message,
  '• Sending to selected contacts' as feature_1,
  '• Using message tags' as feature_2,
  '• Batch processing (up to 2000 contacts)' as feature_3;

