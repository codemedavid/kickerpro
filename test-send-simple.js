/**
 * Simple Facebook Send Test
 * No dependencies required!
 * 
 * Usage:
 * node test-send-simple.js <ACCESS_TOKEN> <RECIPIENT_ID>
 */

async function testFacebookSend(accessToken, recipientId) {
  console.log('🧪 Testing Facebook Send API\n');
  console.log('Access Token:', accessToken.substring(0, 30) + '...');
  console.log('Recipient ID:', recipientId);
  console.log('');

  const url = 'https://graph.facebook.com/v18.0/me/messages';
  
  // Test 1: WITHOUT message tag
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Standard Messaging (no tag)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const test1Data = {
    recipient: { id: recipientId },
    message: { text: '🧪 Test 1: Standard messaging - ' + new Date().toISOString() },
    access_token: accessToken
  };

  try {
    const response1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test1Data)
    });

    const data1 = await response1.json();
    
    if (response1.ok && data1.message_id) {
      console.log('✅ SUCCESS!');
      console.log('   Message ID:', data1.message_id);
    } else {
      console.log('❌ FAILED!');
      console.log('   Status:', response1.status);
      console.log('   Error Code:', data1.error?.code);
      console.log('   Error Subcode:', data1.error?.error_subcode);
      console.log('   Message:', data1.error?.message);
      
      if (data1.error?.code === 10 && data1.error?.error_subcode === 2018278) {
        console.log('\n💡 This is the 24-hour policy error!');
        console.log('   User hasn\'t messaged the page in 24 hours.');
      } else if (data1.error?.code === 190) {
        console.log('\n💡 Access token expired!');
        console.log('   User needs to logout and login again.');
      }
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
  }

  console.log('');

  // Test 2: WITH message tag
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: With ACCOUNT_UPDATE Tag');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const test2Data = {
    recipient: { id: recipientId },
    message: { text: '🧪 Test 2: With tag - ' + new Date().toISOString() },
    messaging_type: 'MESSAGE_TAG',
    tag: 'ACCOUNT_UPDATE',
    access_token: accessToken
  };

  try {
    const response2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test2Data)
    });

    const data2 = await response2.json();
    
    if (response2.ok && data2.message_id) {
      console.log('✅ SUCCESS!');
      console.log('   Message ID:', data2.message_id);
      console.log('\n🎉 Message tags work! Use ACCOUNT_UPDATE for all sends.');
    } else {
      console.log('❌ FAILED!');
      console.log('   Status:', response2.status);
      console.log('   Error Code:', data2.error?.code);
      console.log('   Error Subcode:', data2.error?.error_subcode);
      console.log('   Message:', data2.error?.message);
      
      if (data2.error?.code === 200) {
        console.log('\n💡 Permission denied!');
        console.log('   Your app may not have permission for message tags.');
      }
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('\n❌ Usage: node test-send-simple.js <ACCESS_TOKEN> <RECIPIENT_ID>\n');
  console.log('Example:');
  console.log('  node test-send-simple.js "EAABsb..." "1234567890"\n');
  console.log('Where to get these values:');
  console.log('  1. Access Token: Check browser console after login');
  console.log('  2. Recipient ID: From conversations table (sender_id)\n');
  process.exit(1);
}

testFacebookSend(args[0], args[1]);

