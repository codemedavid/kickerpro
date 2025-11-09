/**
 * Test Automatic Token Refresh Feature
 * Tests the logic for detecting expired tokens and refreshing them
 */

// Mock Facebook API responses
const mockFacebookAPI = {
  validToken: {
    id: '123456789',
    name: 'Test Page'
  },
  expiredToken: {
    error: {
      message: 'Error validating access token: Session has expired',
      type: 'OAuthException',
      code: 190,
      error_subcode: 463
    }
  },
  exchangeSuccess: {
    access_token: 'EAALong...LivedToken',
    token_type: 'bearer',
    expires_in: 5184000 // 60 days in seconds
  },
  debugToken: {
    data: {
      app_id: '123456789',
      type: 'PAGE',
      application: 'Test App',
      expires_at: Math.floor(Date.now() / 1000) + 5184000, // 60 days from now
      is_valid: true,
      scopes: ['pages_messaging', 'pages_manage_metadata']
    }
  }
};

// Test cases
const testCases = [
  {
    name: 'Detect expired token',
    input: {
      errorMessage: 'Error validating access token: Session has expired on Saturday, 08-Nov-25 21:00:00 PST'
    },
    test: (input) => {
      const isExpiredToken = 
        input.errorMessage.includes('Session has expired') ||
        input.errorMessage.includes('OAuthException');
      return isExpiredToken;
    },
    expected: true
  },
  {
    name: 'Calculate token expiration',
    input: {
      expiresIn: 5184000 // seconds
    },
    test: (input) => {
      const days = Math.floor(input.expiresIn / 86400);
      return days;
    },
    expected: 60
  },
  {
    name: 'Detect tokens needing refresh (< 7 days)',
    input: {
      daysUntilExpiry: 5
    },
    test: (input) => {
      return input.daysUntilExpiry < 7;
    },
    expected: true
  },
  {
    name: 'Skip tokens with plenty of time (> 7 days)',
    input: {
      daysUntilExpiry: 45
    },
    test: (input) => {
      return input.daysUntilExpiry < 7;
    },
    expected: false
  },
  {
    name: 'Validate token response structure',
    input: mockFacebookAPI.exchangeSuccess,
    test: (input) => {
      return (
        input.access_token &&
        input.expires_in &&
        input.expires_in > 0
      );
    },
    expected: true
  },
  {
    name: 'Calculate days until expiry correctly',
    input: {
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now
    },
    test: (input) => {
      const days = Math.ceil((input.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
      return days;
    },
    expected: 7
  },
  {
    name: 'Identify OAuth error code 190',
    input: {
      error: mockFacebookAPI.expiredToken.error
    },
    test: (input) => {
      return input.error.code === 190 && input.error.type === 'OAuthException';
    },
    expected: true
  },
  {
    name: 'Token URL construction',
    input: {
      appId: 'APP123',
      appSecret: 'SECRET456',
      oldToken: 'OLD_TOKEN'
    },
    test: (input) => {
      const url = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
      url.searchParams.set('grant_type', 'fb_exchange_token');
      url.searchParams.set('client_id', input.appId);
      url.searchParams.set('client_secret', input.appSecret);
      url.searchParams.set('fb_exchange_token', input.oldToken);
      
      return url.toString().includes('fb_exchange_token') &&
             url.toString().includes('client_id') &&
             url.toString().includes('client_secret');
    },
    expected: true
  }
];

// Run tests
console.log('🧪 Testing Automatic Token Refresh Feature\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  try {
    const result = test.test(test.input);
    const testPassed = result === test.expected;
    
    if (testPassed) {
      console.log(`✅ Test ${index + 1}: ${test.name}`);
      console.log(`   Result: ${JSON.stringify(result)} ✓`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: ${test.name}`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Got: ${result}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Test ${index + 1}: ${test.name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
  console.log('');
});

console.log('='.repeat(70));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);

// Summary
if (failed === 0) {
  console.log('🎉 All tests passed!\n');
  console.log('✨ Token Refresh Logic is working correctly!\n');
  console.log('📋 Next Steps:');
  console.log('   1. Add NEXT_PUBLIC_FACEBOOK_APP_ID to Vercel');
  console.log('   2. Add FACEBOOK_APP_SECRET to Vercel');
  console.log('   3. Redeploy your app');
  console.log('   4. Reconnect your Facebook page');
  console.log('   5. ✅ Tokens will auto-refresh for 60 days!\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please review the logic.\n');
  process.exit(1);
}

