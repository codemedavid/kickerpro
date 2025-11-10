/**
 * GENERATE COMPREHENSIVE TEST REPORT
 * Analyzes all test results and produces detailed report
 * 
 * This script generates a complete test report including:
 * - Configuration status
 * - Test execution results
 * - Accuracy metrics
 * - Issue identification
 * - Recommendations
 * 
 * Usage: node generate-test-report.js
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

console.log('📊 GENERATING PIPELINE SORTING TEST REPORT\n');
console.log('═══════════════════════════════════════════════════════\n');

const REPORT_FILE = 'PIPELINE_TEST_REPORT.md';

// Test data expectations
const EXPECTED_RESULTS = {
  'TEST_PSID_001_EARLY_BROWSER': {
    expectedStage: 'New Lead',
    reason: 'General browsing, no specific interest'
  },
  'TEST_PSID_002_INTERESTED': {
    expectedStage: 'Qualified',
    reason: 'Asked about pricing for specific product'
  },
  'TEST_PSID_003_READY_TO_BUY': {
    expectedStage: 'Hot Lead',
    reason: 'Ready to purchase with timeline'
  },
  'TEST_PSID_004_BULK_ORDER': {
    expectedStage: 'Hot Lead',
    reason: 'Bulk order with urgency'
  },
  'TEST_PSID_005_GENERAL': {
    expectedStage: 'New Lead',
    reason: 'Just exploring options'
  },
  'TEST_PSID_006_COMPARING': {
    expectedStage: 'Qualified',
    reason: 'Comparing prices and options'
  }
};

function generateReport() {
  let report = '';
  
  // Header
  report += '# Pipeline Auto-Sorting Test Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '---\n\n';
  
  // Section 1: Configuration Status
  report += '## 1. Configuration Status\n\n';
  
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
  
  report += '### Environment\n\n';
  report += `- Gemini API Keys: ${keyCount} configured\n`;
  report += `- Combined Rate Limit: ${keyCount * 15} requests/minute\n`;
  report += `- Model: gemini-2.0-flash-exp\n\n`;
  
  report += '### Database Configuration\n\n';
  report += 'Run `diagnose-current-state.sql` in Supabase to verify:\n';
  report += '- [ ] Pipeline settings configured (global_analysis_prompt exists)\n';
  report += '- [ ] At least 3 stages created (New Lead, Qualified, Hot Lead)\n';
  report += '- [ ] Each stage has analysis_prompt filled\n';
  report += '- [ ] One stage marked as default\n\n';
  
  // Section 2: Test Scenarios
  report += '## 2. Test Scenarios\n\n';
  report += '### Expected Results\n\n';
  report += '| Contact ID | Expected Stage | Reason |\n';
  report += '|------------|----------------|--------|\n';
  
  Object.entries(EXPECTED_RESULTS).forEach(([id, data]) => {
    report += `| ${id} | ${data.expectedStage} | ${data.reason} |\n`;
  });
  
  report += '\n';
  
  // Section 3: Test Execution Steps
  report += '## 3. Test Execution Steps\n\n';
  report += '### Step 1: Setup\n';
  report += '```bash\n';
  report += '# 1. Run setup SQL in Supabase\n';
  report += '# File: setup-pipeline-for-testing.sql\n';
  report += '# This creates pipeline_settings and stages\n\n';
  report += '# 2. Run test data SQL in Supabase\n';
  report += '# File: create-test-conversations.sql\n';
  report += '# This creates 6 test conversations\n';
  report += '```\n\n';
  
  report += '### Step 2: Run Analysis\n';
  report += '```bash\n';
  report += '# Option A: Via UI\n';
  report += '# 1. Go to Conversations page\n';
  report += '# 2. Select test contacts (sender_id starts with TEST_)\n';
  report += '# 3. Click "Add to Pipeline"\n';
  report += '# 4. Watch for toast notification\n';
  report += '# 5. Check Pipeline page for results\n\n';
  report += '# Option B: Via API test\n';
  report += 'node test-pipeline-sorting-logic.js <opportunity_ids>\n';
  report += '```\n\n';
  
  report += '### Step 3: Validate Results\n';
  report += '```sql\n';
  report += '-- Run in Supabase SQL Editor\n';
  report += '-- File: validate-test-results.sql\n';
  report += '-- Shows expected vs actual stages with accuracy\n';
  report += '```\n\n';
  
  report += '### Step 4: Check Metrics\n';
  report += '```sql\n';
  report += '-- Run in Supabase SQL Editor\n';
  report += '-- File: pipeline-sorting-metrics.sql\n';
  report += '-- Shows comprehensive performance metrics\n';
  report += '```\n\n';
  
  // Section 4: Results Template
  report += '## 4. Test Results\n\n';
  report += '### Actual Results (Fill After Testing)\n\n';
  report += '| Contact | Expected | Actual | Confidence | Agreed | Status |\n';
  report += '|---------|----------|--------|------------|--------|--------|\n';
  report += '| Browser | New Lead | _____  | _____      | ___    | ___    |\n';
  report += '| Interested | Qualified | _____  | _____      | ___    | ___    |\n';
  report += '| Ready | Hot Lead | _____  | _____      | ___    | ___    |\n';
  report += '| Bulk | Hot Lead | _____  | _____      | ___    | ___    |\n';
  report += '| General | New Lead | _____  | _____      | ___    | ___    |\n';
  report += '| Comparing | Qualified | _____  | _____      | ___    | ___    |\n\n';
  
  report += '### Performance Metrics (Fill After Testing)\n\n';
  report += '- Total Contacts: _____\n';
  report += '- Analyzed: _____\n';
  report += '- Correctly Sorted: _____\n';
  report += '- Accuracy: _____%\n';
  report += '- High Confidence: _____\n';
  report += '- Uncertain/Disagreed: _____\n\n';
  
  // Section 5: Issue Analysis
  report += '## 5. Issues Identified\n\n';
  report += '### Configuration Issues\n';
  report += '- [ ] Pipeline settings missing\n';
  report += '- [ ] Stage prompts missing\n';
  report += '- [ ] Default stage not set\n\n';
  
  report += '### Runtime Issues\n';
  report += '- [ ] API quota exceeded\n';
  report += '- [ ] Authentication errors\n';
  report += '- [ ] Server errors\n\n';
  
  report += '### Logic Issues\n';
  report += '- [ ] Too many disagreements (>30%)\n';
  report += '- [ ] Low confidence scores (<0.7 average)\n';
  report += '- [ ] Wrong stage assignments\n\n';
  
  // Section 6: Recommendations
  report += '## 6. Recommendations\n\n';
  report += '### If Accuracy < 80%\n';
  report += '- Review AI reasoning for incorrect assignments\n';
  report += '- Adjust stage prompts to be clearer\n';
  report += '- Add more keyword examples\n';
  report += '- Make criteria more specific\n\n';
  
  report += '### If Many Disagreements (>30%)\n';
  report += '- Stage prompts may be too strict\n';
  report += '- Make criteria more general\n';
  report += '- Ensure global and stage prompts are aligned\n';
  report += '- Add more examples to prompts\n\n';
  
  report += '### If Not Analyzed\n';
  report += '- Check pipeline_settings exists\n';
  report += '- Verify global_analysis_prompt is filled\n';
  report += '- Check Gemini API quota status\n';
  report += '- Review server console logs for errors\n\n';
  
  // Section 7: Server Logs
  report += '## 7. Server Console Logs\n\n';
  report += '### Expected Logs (Success)\n';
  report += '```\n';
  report += '[Pipeline Bulk API] Triggering automatic AI analysis for X new contacts\n';
  report += '[Pipeline Analyze] 🚀 Loaded 9 Gemini API key(s) for rotation\n';
  report += '[Pipeline Analyze] ✅ Analyzed Contact 1: Agreed, confidence: 0.85\n';
  report += '[Pipeline Analyze] ✅ Analyzed Contact 2: Agreed, confidence: 0.92\n';
  report += '[Pipeline Bulk API] ✅ AI analysis completed: X contacts analyzed\n';
  report += '```\n\n';
  
  report += '### Actual Logs (Copy from server console)\n';
  report += '```\n';
  report += '(Paste your actual server logs here)\n';
  report += '```\n\n';
  
  // Section 8: Conclusion
  report += '## 8. Conclusion\n\n';
  report += '### Test Status\n';
  report += '- [ ] All tests passed (accuracy >= 80%)\n';
  report += '- [ ] Partial pass (accuracy 60-79%)\n';
  report += '- [ ] Tests failed (accuracy < 60%)\n\n';
  
  report += '### Production Readiness\n';
  report += '- [ ] Ready for production use\n';
  report += '- [ ] Needs prompt adjustments\n';
  report += '- [ ] Needs further testing\n\n';
  
  report += '### Next Steps\n';
  report += '1. ________________________________\n';
  report += '2. ________________________________\n';
  report += '3. ________________________________\n\n';
  
  report += '---\n\n';
  report += '## Appendix: SQL Queries Used\n\n';
  report += '- `diagnose-current-state.sql` - Initial diagnosis\n';
  report += '- `setup-pipeline-for-testing.sql` - Configuration setup\n';
  report += '- `create-test-conversations.sql` - Test data creation\n';
  report += '- `validate-test-results.sql` - Results validation\n';
  report += '- `pipeline-sorting-metrics.sql` - Performance metrics\n';
  report += '- `cleanup-test-data.sql` - Test cleanup\n\n';
  
  report += '## Appendix: Scripts Used\n\n';
  report += '- `test-pipeline-sorting-logic.js` - Logic validation\n';
  report += '- `test-e2e-pipeline-flow.js` - End-to-end flow\n';
  report += '- `backtest-pipeline-sorting.js` - Backtest analysis\n';
  report += '- `generate-test-report.js` - This script\n';
  
  return report;
}

// Generate and save report
try {
  const report = generateReport();
  fs.writeFileSync(REPORT_FILE, report);
  
  console.log(`✅ Test report template generated: ${REPORT_FILE}\n`);
  console.log('NEXT STEPS:');
  console.log('─────────────────────────────────────────────────────\n');
  console.log('1. Run the test scripts in order');
  console.log('2. Fill in the actual results in the report');
  console.log('3. Run the metrics SQL to get performance data');
  console.log('4. Document any issues found');
  console.log('5. Add recommendations for improvements\n');
  
  console.log('The report provides a template to document your findings.');
  console.log('Update it as you complete each test phase.\n');
  
} catch (error) {
  console.error('❌ Failed to generate report:', error);
  process.exit(1);
}
