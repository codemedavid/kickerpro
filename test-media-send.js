/**
 * Test Media Sending via Facebook Messenger API
 * 
 * This script demonstrates how to send different types of media
 * through the Facebook Messenger Send API.
 * 
 * Usage:
 * node test-media-send.js <ACCESS_TOKEN> <RECIPIENT_ID>
 */

async function testMediaSending(accessToken, recipientId) {
  console.log('🧪 Testing Facebook Media Send API\n');
  console.log('Access Token:', accessToken.substring(0, 30) + '...');
  console.log('Recipient ID:', recipientId);
  console.log('');

  const url = 'https://graph.facebook.com/v18.0/me/messages';
  
  // Test 1: Send Image
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Send Image');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const imageData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'image',
        payload: {
          url: 'https://picsum.photos/800/600',
          is_reusable: true
        }
      }
    },
    access_token: accessToken
  };

  try {
    const response1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageData)
    });

    const data1 = await response1.json();
    
    if (response1.ok && data1.message_id) {
      console.log('✅ IMAGE SENT SUCCESSFULLY!');
      console.log('   Message ID:', data1.message_id);
    } else {
      console.log('❌ IMAGE SEND FAILED!');
      console.log('   Status:', response1.status);
      console.log('   Error:', data1.error?.message);
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
  }

  console.log('');

  // Test 2: Send Video
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Send Video');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const videoData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'video',
        payload: {
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          is_reusable: false
        }
      }
    },
    access_token: accessToken
  };

  try {
    const response2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoData)
    });

    const data2 = await response2.json();
    
    if (response2.ok && data2.message_id) {
      console.log('✅ VIDEO SENT SUCCESSFULLY!');
      console.log('   Message ID:', data2.message_id);
    } else {
      console.log('❌ VIDEO SEND FAILED!');
      console.log('   Status:', response2.status);
      console.log('   Error:', data2.error?.message);
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
  }

  console.log('');

  // Test 3: Send Audio
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Send Audio');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const audioData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'audio',
        payload: {
          url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
          is_reusable: true
        }
      }
    },
    access_token: accessToken
  };

  try {
    const response3 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audioData)
    });

    const data3 = await response3.json();
    
    if (response3.ok && data3.message_id) {
      console.log('✅ AUDIO SENT SUCCESSFULLY!');
      console.log('   Message ID:', data3.message_id);
    } else {
      console.log('❌ AUDIO SEND FAILED!');
      console.log('   Status:', response3.status);
      console.log('   Error:', data3.error?.message);
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
  }

  console.log('');

  // Test 4: Send File
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 4: Send File');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const fileData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'file',
        payload: {
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          is_reusable: false
        }
      }
    },
    access_token: accessToken
  };

  try {
    const response4 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fileData)
    });

    const data4 = await response4.json();
    
    if (response4.ok && data4.message_id) {
      console.log('✅ FILE SENT SUCCESSFULLY!');
      console.log('   Message ID:', data4.message_id);
    } else {
      console.log('❌ FILE SEND FAILED!');
      console.log('   Status:', response4.status);
      console.log('   Error:', data4.error?.message);
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
  }

  console.log('');

  // Test 5: Send Text + Image (Two separate messages)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 5: Send Text + Image (Combined)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // First send text
  const textData = {
    recipient: { id: recipientId },
    message: {
      text: 'Here\'s an image for you! 📸'
    },
    access_token: accessToken
  };

  try {
    const textResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textData)
    });

    const textResult = await textResponse.json();
    
    if (textResponse.ok && textResult.message_id) {
      console.log('✅ TEXT SENT SUCCESSFULLY!');
      console.log('   Message ID:', textResult.message_id);
      
      // Wait a moment, then send image
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const imageResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imageData)
      });

      const imageResult = await imageResponse.json();
      
      if (imageResponse.ok && imageResult.message_id) {
        console.log('✅ IMAGE SENT SUCCESSFULLY!');
        console.log('   Message ID:', imageResult.message_id);
        console.log('\n🎉 Combined text + image sent successfully!');
      } else {
        console.log('❌ IMAGE SEND FAILED!');
        console.log('   Error:', imageResult.error?.message);
      }
    } else {
      console.log('❌ TEXT SEND FAILED!');
      console.log('   Error:', textResult.error?.message);
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 MEDIA SENDING SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Supported Media Types:');
  console.log('   • Images (JPG, PNG, GIF, WebP)');
  console.log('   • Videos (MP4, MOV, AVI)');
  console.log('   • Audio (MP3, WAV, M4A)');
  console.log('   • Files (PDF, DOC, TXT, etc.)');
  console.log('');
  console.log('📏 Size Limits:');
  console.log('   • Images: 25MB max');
  console.log('   • Videos: 25MB max');
  console.log('   • Audio: 25MB max');
  console.log('   • Files: 25MB max');
  console.log('');
  console.log('🔗 URL Requirements:');
  console.log('   • Must be HTTPS');
  console.log('   • Must be publicly accessible');
  console.log('   • Must return proper Content-Type headers');
  console.log('');
  console.log('⚡ Performance Tips:');
  console.log('   • Use is_reusable: true for repeated media');
  console.log('   • Compress images/videos before sending');
  console.log('   • Use CDN for faster delivery');
  console.log('   • Consider file size for mobile users');
}

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('\n❌ Usage: node test-media-send.js <ACCESS_TOKEN> <RECIPIENT_ID>\n');
  console.log('Example:');
  console.log('  node test-media-send.js "EAABsb..." "1234567890"\n');
  console.log('Where to get these values:');
  console.log('  1. Access Token: Check browser console after login');
  console.log('  2. Recipient ID: From conversations table (sender_id)\n');
  process.exit(1);
}

testMediaSending(args[0], args[1]);
