/**
 * API Integration Tests
 * 
 * Tests all contact timing API endpoints with real requests
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

let testsPassed = 0;
let testsFailed = 0;

async function testEndpoint(name: string, testFn: () => Promise<boolean>) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const result = await testFn();
    if (result) {
      console.log(`  ✅ PASS`);
      testsPassed++;
    } else {
      console.log(`  ❌ FAIL`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    testsFailed++;
  }
}

export async function runAPITests(userId: string, authCookie?: string) {
  console.log('🔌 API INTEGRATION TESTS\n');
  console.log('='.repeat(70));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authCookie) {
    headers['Cookie'] = authCookie;
  }

  // TEST 1: POST /api/contact-timing/compute - No data
  await testEndpoint('POST /api/contact-timing/compute - Empty dataset', async () => {
    const response = await fetch(`${BASE_URL}/api/contact-timing/compute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_ids: [], recompute_all: false }),
    });

    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response: ${JSON.stringify(data).substring(0, 100)}`);

    return response.ok && data.processed === 0;
  });

  // TEST 2: Get test conversations
  const { data: testConvs } = await supabase
    .from('messenger_conversations')
    .select('id')
    .eq('user_id', userId)
    .limit(5);

  if (!testConvs || testConvs.length === 0) {
    console.log('\n⚠️ No test conversations found. Skipping computation tests.');
  } else {
    const testConvIds = testConvs.map(c => c.id);

    // TEST 3: POST /api/contact-timing/compute - Specific IDs
    await testEndpoint('POST /api/contact-timing/compute - Specific conversation_ids', async () => {
      const response = await fetch(`${BASE_URL}/api/contact-timing/compute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversation_ids: testConvIds, recompute_all: false }),
      });

      const data = await response.json();
      console.log(`  Status: ${response.status}`);
      console.log(`  Processed: ${data.processed}/${testConvIds.length}`);

      return response.ok && data.success && data.processed >= 0;
    });

    // TEST 4: POST /api/contact-timing/compute - Recompute all
    await testEndpoint('POST /api/contact-timing/compute - Recompute all', async () => {
      const response = await fetch(`${BASE_URL}/api/contact-timing/compute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ recompute_all: true }),
      });

      const data = await response.json();
      console.log(`  Status: ${response.status}`);
      console.log(`  Processed: ${data.processed} contacts`);
      console.log(`  Duration: ${data.duration_ms}ms`);

      return response.ok && data.success && data.processed > 0;
    });
  }

  // TEST 5: GET /api/contact-timing/recommendations - Basic fetch
  await testEndpoint('GET /api/contact-timing/recommendations - Basic', async () => {
    const response = await fetch(`${BASE_URL}/api/contact-timing/recommendations?limit=10`, {
      headers,
    });

    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Records: ${data.data?.length || 0}`);
    console.log(`  Total: ${data.pagination?.total || 0}`);

    return response.ok && data.success && Array.isArray(data.data);
  });

  // TEST 6: GET /api/contact-timing/recommendations - Pagination
  await testEndpoint('GET /api/contact-timing/recommendations - Pagination', async () => {
    const response = await fetch(`${BASE_URL}/api/contact-timing/recommendations?limit=5&offset=0`, {
      headers,
    });

    const data = await response.json();
    console.log(`  Limit: 5, Offset: 0`);
    console.log(`  Returned: ${data.data?.length || 0} records`);
    console.log(`  Has more: ${data.pagination?.has_more}`);

    return response.ok && data.data.length <= 5 && data.pagination?.limit === 5;
  });

  // TEST 7: GET /api/contact-timing/recommendations - Sorting
  await testEndpoint('GET /api/contact-timing/recommendations - Sort by composite_score', async () => {
    const response = await fetch(`${BASE_URL}/api/contact-timing/recommendations?sort_by=composite_score&sort_order=desc&limit=10`, {
      headers,
    });

    const data = await response.json();
    
    if (data.data && data.data.length > 1) {
      const scores = data.data.map((d: any) => d.composite_score);
      const sorted = scores.every((score: number, i: number) => 
        i === 0 || score <= scores[i - 1]
      );
      console.log(`  Scores: ${scores.slice(0, 5).map((s: number) => s.toFixed(2)).join(', ')}`);
      console.log(`  Sorted descending: ${sorted}`);

      return response.ok && sorted;
    }

    return response.ok;
  });

  // TEST 8: GET /api/contact-timing/recommendations - Filtering by confidence
  await testEndpoint('GET /api/contact-timing/recommendations - Filter min_confidence', async () => {
    const response = await fetch(`${BASE_URL}/api/contact-timing/recommendations?min_confidence=0.7&limit=20`, {
      headers,
    });

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const allAboveThreshold = data.data.every((d: any) => d.max_confidence >= 0.7);
      console.log(`  Filtered for confidence >= 0.7`);
      console.log(`  Records returned: ${data.data.length}`);
      console.log(`  All above threshold: ${allAboveThreshold}`);

      return response.ok && allAboveThreshold;
    }

    return response.ok;
  });

  // TEST 9: GET /api/contact-timing/recommendations - Search
  await testEndpoint('GET /api/contact-timing/recommendations - Search by name', async () => {
    const response = await fetch(`${BASE_URL}/api/contact-timing/recommendations?search=Test&limit=20`, {
      headers,
    });

    const data = await response.json();
    console.log(`  Search term: "Test"`);
    console.log(`  Results: ${data.data?.length || 0}`);

    return response.ok && Array.isArray(data.data);
  });

  // TEST 10: Verify page information included
  await testEndpoint('Verify page_name included in response', async () => {
    const response = await fetch(`${BASE_URL}/api/contact-timing/recommendations?limit=1`, {
      headers,
    });

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const firstContact = data.data[0];
      console.log(`  page_name: ${firstContact.page_name || 'MISSING'}`);
      console.log(`  page_id: ${firstContact.page_id || 'MISSING'}`);

      return response.ok && 'page_name' in firstContact && 'page_id' in firstContact;
    }

    return response.ok;
  });

  // TEST 11: Verify recommended_windows structure
  await testEndpoint('Verify recommended_windows structure', async () => {
    const response = await fetch(`${BASE_URL}/api/contact-timing/recommendations?limit=1`, {
      headers,
    });

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const windows = data.data[0].recommended_windows;
      
      if (Array.isArray(windows) && windows.length > 0) {
        const window = windows[0];
        console.log(`  Window structure: ${JSON.stringify(window)}`);
        
        const hasRequiredFields = 
          'dow' in window &&
          'start' in window &&
          'end' in window &&
          'confidence' in window &&
          'hour_of_week' in window;

        return response.ok && hasRequiredFields;
      }
    }

    return response.ok;
  });

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 API TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n🎉 ALL API TESTS PASSED!');
  } else {
    console.log('\n⚠️  SOME API TESTS FAILED!');
  }

  return { passed: testsPassed, failed: testsFailed };
}

// CLI execution
if (require.main === module) {
  const userId = process.argv[2];
  const authCookie = process.argv[3];

  if (!userId) {
    console.error('Usage: ts-node scripts/test-api-endpoints.ts <user_id> [auth_cookie]');
    process.exit(1);
  }

  runAPITests(userId, authCookie)
    .then((result) => {
      process.exit(result.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ API tests failed:', error);
      process.exit(1);
    });
}

