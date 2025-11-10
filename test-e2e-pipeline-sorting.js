/**
 * End-to-End Pipeline Sorting Test
 * 
 * Tests the complete flow from adding contacts to pipeline through auto-sorting
 * 
 * Prerequisites:
 * 1. Run setup-pipeline-for-testing.sql
 * 2. Run create-test-conversations.sql  
 * 3. Server running (npm run dev)
 * 4. Logged into app (for auth cookie)
 * 
 * Run: node test-e2e-pipeline-sorting.js
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Test scenarios with expected outcomes
const TEST_SCENARIOS = [
  {
    name: 'Scenario 1: New Lead Batch',
    description: 'Test contacts that should go to New Lead stage',
    senders: ['test_sender_browsing_001', 'test_sender_inquiry_002'],
    expectedStage: 'New Lead',
    expectedConfidence: 0.7
  },
  {
    name: 'Scenario 2: Qualified Batch',
    description: 'Test contacts showing interest',
    senders: ['test_sender_pricing_003', 'test_sender_comparing_004'],
    expectedStage: 'Qualified',
    expectedConfidence: 0.75
  },
  {
    name: 'Scenario 3: Hot Lead Batch',
    description: 'Test contacts ready to buy',
    senders: ['test_sender_readytobuy_005', 'test_sender_urgent_006'],
    expectedStage: 'Hot Lead',
    expectedConfidence: 0.8
  },
  {
    name: 'Scenario 4: Mixed Batch',
    description: 'Test mixed contact types together',
    senders: ['test_sender_browsing_001', 'test_sender_pricing_003', 'test_sender_urgent_006'],
    expectedStages: ['New Lead', 'Qualified', 'Hot Lead'],
    expectedAccuracy: 0.8
  }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEndToEndTest() {
  console.log('🧪 End-to-End Pipeline Sorting Test\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Note: This requires authentication
  // Best run via browser console where you're already authenticated
  
  console.log('⚠️ AUTHENTICATION REQUIRED\n');
  console.log('This script requires authentication. Options:\n');
  console.log('Option 1 (Recommended): Run via Browser Console');
  console.log('  1. Open your app → Conversations page');
  console.log('  2. Open DevTools (F12) → Console');
  console.log('  3. Run the test code below\n');
  console.log('Option 2: Use authenticated fetch (advanced)');
  console.log('  Set TEST_AUTH_COOKIE in .env.local\n');
  console.log('─────────────────────────────────────────────────────\n');

  printBrowserConsoleTest();
}

function printBrowserConsoleTest() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('BROWSER CONSOLE TEST CODE');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Copy and paste this into your browser console:\n');
  console.log('```javascript');
  console.log(`
// ============================================
// E2E Test: Pipeline Auto-Sorting
// ============================================

console.clear();
console.log('🧪 E2E Pipeline Sorting Test\\n');

async function testPipelineSorting() {
  try {
    // Step 1: Get test conversations
    console.log('Step 1: Fetching test conversations...');
    const conversationsRes = await fetch('/api/conversations?limit=100');
    const conversationsData = await conversationsRes.json();
    
    const testConvs = conversationsData.conversations.filter(c => 
      c.sender_id.includes('test_sender')
    );
    
    console.log(\`✅ Found \${testConvs.length} test conversations\\n\`);
    
    if (testConvs.length === 0) {
      console.error('❌ No test conversations found!');
      console.log('Run create-test-conversations.sql first\\n');
      return;
    }
    
    // Step 2: Add to pipeline (triggers auto-sorting)
    console.log('Step 2: Adding to pipeline with auto-sorting...');
    const conversationIds = testConvs.map(c => c.id);
    
    const bulkRes = await fetch('/api/pipeline/opportunities/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_ids: conversationIds })
    });
    
    const bulkData = await bulkRes.json();
    console.log(\`✅ Added \${bulkData.added} contacts\`);
    console.log(\`AI Analyzed: \${bulkData.ai_analyzed ? '✅ Yes' : '❌ No'}\`);
    
    if (bulkData.ai_analyzed) {
      console.log(\`Analyzed Count: \${bulkData.analysis_results?.length || 0}\\n\`);
    } else {
      console.log('Reason:', bulkData.message, '\\n');
    }
    
    // Step 3: Fetch opportunities to check results
    console.log('Step 3: Checking sorting results...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for DB update
    
    const oppsRes = await fetch('/api/pipeline/opportunities');
    const oppsData = await oppsRes.json();
    
    const testOpps = oppsData.opportunities.filter(o => 
      o.sender_id.includes('test_sender')
    );
    
    console.log(\`Found \${testOpps.length} test opportunities\\n\`);
    
    // Step 4: Validate results
    console.log('═══════════════════════════════════════════════════════');
    console.log('RESULTS BY CONTACT');
    console.log('═══════════════════════════════════════════════════════\\n');
    
    const expectedMapping = {
      'browsing': 'New Lead',
      'inquiry': 'New Lead',
      'pricing': 'Qualified',
      'comparing': 'Qualified',
      'readytobuy': 'Hot Lead',
      'urgent': 'Hot Lead'
    };
    
    let correctCount = 0;
    let totalCount = 0;
    
    testOpps.forEach(opp => {
      const senderType = Object.keys(expectedMapping).find(key => 
        opp.sender_id.includes(key)
      );
      const expected = expectedMapping[senderType] || 'Unknown';
      const actual = opp.stage.name;
      const isCorrect = actual === expected;
      
      if (isCorrect) correctCount++;
      totalCount++;
      
      console.log(\`\${opp.sender_name}:\`);
      console.log(\`  Expected: \${expected}\`);
      console.log(\`  Actual: \${actual}\`);
      console.log(\`  Result: \${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}\`);
      console.log(\`  Agreed: \${opp.both_prompts_agreed ? '✅' : '❌'}\`);
      console.log(\`  Confidence: \${(opp.ai_confidence_score * 100).toFixed(1)}%\\n\`);
    });
    
    // Step 5: Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════\\n');
    
    const accuracy = (correctCount / totalCount * 100).toFixed(1);
    const agreedCount = testOpps.filter(o => o.both_prompts_agreed).length;
    const agreementRate = (agreedCount / totalCount * 100).toFixed(1);
    const avgConfidence = testOpps.reduce((sum, o) => sum + (o.ai_confidence_score || 0), 0) / totalCount;
    
    console.log(\`Total Tests: \${totalCount}\`);
    console.log(\`Correct: \${correctCount} (\${accuracy}%)\`);
    console.log(\`Agreed: \${agreedCount} (\${agreementRate}%)\`);
    console.log(\`Avg Confidence: \${(avgConfidence * 100).toFixed(1)}%\\n\`);
    
    // Evaluation
    if (accuracy >= 83) {
      console.log('✅ EXCELLENT: Auto-sorting is working great!');
    } else if (accuracy >= 67) {
      console.log('✅ GOOD: Working but could be improved');
    } else {
      console.log('⚠️ NEEDS WORK: Prompts need adjustment');
    }
    
    if (bulkData.ai_analyzed === false) {
      console.log('\\n⚠️ WARNING: AI analysis did not run!');
      console.log('Possible causes:');
      console.log('- Pipeline settings not configured');
      console.log('- API quota exceeded');
      console.log('- Check server console for errors');
    }
    
    console.log('\\n✅ E2E Test Complete!\\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\\nCheck:');
    console.log('- Are you logged in?');
    console.log('- Is server running?');
    console.log('- Run diagnostic SQL to check configuration');
  }
}

// Run the test
testPipelineSorting();
  `);
  console.log('```\n');
  console.log('═══════════════════════════════════════════════════════\n');
}

// Show instructions
runEndToEndTest();

