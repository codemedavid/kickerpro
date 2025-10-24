/**
 * Test Supabase Storage Setup
 * Run this to verify your Supabase Storage is configured correctly
 */

const { createClient } = require('@supabase/supabase-js');

// Replace with your Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.log('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseStorage() {
  console.log('🧪 Testing Supabase Storage Setup...\n');

  try {
    // 1. Check if media bucket exists
    console.log('1. Checking if media bucket exists...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError.message);
      return;
    }

    const mediaBucket = buckets.find(bucket => bucket.id === 'media');
    if (!mediaBucket) {
      console.error('❌ Media bucket not found!');
      console.log('Please run the setup-supabase-storage.sql script in your Supabase SQL Editor');
      return;
    }

    console.log('✅ Media bucket exists:', mediaBucket);

    // 2. Test file upload (create a simple test file)
    console.log('\n2. Testing file upload...');
    const testContent = 'This is a test file for Supabase Storage';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    const testFileName = `test-${Date.now()}.txt`;
    const testPath = `test/${testFileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(testPath, testFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      return;
    }

    console.log('✅ File uploaded successfully:', uploadData);

    // 3. Test getting public URL
    console.log('\n3. Testing public URL generation...');
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(testPath);

    console.log('✅ Public URL generated:', publicUrl);

    // 4. Test URL accessibility
    console.log('\n4. Testing URL accessibility...');
    try {
      const response = await fetch(publicUrl);
      if (response.ok) {
        console.log('✅ URL is publicly accessible');
        const content = await response.text();
        console.log('✅ Content matches:', content === testContent);
      } else {
        console.log('❌ URL not accessible, status:', response.status);
      }
    } catch (fetchError) {
      console.error('❌ Error testing URL accessibility:', fetchError.message);
    }

    // 5. Clean up test file
    console.log('\n5. Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from('media')
      .remove([testPath]);

    if (deleteError) {
      console.log('⚠️  Could not delete test file:', deleteError.message);
    } else {
      console.log('✅ Test file cleaned up');
    }

    console.log('\n🎉 Supabase Storage is working correctly!');
    console.log('You can now use the /api/upload-supabase endpoint for media uploads.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSupabaseStorage();
