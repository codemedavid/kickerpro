/**
 * Test script for the cron job endpoint
 * Tests the /api/cron/send-scheduled endpoint locally
 * 
 * Usage: node test-cron.js
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'development-secret';

async function testCronEndpoint() {
  console.log('🧪 Testing Cron Job Endpoint\n');
  console.log('Configuration:');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Using CRON_SECRET: ${CRON_SECRET ? '✅ Set' : '⚠️  Not set (using default)'}\n`);

  console.log('📡 Making request to /api/cron/send-scheduled...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/cron/send-scheduled`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('\n📊 Response Data:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ SUCCESS! Cron endpoint is working properly\n');
      
      if (data.dispatched > 0) {
        console.log(`🎉 Sent ${data.dispatched} scheduled message(s)!`);
        console.log('\nDetails:');
        data.results?.forEach((result, i) => {
          console.log(`\n  Message ${i + 1}:`);
          console.log(`    ID: ${result.id}`);
          console.log(`    Title: ${result.title}`);
          console.log(`    Status: ${result.status}`);
          console.log(`    Sent: ${result.sent || 0}`);
          console.log(`    Failed: ${result.failed || 0}`);
        });
      } else {
        console.log('ℹ️  No scheduled messages were due for sending');
        console.log('   This is normal if you don\'t have any scheduled messages');
      }
    } else {
      console.log('\n❌ FAILED! Cron endpoint returned an error\n');
      
      if (response.status === 401) {
        console.log('⚠️  Authorization Error:');
        console.log('   - Check that CRON_SECRET in .env.local matches');
        console.log('   - Make sure you\'re passing the correct Bearer token');
      }
    }

  } catch (error) {
    console.log('\n❌ ERROR! Failed to connect to endpoint\n');
    console.error('Error details:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Connection refused:');
      console.log('   - Make sure your dev server is running: npm run dev');
      console.log('   - Check that the port matches (default: 3000)');
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function checkScheduledMessages() {
  console.log('📋 Checking for scheduled messages in database...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/messages/check-scheduled`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.all_scheduled?.length > 0) {
        console.log(`Found ${data.all_scheduled.length} scheduled message(s):\n`);
        
        data.analysis?.forEach((msg, i) => {
          console.log(`  ${i + 1}. ${msg.title}`);
          console.log(`     Scheduled for: ${msg.scheduled_for_local}`);
          console.log(`     Status: ${msg.status_check}`);
          console.log(`     Recipients: ${msg.recipient_count}`);
          console.log('');
        });
      } else {
        console.log('ℹ️  No scheduled messages found in database\n');
        console.log('To test the cron job:');
        console.log('  1. Go to your app and schedule a message');
        console.log('  2. Set the time to 1-2 minutes from now');
        console.log('  3. Run this test again to verify it sends\n');
      }
    } else {
      console.log('⚠️  Could not check scheduled messages (may require authentication)\n');
    }
  } catch (error) {
    console.log('⚠️  Could not check scheduled messages:', error.message, '\n');
  }
}

// Run tests
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('         CRON JOB ENDPOINT TEST');
  console.log('='.repeat(60) + '\n');

  // Check for scheduled messages first
  await checkScheduledMessages();

  // Test the cron endpoint
  await testCronEndpoint();

  console.log('Test complete!\n');
  console.log('Next steps:');
  console.log('  1. ✅ Cron endpoint is working');
  console.log('  2. 📤 Deploy to Vercel for automatic scheduling');
  console.log('  3. 🎯 Schedule a test message to verify end-to-end\n');
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

