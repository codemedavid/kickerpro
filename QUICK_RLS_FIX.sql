-- Quick RLS Fix - Run this in Supabase SQL Editor
-- This will completely disable RLS for the media bucket

-- First, let's see what policies exist
SELECT policyname, cmd, permissive, roles, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Drop ALL policies for storage.objects
DROP POLICY IF EXISTS "Users can upload their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload media files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to media files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete media files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update media files" ON storage.objects;
DROP POLICY IF EXISTS "media_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "media_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "media_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "media_update_policy" ON storage.objects;

-- Create very simple, permissive policies
CREATE POLICY "media_upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'media');

CREATE POLICY "media_read" ON storage.objects
FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "media_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'media');

CREATE POLICY "media_update" ON storage.objects
FOR UPDATE USING (bucket_id = 'media');

-- Verify the policies were created
SELECT policyname, cmd, permissive, roles, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE 'media_%';
