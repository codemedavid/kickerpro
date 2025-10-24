const { createClient } = require('@supabase/supabase-js');

async function debugAuth() {
  console.log('🔍 Debugging Authentication Issue...\n');
  
  try {
    // Initialize Supabase client
    const supabaseUrl = 'https://rvfxvunlxnafmqpovqrf.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Znh2dW5seG5hZm1xcG92cXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMzYzODksImV4cCI6MjA3NjcxMjM4OX0.qa35yjEp3zjY89PC9-xanxhx4H8kifLgeU_e-Oi7Moo';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the user ID from your cookie (replace with your actual cookie value)
    const userId = '5b36c720-8b1f-4ebb-8543-ce595bd5a450'; // Replace with your actual fb-auth-user value
    
    console.log('👤 Testing with User ID:', userId);
    
    // Test 1: Check if this user has conversations
    console.log('\n📊 Test 1: User Conversations Count');
    const { count: userConversationCount, error: userCountError } = await supabase
      .from('messenger_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (userCountError) {
      console.error('❌ User conversations count failed:', userCountError);
    } else {
      console.log('✅ User has', userCountError || 0, 'conversations');
    }
    
    // Test 2: Get sample conversations for this user
    console.log('\n📋 Test 2: Sample User Conversations');
    const { data: userConversations, error: userConvError } = await supabase
      .from('messenger_conversations')
      .select('id, sender_name, conversation_status, last_message_time, user_id')
      .eq('user_id', userId)
      .eq('conversation_status', 'active')
      .limit(5)
      .order('last_message_time', { ascending: false });
    
    if (userConvError) {
      console.error('❌ User conversations query failed:', userConvError);
    } else {
      console.log('✅ Found', userConversations?.length || 0, 'active conversations for user');
      userConversations?.forEach((conv, index) => {
        console.log(`  ${index + 1}. ${conv.sender_name || 'Unknown'} (${conv.id})`);
      });
    }
    
    // Test 3: Check if user exists in users table
    console.log('\n👤 Test 3: User Exists Check');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('❌ User lookup failed:', userError);
    } else {
      console.log('✅ User exists:', userData.email);
    }
    
    // Test 4: Check all users to see if your user ID is correct
    console.log('\n🔍 Test 4: All Users (to verify your user ID)');
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .limit(10);
    
    if (allUsersError) {
      console.error('❌ All users query failed:', allUsersError);
    } else {
      console.log('✅ All users in database:');
      allUsers?.forEach((user, index) => {
        const isCurrentUser = user.id === userId;
        console.log(`  ${index + 1}. ${user.id} ${isCurrentUser ? '← YOUR USER' : ''}`);
        console.log(`     Email: ${user.email}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the debug
debugAuth();
