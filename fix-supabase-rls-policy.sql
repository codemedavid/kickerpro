-- Fix Supabase Storage RLS Policy
-- Run this in your Supabase SQL Editor

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can upload their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media files" ON storage.objects;

-- Create more permissive policies for the media bucket
CREATE POLICY "Allow authenticated users to upload media files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'media' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow public read access to media files" ON storage.objects
FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "Allow authenticated users to delete media files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'media' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to update media files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'media' AND
  auth.role() = 'authenticated'
);

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
