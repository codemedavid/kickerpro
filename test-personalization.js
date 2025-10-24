/**
 * Test Personalization Feature
 * Tests if {first_name} and {last_name} placeholders work
 */

async function testPersonalization() {
  console.log('🧪 Testing Personalization Feature\n');
  
  // Test 1: Check if placeholders are detected
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Placeholder Detection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const testMessages = [
    "Hello {first_name}!",
    "Hi {first_name} {last_name}",
    "Dear {last_name}, your order is ready",
    "Hello world", // No placeholders
    "Hi {first_name}, your {last_name} account is updated"
  ];
  
  testMessages.forEach((message, index) => {
    const hasFirst = message.includes('{first_name}');
    const hasLast = message.includes('{last_name}');
    const needsPersonalization = hasFirst || hasLast;
    
    console.log(`Message ${index + 1}: "${message}"`);
    console.log(`  Has {first_name}: ${hasFirst}`);
    console.log(`  Has {last_name}: ${hasLast}`);
    console.log(`  Needs personalization: ${needsPersonalization}`);
    console.log('');
  });
  
  // Test 2: Simulate placeholder replacement
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Placeholder Replacement Simulation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const userData = {
    first_name: 'John',
    last_name: 'Smith'
  };
  
  testMessages.forEach((message, index) => {
    if (message.includes('{first_name}') || message.includes('{last_name}')) {
      let personalized = message;
      
      if (userData.first_name) {
        personalized = personalized.replace(/\{first_name\}/g, userData.first_name);
      }
      
      if (userData.last_name) {
        personalized = personalized.replace(/\{last_name\}/g, userData.last_name);
      }
      
      console.log(`Message ${index + 1}:`);
      console.log(`  Original: "${message}"`);
      console.log(`  Personalized: "${personalized}"`);
      console.log('');
    }
  });
  
  // Test 3: Check Facebook Graph API endpoint
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Facebook Graph API Endpoint');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Expected Facebook API call:');
  console.log('GET https://graph.facebook.com/v18.0/{user_id}?fields=first_name,last_name&access_token={token}');
  console.log('');
  console.log('Expected response:');
  console.log('{');
  console.log('  "first_name": "John",');
  console.log('  "last_name": "Smith",');
  console.log('  "id": "1234567890"');
  console.log('}');
  console.log('');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Personalization test completed!');
  console.log('If you see personalized messages in your server logs, the feature is working.');
}

testPersonalization();
