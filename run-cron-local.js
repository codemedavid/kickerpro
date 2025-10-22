#!/usr/bin/env node

/**
 * Local Cron Job Runner
 * 
 * Runs the scheduled message cron every minute during development.
 * 
 * Usage:
 *   node run-cron-local.js
 * 
 * Press Ctrl+C to stop
 */

const CRON_URL = 'http://localhost:3000/api/cron/send-scheduled';
const CRON_SECRET = process.env.CRON_SECRET || 'test_secret_123';
const CHECK_INTERVAL = 60000; // 60 seconds (1 minute)

console.log('🕐 Starting local cron job runner...');
console.log(`📍 URL: ${CRON_URL}`);
console.log(`⏱️  Interval: Every ${CHECK_INTERVAL / 1000} seconds`);
console.log(`🔑 Secret: ${CRON_SECRET.substring(0, 10)}...`);
console.log('\n⚡ Press Ctrl+C to stop\n');
console.log('─'.repeat(60));

let runCount = 0;

async function runCron() {
  runCount++;
  const now = new Date();
  const timestamp = now.toLocaleTimeString();
  
  console.log(`\n[${timestamp}] Run #${runCount} - Checking for scheduled messages...`);
  
  try {
    const response = await fetch(CRON_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      if (data.messages_found > 0) {
        console.log(`✅ Found ${data.messages_found} message(s) to send`);
        console.log(`📨 Sent: ${data.sent}, Failed: ${data.failed}`);
        
        if (data.results && data.results.length > 0) {
          data.results.forEach((result, index) => {
            if (result.success) {
              console.log(`   ${index + 1}. ✅ "${result.title}" - Sent: ${result.sent}, Failed: ${result.failed}`);
            } else {
              console.log(`   ${index + 1}. ❌ "${result.title}" - Error: ${result.error}`);
            }
          });
        }
      } else {
        console.log('💤 No messages due to send');
      }
    } else {
      console.error('❌ Cron request failed:', response.status);
      console.error('   Response:', data);
    }
  } catch (error) {
    console.error('❌ Error calling cron endpoint:', error.message);
    console.error('   Make sure your dev server is running on http://localhost:3000');
  }
  
  console.log('─'.repeat(60));
}

// Run immediately
runCron();

// Then run every minute
setInterval(runCron, CHECK_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping cron job runner...');
  console.log(`✅ Ran ${runCount} times`);
  process.exit(0);
});

