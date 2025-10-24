/**
 * Facebook Send API Test Script
 * Tests sending a message to a recipient via Facebook Graph API
 * 
 * Usage:
 * node test-facebook-send.js <PAGE_ACCESS_TOKEN> <RECIPIENT_ID> [MESSAGE_TAG]
 */

async function testFacebookSend(accessToken, recipientId, messageTag = null) {
  console.log('🧪 Testing Facebook Send API...\n');
  console.log('📋 Configuration:');
  console.log('  - Access Token:', accessToken.substring(0, 20) + '...');
  console.log('  - Recipient ID:', recipientId);
  console.log('  - Message Tag:', messageTag || 'None (standard messaging)');
  console.log('');

  const url = 'https://graph.facebook.com/v18.0/me/messages';
  
  const postData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: '🧪 Test message from Facebook Bulk Messenger - ' + new Date().toISOString()
    },
    access_token: accessToken
  };

  // Add message tag if specified
  if (messageTag) {
    postData.messaging_type = 'MESSAGE_TAG';
    postData.tag = messageTag;
  }

  console.log('📤 Sending POST request to:', url);
  console.log('📦 Request body:');
  console.log(JSON.stringify(postData, null, 2).replace(accessToken, '***TOKEN***'));
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    });

    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('');

    const data = await response.json();

    if (response.ok && data.message_id) {
      console.log('✅ SUCCESS!');
      console.log('   Message ID:', data.message_id);
      console.log('   Recipient ID:', data.recipient_id);
      console.log('');
      console.log('🎉 Message sent successfully!');
      return { success: true, data };
    } else {
      console.log('❌ FAILED!');
      console.log('   Error:', JSON.stringify(data.error, null, 2));
      console.log('');
      
      // Detailed error analysis
      if (data.error) {
        console.log('🔍 Error Analysis:');
        console.log('   Code:', data.error.code);
        console.log('   Subcode:', data.error.error_subcode);
        console.log('   Message:', data.error.message);
        console.log('   Type:', data.error.type);
        console.log('');

        // Common errors
        if (data.error.code === 190) {
          console.log('💡 FIX: Token expired. User needs to logout and login again.');
        } else if (data.error.code === 10 && data.error.error_subcode === 2018278) {
          console.log('💡 FIX: 24-hour messaging policy violation.');
          console.log('   - Use a message tag like ACCOUNT_UPDATE');
          console.log('   - Or ensure user messaged page within 24 hours');
        } else if (data.error.code === 200) {
          console.log('💡 FIX: Permission issue. Check app permissions.');
        } else if (data.error.code === 100) {
          console.log('💡 FIX: Invalid parameter. Check recipient ID format.');
        }
      }
      
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR!');
    console.log('   Message:', error.message);
    console.log('   Stack:', error.stack);
    console.log('');
    return { success: false, error: error.message };
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('❌ Error: Missing required arguments\n');
  console.log('Usage: node test-facebook-send.js <PAGE_ACCESS_TOKEN> <RECIPIENT_ID> [MESSAGE_TAG]\n');
  console.log('Example:');
  console.log('  node test-facebook-send.js "EAABsb..." "1234567890" ACCOUNT_UPDATE');
  console.log('');
  console.log('Available Message Tags:');
  console.log('  - ACCOUNT_UPDATE');
  console.log('  - CONFIRMED_EVENT_UPDATE');
  console.log('  - POST_PURCHASE_UPDATE');
  console.log('  - HUMAN_AGENT');
  console.log('');
  process.exit(1);
}

const [accessToken, recipientId, messageTag] = args;

testFacebookSend(accessToken, recipientId, messageTag).then(result => {
  if (result.success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

