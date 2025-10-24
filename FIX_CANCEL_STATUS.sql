-- ================================================================
-- 🔧 FIX: Add 'cancelled' status to messages and batches
-- ================================================================
-- This allows messages and batches to be cancelled properly.
-- Run this in Supabase SQL Editor if cancel button is failing.
-- ================================================================

-- Fix messages status constraint to include 'cancelled'
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_status_check;

ALTER TABLE messages 
ADD CONSTRAINT messages_status_check 
CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'));

-- Fix message_batches status constraint to include 'cancelled'
ALTER TABLE message_batches 
DROP CONSTRAINT IF EXISTS message_batches_status_check;

ALTER TABLE message_batches 
ADD CONSTRAINT message_batches_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- ================================================================
-- ✅ DONE! Cancel button should now work properly.
-- ================================================================

SELECT 
  '✅ Status constraints updated!' as message,
  'Messages and batches can now be cancelled' as info;

