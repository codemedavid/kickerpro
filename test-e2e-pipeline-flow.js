/**
 * END-TO-END PIPELINE SORTING TEST
 * Tests the complete flow from adding contacts to sorted results
 * 
 * This simulates the actual user flow:
 * 1. Select contacts in Conversations page
 * 2. Click "Add to Pipeline"
 * 3. Verify automatic sorting
 * 4. Check database state
 * 
 * Usage: node test-e2e-pipeline-flow.js
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

console.log('🧪 END-TO-END PIPELINE SORTING TEST\n');
console.log('═══════════════════════════════════════════════════════\n');

// Test configuration
const TEST_USER_ID = 'YOUR_USER_ID'; // Replace with your user ID

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Single Contact - Clear Intent',
    description: 'Test with one contact showing clear buying intent',
    message: 'I want to buy 10 units, can you send me the pricing?',
    expectedStage: 'Hot Lead',
    expectedConfidence: 0.8
  },
  {
    name: 'Single Contact - Just Browsing',
    description: 'Test with one contact in exploration phase',
    message: 'Hi, just looking around. What do you sell?',
    expectedStage: 'New Lead',
    expectedConfidence: 0.8
  },
  {
    name: 'Single Contact - Qualified Lead',
    description: 'Test with contact showing interest but not ready to buy',
    message: 'How much is your premium package? I''m comparing options.',
    expectedStage: 'Qualified',
    expectedConfidence: 0.7
  },
  {
    name: 'Multiple Contacts - Mixed',
    description: 'Test with multiple contacts of different types',
    contacts: [
      { message: 'Just browsing', expected: 'New Lead' },
      { message: 'Interested in pricing', expected: 'Qualified' },
      { message: 'Ready to order now', expected: 'Hot Lead' }
    ]
  },
  {
    name: 'Edge Case - No Message History',
    description: 'Test contact with no conversation data',
    message: '',
    expectedStage: 'Unmatched',
    expectedConfidence: 0
  },
  {
    name: 'Edge Case - Ambiguous Message',
    description: 'Test with unclear or vague message',
    message: 'Thanks',
    expectedStage: 'Unmatched',
    expectedConfidence: 0
  }
];

// Phase 1: Pre-test Verification
async function phase1_PreTestCheck() {
  console.log('PHASE 1: Pre-Test Verification');
  console.log('─────────────────────────────────────────────────────\n');
  
  const checks = {
    geminiKeys: false,
    serverRunning: false,
    testDataExists: false
  };
  
  // Check 1: Gemini keys
  const keyCount = [
    process.env.GOOGLE_AI_API_KEY,
    process.env.GOOGLE_AI_API_KEY_2,
    process.env.GOOGLE_AI_API_KEY_3,
    process.env.GOOGLE_AI_API_KEY_4,
    process.env.GOOGLE_AI_API_KEY_5,
    process.env.GOOGLE_AI_API_KEY_6,
    process.env.GOOGLE_AI_API_KEY_7,
    process.env.GOOGLE_AI_API_KEY_8,
    process.env.GOOGLE_AI_API_KEY_9
  ].filter(k => k).length;
  
  if (keyCount > 0) {
    console.log(`✅ Gemini Keys: ${keyCount} configured`);
    checks.geminiKeys = true;
  } else {
    console.log('❌ Gemini Keys: Not configured');
  }
  
  // Check 2: Server running
  try {
    const response = await fetch(`${BASE_URL}/api/pipeline/stages`);
    if (response.status === 200 || response.status === 401) {
      console.log('✅ Server: Running');
      checks.serverRunning = true;
    }
  } catch (error) {
    console.log('❌ Server: Not running or not accessible');
  }
  
  // Check 3: Test data
  console.log('\n📋 Manual Verification Required:');
  console.log('   Run diagnose-current-state.sql in Supabase');
  console.log('   Verify test conversations exist (sender_id LIKE \'TEST_%\')');
  console.log('   Verify pipeline settings configured');
  console.log('   Verify stages have analysis_prompt\n');
  
  const allPassed = checks.geminiKeys && checks.serverRunning;
  
  if (allPassed) {
    console.log('✅ Pre-test checks passed\n');
    return true;
  } else {
    console.log('❌ Pre-test checks failed - fix issues above\n');
    return false;
  }
}

// Phase 2: Test Bulk Add API
async function phase2_TestBulkAdd() {
  console.log('PHASE 2: Test Bulk Add API');
  console.log('─────────────────────────────────────────────────────\n');
  
  console.log('MANUAL TEST REQUIRED:');
  console.log('This phase requires authenticated API calls from the browser.\n');
  
  console.log('Run this in Browser Console (F12) on Conversations page:');
  console.log('```javascript');
  console.log('// Get test conversation IDs');
  console.log('fetch(\'/api/conversations?limit=100\')');
  console.log('  .then(r => r.json())');
  console.log('  .then(d => {');
  console.log('    const testConvs = d.conversations.filter(c => c.sender_id.startsWith(\'TEST_\'));');
  console.log('    const convIds = testConvs.map(c => c.id);');
  console.log('    console.log(\'Test conversation IDs:\', convIds);');
  console.log('    ');
  console.log('    // Add to pipeline');
  console.log('    return fetch(\'/api/pipeline/opportunities/bulk\', {');
  console.log('      method: \'POST\',');
  console.log('      headers: { \'Content-Type\': \'application/json\' },');
  console.log('      body: JSON.stringify({ conversation_ids: convIds })');
  console.log('    });');
  console.log('  })');
  console.log('  .then(r => r.json())');
  console.log('  .then(result => {');
  console.log('    console.log(\'Result:\', result);');
  console.log('    console.log(\'AI Analyzed:\', result.ai_analyzed);');
  console.log('    console.log(\'Added:\', result.added);');
  console.log('    ');
  console.log('    if (result.ai_analyzed) {');
  console.log('      console.log(\'✅ AUTO-SORTING WORKED!\');');
  console.log('      console.log(\'Analysis results:\', result.analysis_results);');
  console.log('    } else {');
  console.log('      console.log(\'❌ Auto-sorting did not run:\', result.message);');
  console.log('    }');
  console.log('  });');
  console.log('```\n');
  
  console.log('Watch for:');
  console.log('  - result.ai_analyzed should be true');
  console.log('  - result.analysis_results should show stages');
  console.log('  - Check toast notification in UI\n');
}

// Phase 3: Verify Database State
async function phase3_VerifyDatabaseState() {
  console.log('PHASE 3: Verify Database State After Sorting');
  console.log('─────────────────────────────────────────────────────\n');
  
  console.log('Run validate-test-results.sql in Supabase');
  console.log('It will show:');
  console.log('  - Expected vs Actual stage for each test contact');
  console.log('  - AI confidence scores');
  console.log('  - Agreement status');
  console.log('  - Overall accuracy percentage\n');
  
  console.log('Look for:');
  console.log('  ✅ Accuracy >= 80%');
  console.log('  ✅ High confidence scores (> 0.7)');
  console.log('  ✅ Both prompts agreed for most contacts\n');
}

// Phase 4: Test Edge Cases
async function phase4_TestEdgeCases() {
  console.log('PHASE 4: Test Edge Cases');
  console.log('─────────────────────────────────────────────────────\n');
  
  console.log('Test these scenarios manually:\n');
  
  TEST_SCENARIOS.forEach((scenario, index) => {
    console.log(`${index + 1}. ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    if (scenario.message) {
      console.log(`   Message: "${scenario.message}"`);
      console.log(`   Expected: ${scenario.expectedStage} (confidence > ${scenario.expectedConfidence})`);
    }
    console.log('');
  });
  
  console.log('For each scenario:');
  console.log('  1. Create conversation in Supabase with that message');
  console.log('  2. Add to pipeline via UI or API');
  console.log('  3. Check if sorted to expected stage');
  console.log('  4. Verify confidence score\n');
}

// Main execution
async function runE2ETest() {
  console.log('Starting End-to-End Pipeline Sorting Test...\n');
  
  // Phase 1: Pre-checks
  const preCheckPassed = await phase1_PreTestCheck();
  
  if (!preCheckPassed) {
    console.log('❌ Pre-test checks failed. Cannot continue.\n');
    process.exit(1);
  }
  
  // Phase 2: Bulk add test
  await phase2_TestBulkAdd();
  
  console.log('⏸️  PAUSED: Complete Phase 2 browser test, then continue\n');
  console.log('After running the browser test:');
  console.log('  1. Check if result.ai_analyzed = true');
  console.log('  2. Check toast notification');
  console.log('  3. Look at server console for analysis logs');
  console.log('  4. Then run Phase 3 (validate-test-results.sql)\n');
  
  // Phase 3: Database verification
  await phase3_VerifyDatabaseState();
  
  // Phase 4: Edge cases
  await phase4_TestEdgeCases();
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('E2E TEST GUIDE COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('Follow the phases above in order.');
  console.log('Each phase builds on the previous one.');
  console.log('Document results at each step.\n');
}

// Run
runE2ETest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

