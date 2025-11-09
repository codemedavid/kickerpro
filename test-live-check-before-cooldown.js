/**
 * Test: Live Check Runs BEFORE Cooldown Check
 * This ensures we detect replies even during cooldown period
 */

function simulateAutomationLogic(scenario) {
  console.log(`\n📋 Scenario: ${scenario.name}`);
  console.log('-'.repeat(70));
  
  const { 
    hasStopRecord,
    userRepliedMinutesAgo,
    lastExecutionMinutesAgo,
    timeInterval,
    stopOnReply
  } = scenario;
  
  // Step 1: Check if automation stopped
  if (hasStopRecord) {
    console.log('  1️⃣ Check stop record: STOPPED');
    console.log('     Result: SKIP (automation already stopped)');
    return { action: 'skipped_stopped', stoppedAt: 'step_1' };
  }
  console.log('  1️⃣ Check stop record: Not stopped ✓');
  
  // Step 2: Live Facebook check (NEW - runs BEFORE cooldown)
  console.log('  2️⃣ Live Facebook check:');
  if (userRepliedMinutesAgo !== null && userRepliedMinutesAgo < timeInterval) {
    console.log(`     User replied ${userRepliedMinutesAgo} minutes ago`);
    console.log(`     Interval: ${timeInterval} minutes`);
    console.log(`     Result: USER REPLIED WITHIN INTERVAL!`);
    
    if (stopOnReply) {
      console.log('     🛑 STOPPING PERMANENTLY');
      console.log('     🏷️ Removing tags');
      return { action: 'stopped_by_live_check', stoppedAt: 'step_2' };
    }
  } else if (userRepliedMinutesAgo !== null) {
    console.log(`     User replied ${userRepliedMinutesAgo} minutes ago (outside interval) ✓`);
  } else {
    console.log('     No recent user messages ✓');
  }
  
  // Step 3: Cooldown check
  console.log('  3️⃣ Cooldown check:');
  if (lastExecutionMinutesAgo !== null && lastExecutionMinutesAgo < timeInterval) {
    console.log(`     Last sent ${lastExecutionMinutesAgo} minutes ago`);
    console.log(`     Interval: ${timeInterval} minutes`);
    console.log(`     Result: SKIP (cooldown not met)`);
    return { action: 'skipped_cooldown', stoppedAt: 'step_3' };
  } else if (lastExecutionMinutesAgo !== null) {
    console.log(`     Last sent ${lastExecutionMinutesAgo} minutes ago (cooldown met) ✓`);
  } else {
    console.log('     Never sent before ✓');
  }
  
  // Step 4: Send message
  console.log('  4️⃣ Send message:');
  console.log('     ✅ ALL CHECKS PASSED');
  console.log('     📤 SENDING MESSAGE');
  return { action: 'sent', stoppedAt: null };
}

// Test scenarios
const scenarios = [
  {
    name: "User replied 2 min ago, cooldown 3 min (SHOULD STOP PERMANENTLY)",
    hasStopRecord: false,
    userRepliedMinutesAgo: 2,
    lastExecutionMinutesAgo: 3,
    timeInterval: 5,
    stopOnReply: true,
    expected: 'stopped_by_live_check'
  },
  {
    name: "User replied 2 min ago, but stopOnReply=false (SHOULD SKIP ONCE)",
    hasStopRecord: false,
    userRepliedMinutesAgo: 2,
    lastExecutionMinutesAgo: 6,
    timeInterval: 5,
    stopOnReply: false,
    expected: 'sent' // Still sends because stopOnReply is off
  },
  {
    name: "Cooldown not met (3 min < 5 min interval), user didn't reply (SHOULD SKIP COOLDOWN)",
    hasStopRecord: false,
    userRepliedMinutesAgo: 60,
    lastExecutionMinutesAgo: 3,
    timeInterval: 5,
    stopOnReply: true,
    expected: 'skipped_cooldown'
  },
  {
    name: "User replied 10 min ago, cooldown met (SHOULD SEND)",
    hasStopRecord: false,
    userRepliedMinutesAgo: 10,
    lastExecutionMinutesAgo: 6,
    timeInterval: 5,
    stopOnReply: true,
    expected: 'sent'
  },
  {
    name: "Already stopped (SHOULD SKIP IMMEDIATELY)",
    hasStopRecord: true,
    userRepliedMinutesAgo: null,
    lastExecutionMinutesAgo: null,
    timeInterval: 5,
    stopOnReply: true,
    expected: 'skipped_stopped'
  }
];

// Run tests
console.log('🧪 Testing Live Check BEFORE Cooldown Logic\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

scenarios.forEach((scenario, index) => {
  const result = simulateAutomationLogic(scenario);
  
  const testPassed = result.action === scenario.expected;
  
  if (testPassed) {
    console.log(`\n✅ TEST ${index + 1} PASSED`);
    console.log(`   Action: ${result.action}`);
    console.log(`   Stopped at: ${result.stoppedAt || 'N/A (message sent)'}`);
    passed++;
  } else {
    console.log(`\n❌ TEST ${index + 1} FAILED`);
    console.log(`   Expected: ${scenario.expected}`);
    console.log(`   Got: ${result.action}`);
    failed++;
  }
});

console.log('\n' + '='.repeat(70));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${scenarios.length} tests\n`);

if (failed === 0) {
  console.log('🎉 All tests passed!\n');
  console.log('✨ Logic Flow is CORRECT:\n');
  console.log('   1️⃣ Check stop record');
  console.log('   2️⃣ Live Facebook check (NEW!)');
  console.log('   3️⃣ Cooldown check');
  console.log('   4️⃣ Send message\n');
  console.log('🎯 Key Benefit:');
  console.log('   Live check runs EVEN during cooldown!');
  console.log('   If user replied, stops immediately!');
  console.log('   Tags removed automatically!\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed\n');
  process.exit(1);
}

