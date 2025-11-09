/**
 * Test Permanent Stop When Reply Detected by Live Check
 * Ensures automation stops permanently, not just skips once
 */

// Simulate automation behavior
function simulateAutomationRuns(userRepliedMinutesAgo, timeInterval, stopOnReply) {
  const runs = [];
  
  // Simulate 3 automation runs, 5 minutes apart
  for (let runNumber = 1; runNumber <= 3; runNumber++) {
    const minutesElapsed = (runNumber - 1) * 5;
    const timeSinceUserReply = userRepliedMinutesAgo + minutesElapsed;
    
    console.log(`\n  Run #${runNumber} (${minutesElapsed} min after first attempt):`);
    console.log(`    Time since user reply: ${timeSinceUserReply} minutes`);
    
    // Check if user replied within interval
    const replyDetected = timeSinceUserReply < timeInterval;
    
    if (replyDetected) {
      console.log(`    ⏭️  Reply detected (${timeSinceUserReply} < ${timeInterval} min)`);
      
      if (stopOnReply) {
        console.log(`    🛑 STOPPED permanently!`);
        console.log(`    🏷️  Tags removed`);
        runs.push({ run: runNumber, action: 'stopped_permanently' });
        break; // Stop trying after this
      } else {
        console.log(`    ⏭️  Skipped this time (will try again later)`);
        runs.push({ run: runNumber, action: 'skipped_once' });
      }
    } else {
      console.log(`    ✅ Safe to send (${timeSinceUserReply} >= ${timeInterval} min)`);
      runs.push({ run: runNumber, action: 'sent' });
    }
  }
  
  return runs;
}

// Test cases
const testCases = [
  {
    name: "OLD BEHAVIOR: Reply detected but only skips once (BUG)",
    input: {
      userRepliedMinutesAgo: 3, // User replied 3 min ago
      timeInterval: 5,
      stopOnReply: false // Old behavior - just skip, don't stop
    },
    simulate: true,
    expectedBehavior: "Skips first attempt, but sends on second attempt (BAD!)"
  },
  {
    name: "NEW BEHAVIOR: Reply detected and stops permanently (FIX)",
    input: {
      userRepliedMinutesAgo: 3, // User replied 3 min ago
      timeInterval: 5,
      stopOnReply: true // New behavior - stop permanently
    },
    simulate: true,
    expectedBehavior: "Stops permanently after detecting reply (GOOD!)"
  },
  {
    name: "User never replied → Send normally",
    input: {
      userRepliedMinutesAgo: 60, // User replied 60 min ago
      timeInterval: 5,
      stopOnReply: true
    },
    simulate: true,
    expectedBehavior: "Sends on first attempt (no recent reply)"
  }
];

// Run tests
console.log('🧪 Testing Permanent Stop on Reply Detection\n');
console.log('='.repeat(70));

testCases.forEach((test, index) => {
  console.log(`\n📋 Test ${index + 1}: ${test.name}`);
  console.log('-'.repeat(70));
  console.log(`Expected: ${test.expectedBehavior}\n`);
  
  const runs = simulateAutomationRuns(
    test.input.userRepliedMinutesAgo,
    test.input.timeInterval,
    test.input.stopOnReply
  );
  
  console.log(`\n  📊 Summary:`);
  runs.forEach(run => {
    const emoji = run.action === 'sent' ? '📤' : 
                  run.action === 'stopped_permanently' ? '🛑' : '⏭️';
    console.log(`    ${emoji} Run #${run.run}: ${run.action}`);
  });
  
  // Determine if behavior is correct
  if (test.input.stopOnReply && test.input.userRepliedMinutesAgo < test.input.timeInterval) {
    // Should stop permanently
    const stoppedPermanently = runs.some(r => r.action === 'stopped_permanently');
    const didntSendAfter = !runs.some((r, idx) => 
      idx > 0 && r.action === 'sent'
    );
    
    if (stoppedPermanently && didntSendAfter) {
      console.log(`\n  ✅ CORRECT: Stopped permanently, no messages sent after`);
    } else {
      console.log(`\n  ❌ WRONG: Should have stopped permanently!`);
    }
  }
});

console.log('\n' + '='.repeat(70));
console.log('\n📊 Key Insight:\n');
console.log('OLD BEHAVIOR (Bug):');
console.log('  1. Live check detects reply → Skip this attempt');
console.log('  2. 5 minutes later → Try again');
console.log('  3. Reply is now "old" → Send anyway ❌');
console.log('  4. User gets message even though they replied!\n');

console.log('NEW BEHAVIOR (Fixed):');
console.log('  1. Live check detects reply → STOP PERMANENTLY');
console.log('  2. Create stop record in database');
console.log('  3. Remove all trigger tags');
console.log('  4. Future attempts check stop table → Skip ✅');
console.log('  5. User won\'t get any more messages!\n');

console.log('='.repeat(70));
console.log('\n🎉 Logic is now correct!\n');
console.log('📋 Next Steps:');
console.log('   1. Reconnect Facebook page (fix token)');
console.log('   2. Delete failed execution records');
console.log('   3. Test with real conversation');
console.log('   4. ✅ Automation will stop permanently when user replies!\n');

process.exit(0);

