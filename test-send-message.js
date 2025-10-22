#!/usr/bin/env node

/**
 * Test Script: Send Message to Specific User
 * 
 * Usage: node test-send-message.js
 * 
 * This tests sending a message to:
 * - Page: 505302195998738 (UUID: a430e86c-3f86-44fa-9148-1f10f45a5ccc)
 * - Recipient: 24934311549542539
 */

const BASE_URL = 'http://localhost:3000';

async function testSendMessage() {
  console.log('🧪 Starting message send test...\n');

  // Step 1: Check diagnostics
  console.log('Step 1: Checking system diagnostics...');
  try {
    const diagResponse = await fetch(`${BASE_URL}/api/diagnostics`);
    const diagData = await diagResponse.json();
    console.log('✅ Diagnostics:', JSON.stringify(diagData, null, 2));
    
    if (diagData.diagnostics?.database?.hasSelectedRecipientsColumn !== '✅ Yes') {
      console.error('\n❌ ERROR: Database not migrated!');
      console.error('Run this SQL in Supabase SQL Editor:\n');
      console.error('ALTER TABLE messages ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];');
      console.error('ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_recipient_type_check;');
      console.error('ALTER TABLE messages ADD CONSTRAINT messages_recipient_type_check CHECK (recipient_type IN (\'all\', \'active\', \'selected\'));');
      process.exit(1);
    }
  } catch (error) {
    console.error('⚠️  Could not check diagnostics:', error.message);
  }

  console.log('\n---\n');

  // Step 2: Get cookies from browser
  console.log('Step 2: Cookie Check');
  console.log('⚠️  This script needs authentication cookies from your browser.');
  console.log('Option 1: Copy cookies manually');
  console.log('Option 2: Use the API endpoint directly from browser console\n');

  // Test data
  const messageData = {
    title: 'Test Message from Script',
    content: 'Hello! This is a test message sent via Node.js script.',
    page_id: 'a430e86c-3f86-44fa-9148-1f10f45a5ccc', // UUID in Supabase
    created_by: '', // Will be filled from cookie
    recipient_type: 'selected',
    recipient_count: 1,
    status: 'draft', // Use draft to avoid actually sending
    scheduled_for: null,
    selected_recipients: ['24934311549542539']
  };

  console.log('Step 3: Message Data');
  console.log(JSON.stringify(messageData, null, 2));

  console.log('\n---\n');

  console.log('Step 4: Test via Browser Console');
  console.log('Copy and paste this into your browser console (F12):\n');
  console.log('```javascript');
  console.log(`fetch('${BASE_URL}/api/messages', {`);
  console.log('  method: \'POST\',');
  console.log('  headers: { \'Content-Type\': \'application/json\' },');
  console.log('  body: JSON.stringify(' + JSON.stringify(messageData, null, 2) + ')');
  console.log('})');
  console.log('.then(r => r.json())');
  console.log('.then(data => {');
  console.log('  console.log(\'✅ Success:\', data);');
  console.log('  if (data.message?.id) {');
  console.log('    console.log(\'Message ID:\', data.message.id);');
  console.log('    // To actually send it:');
  console.log('    // return fetch(`/api/messages/${data.message.id}/send`, { method: \'POST\' })');
  console.log('    //   .then(r => r.json())');
  console.log('    //   .then(result => console.log(\'Send result:\', result));');
  console.log('  }');
  console.log('})');
  console.log('.catch(err => console.error(\'❌ Error:\', err));');
  console.log('```');

  console.log('\n---\n');

  console.log('📋 Manual Testing Steps:\n');
  console.log('1. ✅ Run the SQL migration in Supabase');
  console.log('2. ✅ Refresh Supabase page (clear schema cache)');
  console.log('3. ✅ Open your app in browser: http://localhost:3000');
  console.log('4. ✅ Login with Facebook');
  console.log('5. ✅ Open browser console (F12)');
  console.log('6. ✅ Paste the fetch command above');
  console.log('7. ✅ Press Enter');
  console.log('8. ✅ Check the response\n');

  console.log('Expected Success Response:');
  console.log('```json');
  console.log('{');
  console.log('  "success": true,');
  console.log('  "message": {');
  console.log('    "id": "some-uuid-here",');
  console.log('    "title": "Test Message from Script",');
  console.log('    "status": "draft",');
  console.log('    "selected_recipients": ["24934311549542539"]');
  console.log('  }');
  console.log('}');
  console.log('```');

  console.log('\n✅ Test script complete!');
  console.log('\n🚀 Ready to test in browser!');
}

// Run the test
testSendMessage().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

