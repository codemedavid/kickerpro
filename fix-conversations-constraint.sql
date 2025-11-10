-- Add unique constraint to messenger_conversations for upsert to work
-- This allows the sync to properly insert/update conversations

-- Add unique constraint on page_id + sender_id (one conversation per sender per page)
ALTER TABLE messenger_conversations 
DROP CONSTRAINT IF EXISTS messenger_conversations_page_sender_unique;

ALTER TABLE messenger_conversations 
ADD CONSTRAINT messenger_conversations_page_sender_unique 
UNIQUE (page_id, sender_id);

-- Verify
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'messenger_conversations'::regclass
  AND contype = 'u';

SELECT '✅ Unique constraint added! Conversation sync should work now.' as result;






