const fetch = require('node-fetch');

async function testAPIDirect() {
  console.log('🧪 Testing API Directly...\n');
  
  try {
    const baseUrl = 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/conversations`;
    
    // Test with your actual user ID
    const userId = '5b36c720-8b1f-4ebb-8543-ce595bd5a450';
    
    console.log('📡 Testing with User ID:', userId);
    
    const params = new URLSearchParams({
      page: '1',
      limit: '20'
    });
    
    const testUrl = `${apiUrl}?${params.toString()}`;
    console.log('🔗 Full URL:', testUrl);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `fb-auth-user=${userId}`
      }
    });
    
    console.log('📊 Response Status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error Response:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ Response Data:');
    console.log('  - Success:', data.success);
    console.log('  - Conversations Count:', data.conversations?.length || 0);
    console.log('  - Total Count:', data.pagination?.total || 0);
    console.log('  - Total Pages:', data.pagination?.totalPages || 0);
    
    if (data.conversations && data.conversations.length > 0) {
      console.log('\n📋 Sample Conversations:');
      data.conversations.slice(0, 3).forEach((conv, index) => {
        console.log(`  ${index + 1}. ID: ${conv.id}`);
        console.log(`     Name: ${conv.sender_name || 'Unknown'}`);
        console.log(`     Status: ${conv.conversation_status}`);
        console.log(`     Last Message: ${conv.last_message_time}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No conversations returned by API');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPIDirect();
