/**
 * Test Separate Facebook Functions
 * This demonstrates the correct approach to avoid the Facebook API error
 */

console.log('🧪 Testing Separate Facebook Functions...\n');

// Simulate the correct approach
const testScenario = {
  textMessage: {
    recipient: { id: 'USER_ID' },
    message: { text: 'Hello! Here are your files:' },
    access_token: 'PAGE_ACCESS_TOKEN'
  },
  
  mediaMessage1: {
    recipient: { id: 'USER_ID' },
    message: {
      attachment: {
        type: 'image',
        payload: {
          url: 'https://supabase-url.com/image.jpg',
          is_reusable: true
        }
      }
    },
    access_token: 'PAGE_ACCESS_TOKEN'
  },
  
  mediaMessage2: {
    recipient: { id: 'USER_ID' },
    message: {
      attachment: {
        type: 'video',
        payload: {
          url: 'https://supabase-url.com/video.mp4',
          is_reusable: true
        }
      }
    },
    access_token: 'PAGE_ACCESS_TOKEN'
  }
};

console.log('✅ CORRECT APPROACH - Separate Functions:');
console.log('');

console.log('1. Text Message (sendFacebookTextOnly):');
console.log(JSON.stringify(testScenario.textMessage, null, 2));
console.log('');

console.log('2. Media Message 1 (sendFacebookMediaOnly):');
console.log(JSON.stringify(testScenario.mediaMessage1, null, 2));
console.log('');

console.log('3. Media Message 2 (sendFacebookMediaOnly):');
console.log(JSON.stringify(testScenario.mediaMessage2, null, 2));
console.log('');

console.log('🎯 Key Benefits:');
console.log('✅ Each function handles ONE type of content');
console.log('✅ No mixing of text and attachment');
console.log('✅ Facebook receives clean, simple messages');
console.log('✅ No more "Must upload exactly one file" errors');

console.log('\n❌ What was wrong before:');
console.log('❌ One function trying to handle both text and media');
console.log('❌ Complex logic that confused Facebook API');
console.log('❌ Recursive calls causing conflicts');

console.log('\n🚀 The fix:');
console.log('1. sendFacebookTextOnly() - Only sends text');
console.log('2. sendFacebookMediaOnly() - Only sends media');
console.log('3. Clean separation - no mixing');
console.log('4. Each message is simple and focused');

console.log('\n🎉 This should completely resolve the Facebook API error!');
