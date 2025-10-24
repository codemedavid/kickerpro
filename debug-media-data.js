/**
 * Debug Media Data Format
 * This script helps debug what data is being sent to the database
 */

const testMediaData = [
  {
    type: 'image',
    url: 'https://example.com/test.jpg',
    is_reusable: true,
    filename: 'test.jpg',
    size: 1024000,
    mime_type: 'image/jpeg'
  }
];

console.log('🧪 Testing Media Data Format...\n');

console.log('1. Test data structure:');
console.log(JSON.stringify(testMediaData, null, 2));

console.log('\n2. JSON validation:');
try {
  const jsonString = JSON.stringify(testMediaData);
  const parsed = JSON.parse(jsonString);
  console.log('✅ JSON is valid');
  console.log('✅ Array length:', parsed.length);
  console.log('✅ First item type:', parsed[0].type);
  console.log('✅ First item URL:', parsed[0].url);
} catch (error) {
  console.error('❌ JSON validation failed:', error.message);
}

console.log('\n3. Database constraint check:');
console.log('The constraint expects:');
console.log('- media_attachments IS NULL OR');
console.log('- jsonb_typeof(media_attachments) = "array"');
console.log('- jsonb_array_length(media_attachments) <= 10');

console.log('\n4. Common issues:');
console.log('❌ Missing "type" field');
console.log('❌ Missing "url" field');
console.log('❌ Invalid type (not image|video|audio|file)');
console.log('❌ Invalid URL (not starting with https://)');
console.log('❌ Too many attachments (>10)');

console.log('\n5. Fix the database constraint:');
console.log('Run this SQL in Supabase SQL Editor:');
console.log(`
ALTER TABLE messages DROP CONSTRAINT IF EXISTS check_media_attachments_valid;
ALTER TABLE messages ADD CONSTRAINT check_media_attachments_simple 
CHECK (
  media_attachments IS NULL OR 
  (
    jsonb_typeof(media_attachments) = 'array' AND
    jsonb_array_length(media_attachments) <= 10
  )
);
`);

console.log('\n🎯 Next steps:');
console.log('1. Run the SQL fix above');
console.log('2. Try uploading a file again');
console.log('3. Check the browser console for any remaining errors');
