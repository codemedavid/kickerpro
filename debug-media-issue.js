/**
 * Debug Media Issue
 * 
 * This script helps debug why media attachments are not working.
 * Run this to identify the exact problem.
 */

console.log('🔍 DEBUGGING MEDIA ATTACHMENT ISSUES\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('STEP 1: Check Database Schema');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Run this SQL in Supabase SQL Editor:');
console.log('');
console.log('SELECT column_name, data_type, is_nullable');
console.log('FROM information_schema.columns');
console.log('WHERE table_name = \'messages\' AND column_name = \'media_attachments\';');
console.log('');
console.log('✅ Expected: column_name = media_attachments, data_type = jsonb');
console.log('❌ If no results: Run database migration script');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('STEP 2: Test Database Insert');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Run this SQL in Supabase SQL Editor:');
console.log('');
console.log('-- First, get a valid page_id and user_id');
console.log('SELECT id FROM facebook_pages LIMIT 1;');
console.log('SELECT id FROM users LIMIT 1;');
console.log('');
console.log('-- Then insert test message with media');
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
console.log('  \'Debug Test\',');
console.log('  \'Testing media attachments\',');
console.log('  \'YOUR_PAGE_ID_HERE\', -- Replace with actual page ID');
console.log('  \'YOUR_USER_ID_HERE\', -- Replace with actual user ID');
console.log('  \'all\',');
console.log('  0,');
console.log('  \'draft\',');
console.log('  \'[{"type": "image", "url": "https://example.com/test.jpg", "is_reusable": true}]\'::jsonb');
console.log(');');
console.log('');
console.log('✅ Expected: 1 row inserted');
console.log('❌ If error: Check column exists and permissions');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('STEP 3: Check API Logs');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('1. Open browser DevTools (F12)');
console.log('2. Go to Network tab');
console.log('3. Try to create a message with media');
console.log('4. Look for the POST request to /api/messages');
console.log('5. Check the request payload includes media_attachments');
console.log('');
console.log('✅ Expected: Request body contains media_attachments array');
console.log('❌ If missing: Frontend not sending media data');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('STEP 4: Check Server Logs');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Look for these log messages in your server console:');
console.log('');
console.log('✅ "[Messages API] Message includes X media attachments"');
console.log('❌ If missing: API not receiving media_attachments');
console.log('');
console.log('✅ "[Messages API] Inserting message into database..."');
console.log('❌ If missing: Database insert failing');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('STEP 5: Verify Database Data');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Run this SQL in Supabase SQL Editor:');
console.log('');
console.log('SELECT ');
console.log('  id,');
console.log('  title,');
console.log('  media_attachments,');
console.log('  jsonb_array_length(media_attachments) as media_count');
console.log('FROM messages');
console.log('ORDER BY created_at DESC');
console.log('LIMIT 5;');
console.log('');
console.log('✅ Expected: Recent messages show media_attachments data');
console.log('❌ If NULL: Database insert not working');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('STEP 6: Test Enhanced API');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('1. Create a message with media attachments');
console.log('2. Check if it uses /api/messages/[id]/send-enhanced');
console.log('3. Look for these log messages:');
console.log('');
console.log('✅ "[Send Enhanced API] Starting to send message with media support"');
console.log('✅ "[Send Enhanced API] Message includes X media attachments"');
console.log('❌ If missing: Enhanced API not being called');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('COMMON FIXES');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔧 FIX 1: Database Migration');
console.log('   → Copy database-media-support.sql to Supabase SQL Editor');
console.log('   → Execute the script');
console.log('   → Verify column exists');
console.log('');

console.log('🔧 FIX 2: API Route Update');
console.log('   → Check /api/messages/route.ts includes media_attachments');
console.log('   → Verify messageData includes media_attachments field');
console.log('   → Test with console.log statements');
console.log('');

console.log('🔧 FIX 3: Frontend Data Sending');
console.log('   → Check compose page sends media_attachments in request');
console.log('   → Verify file upload creates proper attachment objects');
console.log('   → Test with browser DevTools Network tab');
console.log('');

console.log('🔧 FIX 4: Enhanced API Endpoint');
console.log('   → Ensure /api/messages/[id]/send-enhanced exists');
console.log('   → Check it handles media_attachments from database');
console.log('   → Verify Facebook API calls include attachments');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🎯 QUICK DIAGNOSIS CHECKLIST:');
console.log('');
console.log('□ Database has media_attachments column');
console.log('□ API route extracts media_attachments from request');
console.log('□ API route includes media_attachments in messageData');
console.log('□ Frontend sends media_attachments in request body');
console.log('□ Enhanced API endpoint exists and works');
console.log('□ Facebook API calls include attachment data');
console.log('');
console.log('Run through each step above to identify the exact issue! 🔍');
