-- Database Schema Updates for Media Support
-- Run this in your Supabase SQL Editor

-- Add media_attachments column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_attachments JSONB;

-- Create index for media_attachments for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_media_attachments ON messages USING GIN (media_attachments);

-- Add comment to explain the media_attachments structure
COMMENT ON COLUMN messages.media_attachments IS 'Array of media attachments with structure: [{"type": "image|video|audio|file", "url": "https://...", "is_reusable": true}]';

-- Example of media_attachments JSON structure:
-- [
--   {
--     "type": "image",
--     "url": "https://example.com/image.jpg",
--     "is_reusable": true,
--     "filename": "product-image.jpg",
--     "size": 1024000
--   },
--   {
--     "type": "video", 
--     "url": "https://example.com/video.mp4",
--     "is_reusable": false,
--     "filename": "demo-video.mp4",
--     "size": 5242880
--   }
-- ]

-- Update the messages table constraint to allow media_attachments
-- (This is already handled by JSONB type, but adding for clarity)

-- Create a function to validate media attachment structure
CREATE OR REPLACE FUNCTION validate_media_attachment(attachment JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if it's a valid JSON object
  IF attachment IS NULL THEN
    RETURN TRUE; -- NULL is allowed
  END IF;
  
  -- Check required fields
  IF NOT (attachment ? 'type' AND attachment ? 'url') THEN
    RETURN FALSE;
  END IF;
  
  -- Check type is valid
  IF NOT (attachment->>'type' IN ('image', 'video', 'audio', 'file')) THEN
    RETURN FALSE;
  END IF;
  
  -- Check URL is valid (basic check)
  IF NOT (attachment->>'url' ~ '^https?://') THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to validate media_attachments array
CREATE OR REPLACE FUNCTION validate_media_attachments_array(attachments JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  attachment JSONB;
BEGIN
  -- NULL is allowed
  IF attachments IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Must be an array
  IF jsonb_typeof(attachments) != 'array' THEN
    RETURN FALSE;
  END IF;
  
  -- Validate each attachment
  FOR attachment IN SELECT jsonb_array_elements(attachments)
  LOOP
    IF NOT validate_media_attachment(attachment) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to validate media_attachments structure
ALTER TABLE messages ADD CONSTRAINT check_media_attachments_valid 
CHECK (validate_media_attachments_array(media_attachments));

-- Create a view for messages with media
CREATE OR REPLACE VIEW messages_with_media AS
SELECT 
  m.*,
  CASE 
    WHEN m.media_attachments IS NOT NULL AND jsonb_array_length(m.media_attachments) > 0 
    THEN jsonb_array_length(m.media_attachments)
    ELSE 0
  END as media_count,
  CASE 
    WHEN m.media_attachments IS NOT NULL AND jsonb_array_length(m.media_attachments) > 0 
    THEN m.media_attachments->0->>'type'
    ELSE NULL
  END as primary_media_type
FROM messages m;

-- Create a function to get media statistics
CREATE OR REPLACE FUNCTION get_media_stats()
RETURNS TABLE (
  total_messages BIGINT,
  messages_with_media BIGINT,
  image_count BIGINT,
  video_count BIGINT,
  audio_count BIGINT,
  file_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE media_attachments IS NOT NULL AND jsonb_array_length(media_attachments) > 0) as messages_with_media,
    COUNT(*) FILTER (WHERE media_attachments @> '[{"type": "image"}]') as image_count,
    COUNT(*) FILTER (WHERE media_attachments @> '[{"type": "video"}]') as video_count,
    COUNT(*) FILTER (WHERE media_attachments @> '[{"type": "audio"}]') as audio_count,
    COUNT(*) FILTER (WHERE media_attachments @> '[{"type": "file"}]') as file_count
  FROM messages;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON messages_with_media TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_media_stats() TO anon, authenticated;
