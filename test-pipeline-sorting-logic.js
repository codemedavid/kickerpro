/**
 * Test Pipeline Sorting Logic
 * This script tests the complete pipeline auto-sorting flow
 * 
 * Prerequisites:
 * 1. Run setup-pipeline-for-testing.sql in Supabase
 * 2. Run create-test-conversations.sql in Supabase
 * 3. Have your authentication cookie ready
 * 
 * Usage: node test-pipeline-sorting-logic.js
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  userId: 'YOUR_USER_ID', // Replace with your user ID
  testContacts: [
    {
      senderId: 'TEST_PSID_001_EARLY_BROWSER',
      name: 'Test User 1 - Early Browser',
      expectedStage: 'New Lead',
      reason: 'General browsing message with no specific interest'
    },
    {
      senderId: 'TEST_PSID_002_INTERESTED',
      name: 'Test User 2 - Interested Shopper',
      expectedStage: 'Qualified',
      reason: 'Asked about pricing and features for specific product'
    },
    {
      senderId: 'TEST_PSID_003_READY_TO_BUY',
      name: 'Test User 3 - Ready Buyer',
      expectedStage: 'Hot Lead',
      reason: 'Ready to purchase, requested quote with timeline'
    },
    {
      senderId: 'TEST_PSID_004_BULK_ORDER',
      name: 'Test User 4 - Bulk Buyer',
      expectedStage: 'Hot Lead',
      reason: 'Bulk order with urgency and pricing discussion'
    },
    {
      senderId: 'TEST_PSID_005_GENERAL',
      name: 'Test User 5 - General Inquiry',
      expectedStage: 'New Lead',
      reason: 'Just exploring, no specific interest expressed'
    },
    {
      senderId: 'TEST_PSID_006_COMPARING',
      name: 'Test User 6 - Price Shopper',
      expectedStage: 'Qualified',
      reason: 'Comparing prices and asking about details'
    }
  ]
};

console.log('🧪 PIPELINE SORTING LOGIC TEST\n');
console.log('═══════════════════════════════════════════════════════\n');

// Helper function to make authenticated requests
async function authenticatedFetch(url, options = {}) {
  // Note: In production, you'd need to pass authentication
  // For this test, we'll call the API directly assuming server-side
  return fetch(url, options);
}

// Test Phase 1: Verify Configuration
async function testPhase1_VerifyConfiguration() {
  console.log('PHASE 1: Verify Configuration');
  console.log('─────────────────────────────────────────────────────');
  
  try {
    // Check if Gemini keys are configured
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
    
    console.log(`✅ Gemini API Keys: ${keyCount} configured`);
    console.log(`   Rate Limit: ${keyCount * 15} requests/minute\n`);
    
    return true;
  } catch (error) {
    console.error('❌ Configuration check failed:', error.message);
    return false;
  }
}

// Test Phase 2: Create Test Opportunities
async function testPhase2_CreateOpportunities() {
  console.log('PHASE 2: Create Test Opportunities in Database');
  console.log('─────────────────────────────────────────────────────');
  console.log('Run this SQL in Supabase to add test contacts to pipeline:\n');
  
  console.log('```sql');
  console.log('-- Get conversation IDs for test contacts');
  console.log(`SELECT id, sender_id, sender_name FROM messenger_conversations`);
  console.log(`WHERE user_id = '${TEST_CONFIG.userId}' AND sender_id LIKE 'TEST_%';`);
  console.log('');
  console.log('-- Get default stage ID');
  console.log(`SELECT id FROM pipeline_stages WHERE user_id = '${TEST_CONFIG.userId}' AND is_default = true;`);
  console.log('');
  console.log('-- Insert opportunities (replace IDs from queries above)');
  console.log(`INSERT INTO pipeline_opportunities (user_id, conversation_id, stage_id, sender_id, sender_name, manually_assigned)`);
  console.log(`SELECT`);
  console.log(`  '${TEST_CONFIG.userId}',`);
  console.log(`  mc.id,`);
  console.log(`  (SELECT id FROM pipeline_stages WHERE user_id = '${TEST_CONFIG.userId}' AND is_default = true),`);
  console.log(`  mc.sender_id,`);
  console.log(`  mc.sender_name,`);
  console.log(`  false`);
  console.log(`FROM messenger_conversations mc`);
  console.log(`WHERE mc.user_id = '${TEST_CONFIG.userId}' AND mc.sender_id LIKE 'TEST_%';`);
  console.log('```\n');
  
  console.log('After running SQL, get the opportunity IDs and continue to Phase 3\n');
}

// Test Phase 3: Analyze Test Contacts
async function testPhase3_AnalyzeContacts(opportunityIds) {
  console.log('PHASE 3: Run AI Analysis on Test Contacts');
  console.log('─────────────────────────────────────────────────────');
  
  if (!opportunityIds || opportunityIds.length === 0) {
    console.log('⚠️  No opportunity IDs provided');
    console.log('   Get them from database after running Phase 2 SQL\n');
    return null;
  }
  
  console.log(`Analyzing ${opportunityIds.length} test contacts...\n`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/pipeline/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        opportunity_ids: opportunityIds
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API returned ${response.status}`);
    }
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    console.log('\nPossible issues:');
    console.log('- API quota exceeded (wait for reset)');
    console.log('- Authentication required (need to set cookies)');
    console.log('- Server not running');
    return null;
  }
}

// Test Phase 4: Validate Results
async function testPhase4_ValidateResults(analysisResults) {
  console.log('PHASE 4: Validate Sorting Results');
  console.log('─────────────────────────────────────────────────────\n');
  
  if (!analysisResults || !analysisResults.results) {
    console.log('⚠️  No analysis results to validate\n');
    return;
  }
  
  console.log(`Analyzed ${analysisResults.analyzed} contacts\n`);
  
  const results = analysisResults.results;
  let correctCount = 0;
  let incorrectCount = 0;
  let uncertainCount = 0;
  
  console.log('INDIVIDUAL RESULTS:');
  console.log('═══════════════════════════════════════════════════════\n');
  
  results.forEach((result, index) => {
    const testContact = TEST_CONFIG.testContacts.find(
      tc => result.contact_name && result.contact_name.includes(tc.name.split(' ')[2])
    );
    
    console.log(`Contact ${index + 1}: ${result.contact_name}`);
    console.log('─'.repeat(50));
    
    if (testContact) {
      const stageName = result.global_recommendation || 'Unknown';
      const isCorrect = stageName === testContact.expectedStage;
      const agreed = result.both_agreed;
      
      console.log(`Expected Stage: ${testContact.expectedStage}`);
      console.log(`Actual Stage:   ${stageName}`);
      console.log(`Agreed:         ${agreed ? '✅ Yes' : '❌ No'}`);
      console.log(`Confidence:     ${result.confidence.toFixed(2)}`);
      console.log(`Status:         ${isCorrect ? '✅ PASS' : '❌ FAIL'}`);
      
      if (agreed && isCorrect) {
        correctCount++;
      } else if (!agreed) {
        uncertainCount++;
      } else {
        incorrectCount++;
      }
      
      if (result.stage_specific_matches && result.stage_specific_matches.length > 0) {
        console.log(`Matches:        ${result.stage_specific_matches.join(', ')}`);
      }
    } else {
      console.log(`Status: ⚠️  Not a test contact`);
    }
    
    console.log('');
  });
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const total = correctCount + incorrectCount + uncertainCount;
  const accuracy = total > 0 ? ((correctCount / total) * 100).toFixed(1) : 0;
  
  console.log(`✅ Correct:     ${correctCount}/${total} (${accuracy}%)`);
  console.log(`❌ Incorrect:   ${incorrectCount}/${total}`);
  console.log(`⚠️  Uncertain:   ${uncertainCount}/${total} (AI disagreed - needs review)`);
  console.log('');
  
  if (correctCount === total) {
    console.log('🎉 PERFECT! All contacts sorted correctly!');
  } else if (correctCount >= total * 0.8) {
    console.log('✅ GOOD! 80%+ accuracy achieved');
  } else if (uncertainCount > correctCount) {
    console.log('⚠️  Most contacts uncertain - prompts may be too strict');
  } else {
    console.log('❌ Low accuracy - need to adjust prompts');
  }
  
  console.log('');
  
  return {
    total,
    correct: correctCount,
    incorrect: incorrectCount,
    uncertain: uncertainCount,
    accuracy: parseFloat(accuracy)
  };
}

// Main test flow
async function runTests() {
  console.log('Starting Pipeline Sorting Tests...\n');
  
  // Phase 1
  const configOk = await testPhase1_VerifyConfiguration();
  if (!configOk) {
    console.log('\n❌ Configuration test failed. Fix issues and try again.\n');
    process.exit(1);
  }
  
  // Phase 2
  await testPhase2_CreateOpportunities();
  
  console.log('MANUAL STEP REQUIRED:');
  console.log('─────────────────────────────────────────────────────');
  console.log('1. Run the SQL above in Supabase to create opportunities');
  console.log('2. Get the opportunity IDs from the database:');
  console.log('   SELECT id FROM pipeline_opportunities');
  console.log('   WHERE user_id = \'YOUR_USER_ID\' AND sender_id LIKE \'TEST_%\';');
  console.log('3. Pass them to Phase 3 by running:');
  console.log('   node test-pipeline-sorting-logic.js <opp_id_1> <opp_id_2> ...\n');
  
  // Check if opportunity IDs were passed
  const oppIds = process.argv.slice(2);
  
  if (oppIds.length === 0) {
    console.log('⏸️  Paused: Waiting for opportunity IDs');
    console.log('   Run Phase 2 SQL first, then re-run this script with IDs\n');
    process.exit(0);
  }
  
  // Phase 3
  console.log(`\n📊 Testing with ${oppIds.length} opportunity IDs...\n`);
  const analysisResults = await testPhase3_AnalyzeContacts(oppIds);
  
  if (!analysisResults) {
    console.log('\n❌ Analysis failed. Check errors above.\n');
    process.exit(1);
  }
  
  // Phase 4
  const metrics = await testPhase4_ValidateResults(analysisResults);
  
  // Final report
  console.log('═══════════════════════════════════════════════════════');
  console.log('FINAL REPORT');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('Configuration:');
  console.log(`  Gemini Keys: ${[
    process.env.GOOGLE_AI_API_KEY,
    process.env.GOOGLE_AI_API_KEY_2,
    process.env.GOOGLE_AI_API_KEY_3,
    process.env.GOOGLE_AI_API_KEY_4,
    process.env.GOOGLE_AI_API_KEY_5,
    process.env.GOOGLE_AI_API_KEY_6,
    process.env.GOOGLE_AI_API_KEY_7,
    process.env.GOOGLE_AI_API_KEY_8,
    process.env.GOOGLE_AI_API_KEY_9
  ].filter(k => k).length}`);
  console.log('');
  
  if (metrics) {
    console.log('Results:');
    console.log(`  Accuracy: ${metrics.accuracy}%`);
    console.log(`  Correct: ${metrics.correct}/${metrics.total}`);
    console.log(`  Uncertain: ${metrics.uncertain}/${metrics.total}`);
    console.log('');
    
    if (metrics.accuracy >= 80) {
      console.log('✅ TEST PASSED - Sorting logic works correctly!');
      console.log('   Ready for production use.\n');
      process.exit(0);
    } else if (metrics.uncertain > metrics.correct) {
      console.log('⚠️  TEST WARNING - Too many uncertain results');
      console.log('   Consider making stage prompts less strict.\n');
      process.exit(1);
    } else {
      console.log('❌ TEST FAILED - Low accuracy');
      console.log('   Review AI reasoning and adjust prompts.\n');
      process.exit(1);
    }
  } else {
    console.log('❌ Could not generate metrics\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});
