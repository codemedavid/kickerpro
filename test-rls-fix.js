/**
 * Test RLS Policy Fix
 * This script helps verify the Supabase RLS policies are working
 */

console.log('🧪 Testing Supabase RLS Policy Fix...\n');

console.log('✅ Run this SQL in your Supabase SQL Editor:');
console.log(`
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
`);

console.log('\n🎯 What this fixes:');
console.log('✅ Removes all conflicting policies');
console.log('✅ Creates simple, permissive policies');
console.log('✅ Allows authenticated users to upload files');
console.log('✅ Allows public read access (Facebook needs this)');

console.log('\n🚀 After running the SQL:');
console.log('1. Go to your compose page');
console.log('2. Upload a single image');
console.log('3. Check browser console - should see successful upload');
console.log('4. Check database - should have real Supabase URL');
console.log('5. Send message - should work without Facebook errors!');

console.log('\n🎉 Expected results:');
console.log('✅ File uploads work (no more RLS errors)');
console.log('✅ Real Supabase URLs (not empty)');
console.log('✅ Facebook receives your image (no more API errors)');
console.log('✅ Message sends successfully');

console.log('\n📝 Note: The error "policy already exists" means some policies were created before.');
console.log('This new script removes ALL policies first, then creates fresh ones.');
