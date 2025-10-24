/**
 * Debug Media Upload Failures
 * This script helps identify why messages are failing when media is attached
 */

console.log('🔍 Debugging Media Upload Failures...\n');

console.log('🎯 Common causes of message failures with media:');
console.log('');

console.log('1. ❌ Empty URLs in media attachments:');
console.log('   - File upload fails → URL is empty → Facebook rejects');
console.log('   - Check: media_attachments.url should not be empty');
console.log('');

console.log('2. ❌ RLS Policy errors:');
console.log('   - Supabase storage blocks upload → URL is empty');
console.log('   - Check: "new row violates row-level security policy"');
console.log('');

console.log('3. ❌ File size issues:');
console.log('   - File too large → Upload fails → URL is empty');
console.log('   - Check: File size should be ≤ 25MB');
console.log('');

console.log('4. ❌ Network/authentication issues:');
console.log('   - Supabase connection fails → URL is empty');
console.log('   - Check: Supabase credentials and network');
console.log('');

console.log('🔧 Debugging steps:');
console.log('');

console.log('1. Check browser console for upload errors:');
console.log('   - Look for "[Direct Upload]" or "[Upload Supabase API]" logs');
console.log('   - Check for any error messages');
console.log('');

console.log('2. Check the media_attachments in database:');
console.log('   - Look for empty URLs: "url": ""');
console.log('   - Look for error fields: "error": "..."');
console.log('');

console.log('3. Test file upload step by step:');
console.log('   - Try uploading a small file (≤ 5MB)');
console.log('   - Check if it gets a real Supabase URL');
console.log('   - Try uploading a large file (5-25MB)');
console.log('   - Check if direct upload works');
console.log('');

console.log('4. Check Supabase Storage:');
console.log('   - Go to Supabase dashboard → Storage');
console.log('   - Check if files are actually uploaded');
console.log('   - Check if bucket is public');
console.log('');

console.log('🚀 Quick fixes:');
console.log('');

console.log('1. Fix RLS policies (if that\'s the issue):');
console.log('   Run the SQL fix in Supabase SQL Editor');
console.log('');

console.log('2. Check file sizes:');
console.log('   - Make sure files are ≤ 25MB');
console.log('   - Check if 5MB limit is causing issues');
console.log('');

console.log('3. Test with different file types:');
console.log('   - Try a small image first');
console.log('   - Try a small video');
console.log('   - See which ones work');
console.log('');

console.log('🎉 Expected behavior:');
console.log('✅ File uploads successfully');
console.log('✅ Gets real Supabase URL');
console.log('✅ Media attachment has valid URL');
console.log('✅ Message sends successfully');
console.log('✅ Facebook receives media');

console.log('\n📝 Next steps:');
console.log('1. Check browser console for specific error messages');
console.log('2. Try uploading a small test file');
console.log('3. Check if the URL is populated correctly');
console.log('4. Report back with specific error messages');
