/**
 * Test Database Media Support
 * 
 * This script tests if the media_attachments column exists and works
 * in your Supabase database.
 * 
 * Usage:
 * node test-database-media.js
 */

async function testDatabaseMedia() {
  console.log('🧪 Testing Database Media Support\n');
  
  // Test 1: Check if media_attachments column exists
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Database Schema Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('To check if media_attachments column exists, run this SQL in Supabase SQL Editor:');
  console.log('');
  console.log('SELECT column_name, data_type, is_nullable');
  console.log('FROM information_schema.columns');
  console.log('WHERE table_name = \'messages\' AND column_name = \'media_attachments\';');
  console.log('');
  console.log('Expected result:');
  console.log('column_name: media_attachments');
  console.log('data_type: jsonb');
  console.log('is_nullable: YES');
  console.log('');

  // Test 2: Test inserting media data
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Media Data Insert Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Test SQL to run in Supabase SQL Editor:');
  console.log('');
  console.log('-- Test insert with media attachments');
  console.log('INSERT INTO messages (');
  console.log('  title,');
  console.log('  content,');
  console.log('  page_id,');
  console.log('  created_by,');
  console.log('  recipient_type,');
  console.log('  recipient_count,');
  console.log('  status,');
  console.log('  media_attachments');
  console.log(') VALUES (');
  console.log('  \'Test Media Message\',');
  console.log('  \'This is a test message with media\',');
  console.log('  (SELECT id FROM facebook_pages LIMIT 1),');
  console.log('  (SELECT id FROM users LIMIT 1),');
  console.log('  \'all\',');
  console.log('  0,');
  console.log('  \'draft\',');
  console.log('  \'[{"type": "image", "url": "https://example.com/test.jpg", "is_reusable": true}]\'::jsonb');
  console.log(');');
  console.log('');
  console.log('Expected result: 1 row inserted');
  console.log('');

  // Test 3: Test querying media data
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Media Data Query Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Test SQL to run in Supabase SQL Editor:');
  console.log('');
  console.log('-- Query messages with media');
  console.log('SELECT ');
  console.log('  id,');
  console.log('  title,');
  console.log('  content,');
  console.log('  media_attachments,');
  console.log('  jsonb_array_length(media_attachments) as media_count');
  console.log('FROM messages');
  console.log('WHERE media_attachments IS NOT NULL;');
  console.log('');
  console.log('Expected result: Messages with media attachments');
  console.log('');

  // Test 4: Check for errors
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 4: Common Issues & Solutions');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('❌ If you get "column media_attachments does not exist":');
  console.log('   → Run the database migration script');
  console.log('   → Copy database-media-support.sql to Supabase SQL Editor');
  console.log('   → Execute the script');
  console.log('');
  
  console.log('❌ If you get "permission denied":');
  console.log('   → Check your Supabase RLS policies');
  console.log('   → Ensure the user has INSERT permissions');
  console.log('');
  
  console.log('❌ If media_attachments is always NULL:');
  console.log('   → Check the API route includes media_attachments in messageData');
  console.log('   → Verify the frontend sends media_attachments in the request');
  console.log('   → Check console logs for "Message includes X media attachments"');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 NEXT STEPS:');
  console.log('1. Run the database migration script');
  console.log('2. Test the SQL queries above');
  console.log('3. Check your API logs for media attachment messages');
  console.log('4. Verify the frontend is sending media_attachments');
  console.log('');
}

testDatabaseMedia();
