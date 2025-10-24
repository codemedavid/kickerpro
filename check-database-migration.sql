-- Check if media_attachments column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages' AND column_name = 'media_attachments';

-- If the above returns no results, run this migration:
-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_attachments JSONB;

-- Test insert with media attachments (replace with your actual IDs)
-- INSERT INTO messages (
--   title,
--   content,
--   page_id,
--   created_by,
--   recipient_type,
--   recipient_count,
--   status,
--   media_attachments
-- ) VALUES (
--   'Test Media Message',
--   'This is a test message with media',
--   (SELECT id FROM facebook_pages LIMIT 1),
--   (SELECT id FROM users LIMIT 1),
--   'all',
--   0,
--   'draft',
--   '[{"type": "image", "url": "https://example.com/test.jpg", "is_reusable": true}]'::jsonb
-- );

-- Check recent messages for media attachments
SELECT 
  id,
  title,
  media_attachments,
  CASE 
    WHEN media_attachments IS NULL THEN 'NULL'
    ELSE jsonb_array_length(media_attachments)::text
  END as media_count
FROM messages
ORDER BY created_at DESC
LIMIT 5;
