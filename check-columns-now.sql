-- Check what columns exist in messenger_conversations
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'messenger_conversations'
ORDER BY ordinal_position;


