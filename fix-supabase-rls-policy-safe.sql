-- Safe Supabase Storage RLS Policy Fix
-- This handles existing policies properly

-- Drop ALL existing policies for the media bucket
DROP POLICY IF EXISTS "Users can upload their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload media files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to media files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete media files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update media files" ON storage.objects;

-- Create new, simple policies
CREATE POLICY "media_upload_policy" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'media' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "media_read_policy" ON storage.objects
FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "media_delete_policy" ON storage.objects
FOR DELETE USING (
  bucket_id = 'media' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "media_update_policy" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'media' AND
  auth.role() = 'authenticated'
);

-- Verify the policies were created
SELECT 
  policyname, 
  cmd, 
  permissive, 
  roles,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE 'media_%';

-- Test the bucket exists
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'media';
