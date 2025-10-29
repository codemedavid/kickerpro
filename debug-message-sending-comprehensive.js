/**
 * 🔍 Comprehensive Message Sending Debug Script
 * 
 * This script tests the entire message sending flow and identifies issues
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function debugMessageSending() {
  console.log('🔍 COMPREHENSIVE MESSAGE SENDING DEBUG\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Step 1: Check authentication
    console.log('STEP 1: Checking Authentication');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const authResponse = await fetch(`${BASE_URL}/api/auth/me`);
    if (!authResponse.ok) {
      console.error('❌ Authentication failed:', authResponse.status);
      return;
    }
    
    const authData = await authResponse.json();
    console.log('✅ Authentication successful:', authData.user?.email || 'Unknown');
    
    // Step 2: Check Facebook pages
    console.log('\nSTEP 2: Checking Facebook Pages');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const pagesResponse = await fetch(`${BASE_URL}/api/facebook-pages`);
    if (!pagesResponse.ok) {
      console.error('❌ Failed to fetch Facebook pages:', pagesResponse.status);
      return;
    }
    
    const pagesData = await pagesResponse.json();
    console.log('✅ Facebook pages found:', pagesData.pages?.length || 0);
    
    if (pagesData.pages?.length === 0) {
      console.error('❌ No Facebook pages found. Cannot test message sending.');
      return;
    }
    
    const testPage = pagesData.pages[0];
    console.log('📄 Using test page:', {
      id: testPage.id,
      name: testPage.name,
      has_token: !!testPage.access_token
    });
    
    // Step 3: Check conversations
    console.log('\nSTEP 3: Checking Conversations');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const conversationsResponse = await fetch(`${BASE_URL}/api/conversations?pageId=${testPage.id}`);
    if (!conversationsResponse.ok) {
      console.error('❌ Failed to fetch conversations:', conversationsResponse.status);
      return;
    }
    
    const conversationsData = await conversationsResponse.json();
    console.log('✅ Conversations found:', conversationsData.conversations?.length || 0);
    
    if (conversationsData.conversations?.length === 0) {
      console.error('❌ No conversations found. Cannot test message sending.');
      return;
    }
    
    const testRecipients = conversationsData.conversations.slice(0, 3).map(c => c.sender_id);
    console.log('👥 Test recipients:', testRecipients.length);
    
    // Step 4: Create test message
    console.log('\nSTEP 4: Creating Test Message');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const testMessage = {
      title: `Debug Test ${new Date().toISOString()}`,
      content: 'Hello {first_name}! This is a debug test message.',
      page_id: testPage.id,
      recipient_type: 'selected',
      recipient_count: testRecipients.length,
      status: 'sent',
      selected_recipients: testRecipients,
      message_tag: 'ACCOUNT_UPDATE'
    };
    
    console.log('📝 Test message data:', {
      title: testMessage.title,
      recipient_count: testMessage.recipient_count,
      message_tag: testMessage.message_tag
    });
    
    const createResponse = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMessage)
    });
    
    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error('❌ Failed to create message:', errorData);
      return;
    }
    
    const createData = await createResponse.json();
    const messageId = createData.message?.id;
    console.log('✅ Message created successfully:', messageId);
    
    // Step 5: Check batch creation
    console.log('\nSTEP 5: Checking Batch Creation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const batchesResponse = await fetch(`${BASE_URL}/api/messages/${messageId}/batches`);
    if (!batchesResponse.ok) {
      console.error('❌ Failed to fetch batches:', batchesResponse.status);
      return;
    }
    
    const batchesData = await batchesResponse.json();
    console.log('✅ Batches found:', batchesData.batches?.length || 0);
    
    if (batchesData.batches?.length === 0) {
      console.error('❌ No batches created. This indicates an issue with the send API.');
      return;
    }
    
    // Step 6: Test batch processing
    console.log('\nSTEP 6: Testing Batch Processing');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (let i = 0; i < batchesData.batches.length; i++) {
      const batch = batchesData.batches[i];
      console.log(`🔄 Processing batch ${batch.batch_number}/${batch.total_batches}...`);
      
      const processResponse = await fetch(`${BASE_URL}/api/messages/${messageId}/batches/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        console.error(`❌ Batch ${batch.batch_number} processing failed:`, errorData);
        continue;
      }
      
      const processData = await processResponse.json();
      console.log(`✅ Batch ${batch.batch_number} completed:`, {
        sent: processData.batch?.sent || 0,
        failed: processData.batch?.failed || 0,
        status: processData.batch?.status || 'unknown',
        hasMore: processData.hasMore
      });
      
      if (!processData.hasMore) {
        console.log('🏁 All batches processed');
        break;
      }
    }
    
    // Step 7: Check final message status
    console.log('\nSTEP 7: Checking Final Message Status');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const messageResponse = await fetch(`${BASE_URL}/api/messages/${messageId}`);
    if (!messageResponse.ok) {
      console.error('❌ Failed to fetch message status:', messageResponse.status);
      return;
    }
    
    const messageData = await messageResponse.json();
    console.log('📊 Final message status:', {
      status: messageData.message?.status,
      delivered_count: messageData.message?.delivered_count,
      error_message: messageData.message?.error_message || 'none'
    });
    
    // Step 8: Summary
    console.log('\nSTEP 8: Debug Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const summary = {
      authentication: '✅ Working',
      facebook_pages: pagesData.pages?.length > 0 ? '✅ Working' : '❌ No pages',
      conversations: conversationsData.conversations?.length > 0 ? '✅ Working' : '❌ No conversations',
      message_creation: createResponse.ok ? '✅ Working' : '❌ Failed',
      batch_creation: batchesData.batches?.length > 0 ? '✅ Working' : '❌ Failed',
      batch_processing: '✅ Tested',
      final_status: messageData.message?.status || 'unknown'
    };
    
    console.log('📋 Debug Summary:');
    Object.entries(summary).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    console.log('\n🎯 Next Steps:');
    if (summary.batch_creation === '❌ Failed') {
      console.log('  - Check /api/messages/[id]/send endpoint');
      console.log('  - Verify message_batches table exists');
      console.log('  - Check database permissions');
    }
    
    if (summary.final_status === 'failed') {
      console.log('  - Check Facebook API credentials');
      console.log('  - Verify page access tokens');
      console.log('  - Check Facebook app permissions');
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the debug script
debugMessageSending().then(() => {
  console.log('\n🏁 Debug script completed');
}).catch(error => {
  console.error('❌ Debug script failed:', error);
});
