-- Fix Media Attachments Constraint Issue
-- Run this in your Supabase SQL Editor

-- Remove the problematic constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS check_media_attachments_valid;

-- Drop the validation functions (they're too strict)
DROP FUNCTION IF EXISTS validate_media_attachments_array(JSONB);
DROP FUNCTION IF EXISTS validate_media_attachment(JSONB);

-- Add a simpler, more lenient constraint
ALTER TABLE messages ADD CONSTRAINT check_media_attachments_simple 
CHECK (
  media_attachments IS NULL OR 
  (
    jsonb_typeof(media_attachments) = 'array' AND
    jsonb_array_length(media_attachments) <= 10 -- Limit to 10 attachments max
  )
);

-- Update the comment to be more helpful
COMMENT ON COLUMN messages.media_attachments IS 'Array of media attachments. Each attachment should have: type (image|video|audio|file), url (https://...), and optionally is_reusable, filename, size, mime_type';

-- Test the constraint with a simple example
-- This should work now:
-- INSERT INTO messages (title, content, page_id, created_by, media_attachments) 
-- VALUES ('Test', 'Test message', 'test-page', 'test-user', '[{"type": "image", "url": "https://example.com/test.jpg"}]');
