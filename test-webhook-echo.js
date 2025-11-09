/**
 * Test Echo Detection Logic
 * This tests the alternative sender/recipient ID comparison approach
 */

// Test cases
const testCases = [
  {
    name: "User message (real reply)",
    event: {
      sender: { id: "USER_123" },
      recipient: { id: "PAGE_456" },
      message: { text: "Hello!" }
    },
    expected: {
      isEcho: false,
      shouldProcess: true
    }
  },
  {
    name: "Page echo (sender = recipient)",
    event: {
      sender: { id: "PAGE_456" },
      recipient: { id: "PAGE_456" },
      message: { text: "Automated reply" }
    },
    expected: {
      isEcho: true,
      shouldProcess: false
    }
  },
  {
    name: "Page echo with is_echo flag",
    event: {
      sender: { id: "PAGE_456" },
      recipient: { id: "USER_123" },
      message: { 
        text: "Automated reply",
        is_echo: true
      }
    },
    expected: {
      isEcho: true,
      shouldProcess: false
    }
  },
  {
    name: "User message without is_echo",
    event: {
      sender: { id: "USER_789" },
      recipient: { id: "PAGE_456" },
      message: { text: "Need help!" }
    },
    expected: {
      isEcho: false,
      shouldProcess: true
    }
  },
  {
    name: "Message without sender/recipient",
    event: {
      message: { text: "Test" }
    },
    expected: {
      isEcho: false, // Not detected as echo if IDs missing
      shouldProcess: true // Will process (though unlikely in real webhook)
    }
  }
];

// Echo detection function (same logic as webhook)
function detectEcho(event) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  // isEcho if: sender === recipient (page talking to itself) OR explicit is_echo flag
  const isEcho = (senderId && recipientId && senderId === recipientId) || event.message?.is_echo === true;
  return isEcho;
}

// Run tests
console.log("🧪 Testing Echo Detection Logic\n");
console.log("=" .repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const isEcho = detectEcho(test.event);
  const shouldProcess = !isEcho;
  
  const testPassed = 
    isEcho === test.expected.isEcho && 
    shouldProcess === test.expected.shouldProcess;
  
  if (testPassed) {
    console.log(`✅ Test ${index + 1}: ${test.name}`);
    console.log(`   isEcho: ${isEcho} ✓`);
    console.log(`   shouldProcess: ${shouldProcess} ✓`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${test.name}`);
    console.log(`   Expected isEcho: ${test.expected.isEcho}, Got: ${isEcho}`);
    console.log(`   Expected shouldProcess: ${test.expected.shouldProcess}, Got: ${shouldProcess}`);
    failed++;
  }
  console.log("");
});

console.log("=" .repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);

if (failed === 0) {
  console.log("🎉 All tests passed! Echo detection is working correctly.");
  console.log("\n✨ Benefits of this approach:");
  console.log("   ✓ No Facebook webhook configuration needed");
  console.log("   ✓ Works immediately without message_echoes");
  console.log("   ✓ Backward compatible (checks both methods)");
  console.log("   ✓ Prevents automation from stopping itself");
  process.exit(0);
} else {
  console.log("❌ Some tests failed. Please review the logic.");
  process.exit(1);
}

