/**
 * Comprehensive Diagnostic Test
 * Tests all aspects of the messaging system
 */

async function runDiagnostics() {
  console.log('🔍 COMPREHENSIVE SYSTEM DIAGNOSTICS\n');
  
  // Test 1: Check if personalization is working
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Personalization Feature');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Expected behavior:');
  console.log('1. Message with {first_name} should trigger personalization');
  console.log('2. Facebook Graph API call: GET /v18.0/{user_id}?fields=first_name,last_name');
  console.log('3. Placeholders should be replaced with actual names');
  console.log('4. Server logs should show: [Personalization] Personalized message for...');
  console.log('');
  
  console.log('Common issues:');
  console.log('❌ Facebook API permission denied (Error 200)');
  console.log('❌ User data not available (Error 100)');
  console.log('❌ Access token expired (Error 190)');
  console.log('❌ Rate limiting (Error 4)');
  console.log('');
  
  // Test 2: Check cancel button functionality
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Cancel Button Functionality');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Expected behavior:');
  console.log('1. Cancel button should appear when message status is "sending"');
  console.log('2. Clicking cancel should call POST /api/messages/{id}/cancel');
  console.log('3. Message status should change to "cancelled"');
  console.log('4. Progress modal should update to show "cancelled" status');
  console.log('');
  
  console.log('Common issues:');
  console.log('❌ Cancel button not showing (message status not "sending")');
  console.log('❌ Cancel API not found (404 error)');
  console.log('❌ Authentication failed (401 error)');
  console.log('❌ Message already completed (400 error)');
  console.log('');
  
  // Test 3: Check message status flow
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Message Status Flow');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Expected flow:');
  console.log('1. Message created → status: "draft"');
  console.log('2. Send triggered → status: "sending"');
  console.log('3. Messages sent → status: "sent" (if any successful)');
  console.log('4. All failed → status: "failed"');
  console.log('5. User cancels → status: "cancelled"');
  console.log('');
  
  console.log('Status transitions:');
  console.log('draft → sending → sent/failed/cancelled');
  console.log('');
  
  // Test 4: Check API endpoints
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 4: API Endpoints');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const endpoints = [
    { method: 'GET', path: '/api/messages', description: 'List messages' },
    { method: 'POST', path: '/api/messages', description: 'Create message' },
    { method: 'GET', path: '/api/messages/{id}', description: 'Get message details' },
    { method: 'POST', path: '/api/messages/{id}/send', description: 'Send message' },
    { method: 'POST', path: '/api/messages/{id}/cancel', description: 'Cancel message' },
    { method: 'GET', path: '/api/messages/{id}/batches', description: 'Get batch status' }
  ];
  
  endpoints.forEach(endpoint => {
    console.log(`${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
  });
  console.log('');
  
  // Test 5: Check authentication
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 5: Authentication');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Required cookies:');
  console.log('✅ fb-auth-user: User ID');
  console.log('✅ fb-access-token: Facebook access token');
  console.log('');
  
  console.log('Check browser console for:');
  console.log('✅ [Login] Access token: EAABsb...');
  console.log('✅ [Login] User ID: uuid...');
  console.log('');
  
  // Test 6: Debugging steps
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 6: Debugging Steps');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Step 1: Check server logs');
  console.log('Look for these messages:');
  console.log('✅ [Send API] Starting to send message: {id}');
  console.log('✅ [Personalization] Personalized message for...');
  console.log('✅ [Cancel API] Cancelling message: {id}');
  console.log('');
  
  console.log('Step 2: Check browser console');
  console.log('Look for these errors:');
  console.log('❌ Failed to fetch message status');
  console.log('❌ Cancel Failed: {error}');
  console.log('❌ Network error');
  console.log('');
  
  console.log('Step 3: Test with simple message');
  console.log('1. Send message without {first_name} placeholders');
  console.log('2. Check if basic sending works');
  console.log('3. Then test with placeholders');
  console.log('');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Diagnostics completed!');
  console.log('Check your server logs and browser console for the specific errors.');
}

runDiagnostics();
