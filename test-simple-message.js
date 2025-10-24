/**
 * Simple Message Test
 * Tests basic messaging without personalization first
 */

async function testSimpleMessage() {
  console.log('🧪 Testing Simple Message (No Personalization)\n');
  
  console.log('Step 1: Test basic message sending');
  console.log('1. Go to /dashboard/compose');
  console.log('2. Write a simple message WITHOUT {first_name} or {last_name}');
  console.log('3. Send the message');
  console.log('4. Check if it works');
  console.log('');
  
  console.log('Step 2: Test with personalization');
  console.log('1. Write a message WITH {first_name}');
  console.log('2. Send the message');
  console.log('3. Check server logs for personalization messages');
  console.log('');
  
  console.log('Step 3: Test cancel button');
  console.log('1. Send a message');
  console.log('2. Immediately click cancel button');
  console.log('3. Check if cancel works');
  console.log('');
  
  console.log('Expected server logs for personalization:');
  console.log('[Personalization] Personalized message for 1234567890...');
  console.log('');
  
  console.log('Expected server logs for cancel:');
  console.log('[Cancel API] Cancelling message: {message-id}');
  console.log('[Cancel API] Message cancelled successfully');
  console.log('');
  
  console.log('If personalization fails, check for:');
  console.log('❌ Facebook API error: Permission denied');
  console.log('❌ Facebook API error: Rate limit exceeded');
  console.log('❌ Facebook API error: User data not available');
  console.log('');
  
  console.log('If cancel fails, check for:');
  console.log('❌ Cancel button not showing (message status issue)');
  console.log('❌ Cancel API 404 (endpoint not found)');
  console.log('❌ Cancel API 401 (authentication failed)');
  console.log('❌ Cancel API 400 (message already completed)');
  console.log('');
  
  console.log('✅ Test completed! Try these steps and check your server logs.');
}

testSimpleMessage();
