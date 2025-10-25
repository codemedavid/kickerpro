// Test script for conversations API with filtering and pagination
// Run with: node test-conversations-api.js

const BASE_URL = 'http://localhost:3000'; // Adjust for your environment

async function testConversationsAPI() {
  console.log('🧪 Testing Conversations API with Filtering and Pagination\n');

  const tests = [
    {
      name: 'Basic pagination',
      url: '/api/conversations?page=1&limit=5',
      description: 'Get first 5 conversations'
    },
    {
      name: 'Include tags filter',
      url: '/api/conversations?include_tags=tag-uuid-1,tag-uuid-2&page=1&limit=10',
      description: 'Get conversations with specific tags'
    },
    {
      name: 'Exclude tags filter',
      url: '/api/conversations?exclude_tags=tag-uuid-3&page=1&limit=10',
      description: 'Get conversations without specific tags'
    },
    {
      name: 'Include and exclude tags',
      url: '/api/conversations?include_tags=tag-uuid-1&exclude_tags=tag-uuid-3&page=1&limit=10',
      description: 'Get conversations with tag1 but not tag3'
    },
    {
      name: 'Search filter',
      url: '/api/conversations?search=john&page=1&limit=10',
      description: 'Search conversations by sender name or message'
    },
    {
      name: 'Combined filters',
      url: '/api/conversations?include_tags=tag-uuid-1&search=john&page=2&limit=5',
      description: 'Include tags + search + pagination'
    },
    {
      name: 'Edge case - no results',
      url: '/api/conversations?include_tags=non-existent-tag&page=1&limit=10',
      description: 'Test with non-existent tag'
    },
    {
      name: 'Large page number',
      url: '/api/conversations?page=999&limit=10',
      description: 'Test with page beyond available data'
    },
    {
      name: 'Invalid limit',
      url: '/api/conversations?page=1&limit=0',
      description: 'Test with invalid limit (should default to 1)'
    },
    {
      name: 'Large limit',
      url: '/api/conversations?page=1&limit=1000',
      description: 'Test with large limit (should cap at 100)'
    }
  ];

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log(`   ${test.description}`);
    console.log(`   URL: ${test.url}`);
    
    try {
      const response = await fetch(`${BASE_URL}${test.url}`, {
        headers: {
          'Cookie': 'fb-auth-user=test-user-id' // Replace with actual auth
        }
      });

      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Conversations: ${data.conversations?.length || 0}`);
      console.log(`   📄 Pagination:`, {
        page: data.pagination?.page,
        limit: data.pagination?.limit,
        total: data.pagination?.total,
        pages: data.pagination?.pages,
        hasNext: data.pagination?.hasNext,
        hasPrev: data.pagination?.hasPrev
      });

      // Validate pagination
      if (data.pagination) {
        const { page, limit, total, pages, hasNext, hasPrev } = data.pagination;
        
        // Check page bounds
        if (page < 1) {
          console.log(`   ⚠️  Invalid page: ${page} (should be >= 1)`);
        }
        
        // Check limit bounds
        if (limit < 1 || limit > 100) {
          console.log(`   ⚠️  Invalid limit: ${limit} (should be 1-100)`);
        }
        
        // Check total consistency
        if (total < 0) {
          console.log(`   ⚠️  Invalid total: ${total} (should be >= 0)`);
        }
        
        // Check pages calculation
        const expectedPages = Math.ceil(total / limit);
        if (pages !== expectedPages) {
          console.log(`   ⚠️  Pages mismatch: expected ${expectedPages}, got ${pages}`);
        }
        
        // Check hasNext/hasPrev
        if (hasNext !== (page < pages)) {
          console.log(`   ⚠️  hasNext mismatch: expected ${page < pages}, got ${hasNext}`);
        }
        
        if (hasPrev !== (page > 1)) {
          console.log(`   ⚠️  hasPrev mismatch: expected ${page > 1}, got ${hasPrev}`);
        }
        
        // Check conversation count
        const expectedCount = Math.min(limit, Math.max(0, total - (page - 1) * limit));
        if (data.conversations.length !== expectedCount) {
          console.log(`   ⚠️  Conversation count mismatch: expected ${expectedCount}, got ${data.conversations.length}`);
        }
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n🎯 Testing Complete!');
}

// Test pagination edge cases
async function testPaginationEdgeCases() {
  console.log('\n🔍 Testing Pagination Edge Cases\n');

  const edgeCases = [
    { page: 0, limit: 10, expectedPage: 1 },
    { page: -1, limit: 10, expectedPage: 1 },
    { page: 1, limit: 0, expectedLimit: 1 },
    { page: 1, limit: -5, expectedLimit: 1 },
    { page: 1, limit: 1000, expectedLimit: 100 },
    { page: 1, limit: 50, expectedLimit: 50 }
  ];

  for (const testCase of edgeCases) {
    console.log(`Testing: page=${testCase.page}, limit=${testCase.limit}`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/conversations?page=${testCase.page}&limit=${testCase.limit}`, {
        headers: {
          'Cookie': 'fb-auth-user=test-user-id'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const { page, limit } = data.pagination;
        
        if (page !== testCase.expectedPage) {
          console.log(`   ⚠️  Page not corrected: expected ${testCase.expectedPage}, got ${page}`);
        } else {
          console.log(`   ✅ Page corrected: ${page}`);
        }
        
        if (limit !== testCase.expectedLimit) {
          console.log(`   ⚠️  Limit not corrected: expected ${testCase.expectedLimit}, got ${limit}`);
        } else {
          console.log(`   ✅ Limit corrected: ${limit}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

// Run tests
if (require.main === module) {
  testConversationsAPI()
    .then(() => testPaginationEdgeCases())
    .catch(console.error);
}

module.exports = { testConversationsAPI, testPaginationEdgeCases };