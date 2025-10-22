-- Update messages table to support 'selected' recipient type
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the old constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_recipient_type_check;

-- Step 2: Add new constraint with 'selected' option
ALTER TABLE messages 
ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));

-- Step 3: Add column for storing selected recipient IDs (optional but recommended)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];

-- Step 4: Add comment to document the column
COMMENT ON COLUMN messages.selected_recipients IS 'Array of Facebook user IDs when recipient_type is selected';

-- Step 5: Verify the changes
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
AND conname = 'messages_recipient_type_check';

-- You should see: CHECK ((recipient_type = ANY (ARRAY['all'::text, 'active'::text, 'selected'::text])))

-- Success! The messages table now supports 'selected' recipient type.

