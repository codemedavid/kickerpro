/**
 * Debug Script for Facebook Send Issues
 * 
 * This script helps debug why messages are failing by:
 * 1. Testing Facebook API connectivity
 * 2. Validating access tokens
 * 3. Checking recipient IDs
 * 4. Testing with and without message tags
 * 
 * Setup:
 * 1. Copy .env.local.example to .env.local
 * 2. Fill in your Supabase credentials
 * 3. Run: node test-send-debug.js
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('❌ Error: Missing Supabase credentials in .env.local\n');
  console.log('Required variables:');
  console.log('  - NEXT_PUBLIC_SUPABASE_URL');
  console.log('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.log('');
  process.exit(1);
}

async function fetchTestData() {
  console.log('🔍 Fetching test data from Supabase...\n');

  try {
    // Fetch a page with access token
    const pagesResponse = await fetch(`${SUPABASE_URL}/rest/v1/facebook_pages?limit=1&select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (!pagesResponse.ok) {
      throw new Error(`Failed to fetch pages: ${pagesResponse.statusText}`);
    }

    const pages = await pagesResponse.json();
    
    if (!pages || pages.length === 0) {
      console.log('❌ No Facebook pages found in database');
      console.log('💡 Please add a page first via the dashboard');
      return null;
    }

    const page = pages[0];
    console.log('✅ Found page:', page.name);
    console.log('   Access Token:', page.access_token ? page.access_token.substring(0, 20) + '...' : 'Missing!');

    // Fetch a conversation/recipient
    const convoResponse = await fetch(`${SUPABASE_URL}/rest/v1/messenger_conversations?page_id=eq.${page.facebook_page_id}&limit=1&select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (!convoResponse.ok) {
      throw new Error(`Failed to fetch conversations: ${convoResponse.statusText}`);
    }

    const convos = await convoResponse.json();
    
    if (!convos || convos.length === 0) {
      console.log('⚠️  No conversations found for this page');
      console.log('💡 You need to sync conversations first');
      return { page, recipient: null };
    }

    const recipient = convos[0];
    console.log('✅ Found recipient:', recipient.sender_name || 'Unknown');
    console.log('   Recipient ID:', recipient.sender_id);
    console.log('');

    return { page, recipient };
  } catch (error) {
    console.log('❌ Error fetching data:', error.message);
    return null;
  }
}

async function testSendMessage(accessToken, recipientId, useTag = false) {
  const url = 'https://graph.facebook.com/v18.0/me/messages';
  
  const postData = {
    recipient: { id: recipientId },
    message: {
      text: `🧪 Test message - ${new Date().toISOString()}`
    },
    access_token: accessToken
  };

  if (useTag) {
    postData.messaging_type = 'MESSAGE_TAG';
    postData.tag = 'ACCOUNT_UPDATE';
  }

  console.log(`📤 Sending test message ${useTag ? 'WITH' : 'WITHOUT'} message tag...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });

    const data = await response.json();

    if (response.ok && data.message_id) {
      console.log(`✅ SUCCESS! Message ID: ${data.message_id}\n`);
      return { success: true, data };
    } else {
      console.log(`❌ FAILED!`);
      console.log(`   Error Code: ${data.error?.code}`);
      console.log(`   Error Subcode: ${data.error?.error_subcode}`);
      console.log(`   Message: ${data.error?.message}\n`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log(`❌ NETWORK ERROR: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Facebook Send API Debug Tool\n');
  console.log('================================\n');

  const testData = await fetchTestData();
  
  if (!testData || !testData.page) {
    console.log('\n❌ Cannot continue without test data');
    process.exit(1);
  }

  if (!testData.recipient) {
    console.log('\n⚠️  No recipient found to test with');
    console.log('💡 Sync conversations first, then run this script again');
    process.exit(1);
  }

  const { page, recipient } = testData;

  console.log('🚀 Starting tests...\n');
  console.log('Test 1: Send WITHOUT message tag (standard messaging)');
  console.log('------------------------------------------------------');
  const test1 = await testSendMessage(page.access_token, recipient.sender_id, false);

  console.log('Test 2: Send WITH message tag (ACCOUNT_UPDATE)');
  console.log('------------------------------------------------------');
  const test2 = await testSendMessage(page.access_token, recipient.sender_id, true);

  console.log('📊 Summary');
  console.log('==========');
  console.log(`Standard messaging: ${test1.success ? '✅ WORKS' : '❌ FAILED'}`);
  console.log(`With message tag: ${test2.success ? '✅ WORKS' : '❌ FAILED'}`);
  console.log('');

  if (!test1.success && test1.error?.code === 10 && test1.error?.error_subcode === 2018278) {
    console.log('💡 DIAGNOSIS: 24-hour messaging window expired');
    console.log('   The recipient has not messaged the page within 24 hours.');
    console.log('   SOLUTION: Use message tags (ACCOUNT_UPDATE) for all sends.');
    console.log('');
  }

  if (!test1.success && test1.error?.code === 190) {
    console.log('💡 DIAGNOSIS: Access token expired');
    console.log('   SOLUTION: User needs to logout and login again.');
    console.log('');
  }

  if (!test2.success && test2.error?.code === 200) {
    console.log('💡 DIAGNOSIS: Permission denied for message tag');
    console.log('   Your Facebook app may not have permission to use message tags.');
    console.log('   SOLUTION: Check Facebook app settings and request message tag permissions.');
    console.log('');
  }

  if (test1.success || test2.success) {
    console.log('✅ At least one method works! Use that for sending.');
  } else {
    console.log('❌ Both methods failed. Check errors above for solutions.');
  }

  console.log('');
  console.log('📋 Next Steps:');
  console.log('1. Review the errors above');
  console.log('2. Apply suggested fixes');
  console.log('3. Try sending from the dashboard again');
  console.log('');
}

runTests().catch(error => {
  console.log('❌ Fatal error:', error);
  process.exit(1);
});

