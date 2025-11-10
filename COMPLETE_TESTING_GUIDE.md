# Complete Pipeline Auto-Sorting Testing Guide

## Overview

This guide walks you through comprehensive testing of the pipeline auto-sorting feature including diagnosis, setup, testing, validation, and backtesting.

---

## Phase 1: Diagnosis (Identify Current Issues)

### 1.1 Run Initial Diagnostic

**File:** `diagnose-current-state.sql`

**Steps:**
1. Get your user ID from Supabase:
   ```sql
   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
   ```

2. Replace `'YOUR_USER_ID'` in `diagnose-current-state.sql` (3 places)

3. Run the entire SQL script in Supabase SQL Editor

4. Review the output:
   - CHECK 1: Pipeline Settings (should show ✅ or ❌)
   - CHECK 2: Pipeline Stages (count and prompt status)
   - CHECK 3: Recent Opportunities (analysis status)
   - DIAGNOSIS SUMMARY: Primary issue identified

**Expected Output:**
```
✅ Settings exist
✅ 4 stages found
✅ 3 stages have prompts
✅ Default stage: Unmatched
```

**Common Issues:**
- "❌ NO SETTINGS FOUND" → Need to run setup SQL
- "Stages missing prompts" → Need to add analysis_prompt
- "NOT ANALYZED" → Check server logs for errors

### 1.2 Review Server Logs

Check your terminal where `npm run dev` is running.

Look for logs when you clicked "Add to Pipeline":

**Success Pattern:**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] 🚀 Loaded 9 Gemini API key(s) for rotation
[Pipeline Analyze] ✅ Analyzed Contact: Agreed, confidence: 0.85
[Pipeline Bulk API] ✅ AI analysis completed
```

**Failure Patterns:**
```
[Pipeline Analyze] No global analysis prompt configured
[Pipeline Analyze] Error: You exceeded your current quota
[Pipeline Analyze] ✅ Analyzed: Disagreed, confidence: 0
```

### 1.3 Document Findings

Create a file `diagnosis-findings.txt`:
```
Issue: [Describe what you found]
Cause: [Settings missing / API quota / Prompts disagreed]
Impact: [All contacts went to default stage]
Fix Required: [Phase 2.1 / 2.2 / 2.3]
```

---

## Phase 2: Fix Configuration

### 2.1 Setup Pipeline Configuration

**File:** `setup-pipeline-for-testing.sql`

**Steps:**
1. Replace `'YOUR_USER_ID'` with your actual user ID
2. Replace `'YOUR_PAGE_ID'` with a valid facebook page ID:
   ```sql
   SELECT id, facebook_page_id, name FROM facebook_pages 
   WHERE user_id = 'YOUR_USER_ID' LIMIT 1;
   ```

3. Run the entire script in Supabase

**What it creates:**
- Pipeline settings with comprehensive global analysis prompt
- 3 stages: New Lead, Qualified, Hot Lead
- Each stage with detailed analysis_prompt
- Unmatched stage as default

**Verification:**
Run at end of setup-pipeline-for-testing.sql to verify:
- Settings should show ✅
- All 4 stages should show ✅
- Setup should be complete

### 2.2 Verify Configuration via API

Run in browser console (F12):
```javascript
// Check settings
fetch('/api/pipeline/settings')
  .then(r => r.json())
  .then(d => console.log('Settings:', d.settings ? '✅' : '❌'));

// Check stages
fetch('/api/pipeline/stages')
  .then(r => r.json())
  .then(d => {
    const stages = d.stages || [];
    const withPrompts = stages.filter(s => s.analysis_prompt);
    console.log('Stages:', withPrompts.length, '/', stages.length, 'have prompts');
  });
```

Should output:
```
Settings: ✅
Stages: 4 / 4 have prompts
```

---

## Phase 3: Create Test Data

### 3.1 Create Test Conversations

**File:** `create-test-conversations.sql`

**Steps:**
1. Replace `'YOUR_USER_ID'` with your user ID
2. Replace `'YOUR_PAGE_ID'` with your page ID
3. Run the script in Supabase

**What it creates:**
- 6 test conversations with different message types
- Each designed to test specific stage criteria:
  - TEST_PSID_001: General browsing → New Lead
  - TEST_PSID_002: Interested in product → Qualified
  - TEST_PSID_003: Ready to buy → Hot Lead
  - TEST_PSID_004: Bulk order → Hot Lead
  - TEST_PSID_005: General inquiry → New Lead
  - TEST_PSID_006: Price comparison → Qualified

**Verification:**
Script shows summary at end:
- Total test contacts created
- Message preview for each
- Expected stage for each

### 3.2 Add Test Contacts to Pipeline

**Option A: Via UI (Recommended)**
1. Go to Conversations page
2. Filter or search for "TEST" in sender name
3. Select all test contacts (6 checkboxes)
4. Click "Add to Pipeline"
5. Watch for toast notification

**Option B: Via SQL**
```sql
INSERT INTO pipeline_opportunities (user_id, conversation_id, stage_id, sender_id, sender_name, manually_assigned)
SELECT
  'YOUR_USER_ID',
  mc.id,
  (SELECT id FROM pipeline_stages WHERE user_id = 'YOUR_USER_ID' AND is_default = true),
  mc.sender_id,
  mc.sender_name,
  false
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID' AND mc.sender_id LIKE 'TEST_%';
```

---

## Phase 4: Run Tests

### 4.1 Test Sorting Logic

**File:** `test-pipeline-sorting-logic.js`

**Steps:**
1. Get opportunity IDs from database:
   ```sql
   SELECT id FROM pipeline_opportunities
   WHERE user_id = 'YOUR_USER_ID' AND sender_id LIKE 'TEST_%'
   ORDER BY created_at DESC;
   ```

2. Run test with IDs:
   ```bash
   node test-pipeline-sorting-logic.js <id1> <id2> <id3> <id4> <id5> <id6>
   ```

**What it tests:**
- Calls `/api/pipeline/analyze` with test opportunity IDs
- Validates each contact's final stage
- Compares expected vs actual stages
- Calculates accuracy percentage
- Shows detailed results for each contact

**Expected Output:**
```
✅ Correct: 5/6 (83.3%)
❌ Incorrect: 0/6
⚠️  Uncertain: 1/6

✅ GOOD! 80%+ accuracy achieved
```

### 4.2 End-to-End Flow Test

**File:** `test-e2e-pipeline-flow.js`

**Steps:**
```bash
node test-e2e-pipeline-flow.js
```

**What it tests:**
- Pre-test configuration checks
- Guides you through browser-based bulk add test
- Database state verification steps
- Edge case scenarios

**Manual Steps in Browser:**
Follow the browser console commands shown in Phase 2 of the script output.

### 4.3 Backtest Existing Contacts

**File:** `backtest-pipeline-sorting.js`

**Steps:**
1. Get existing opportunity IDs (not test data)
2. Run backtest script
3. Review metrics and patterns

**What it analyzes:**
- Re-analyzes existing contacts with current prompts
- Compares new vs current stage assignments
- Identifies consistency patterns
- Calculates performance metrics

---

## Phase 5: Validate Results

### 5.1 Run Validation SQL

**File:** `validate-test-results.sql`

**Steps:**
1. Replace `'YOUR_USER_ID'` with your user ID
2. Run in Supabase SQL Editor

**What it shows:**
- Expected vs Actual stage for each test contact
- ✅ CORRECT or ❌ WRONG for each
- AI confidence scores
- Agreement status
- Overall accuracy percentage

**Target Metrics:**
- Accuracy: >= 80%
- High Confidence: >= 70%
- Agreement Rate: >= 70%

### 5.2 Run Performance Metrics

**File:** `pipeline-sorting-metrics.sql`

**Steps:**
1. Replace `'YOUR_USER_ID'` with your user ID
2. Run in Supabase SQL Editor

**What it shows:**
- 8 comprehensive metrics:
  1. Overall Performance
  2. Stage Distribution
  3. Confidence Distribution
  4. Agreement Rate Analysis
  5. Time-Based Analysis
  6. Performance by Stage
  7. Problem Areas
  8. Recent Trend

**Scorecard Grades:**
- A+ / A = Excellent
- B+ / B = Good
- C or below = Needs improvement

### 5.3 Generate Test Report

**File:** `generate-test-report.js`

**Steps:**
```bash
node generate-test-report.js
```

**Output:** Creates `PIPELINE_TEST_REPORT.md` template

**Fill in the report with:**
- Actual test results from validation SQL
- Performance metrics from metrics SQL
- Server logs from terminal
- Issues identified
- Recommendations

---

## Phase 6: Analysis and Recommendations

### 6.1 Interpret Results

**If Accuracy >= 80%:**
- ✅ System working correctly
- Ready for production
- Continue monitoring

**If Accuracy 60-79%:**
- ⚠️  Acceptable but needs improvement
- Review disagreement cases
- Adjust prompts
- Retest

**If Accuracy < 60%:**
- ❌ Significant issues
- Review all prompts
- Check configuration
- May need different approach

### 6.2 Common Patterns and Fixes

**Pattern: All in Default Stage**
- Issue: Settings not configured
- Fix: Run setup-pipeline-for-testing.sql

**Pattern: Many Disagreements (>30%)**
- Issue: Stage prompts too strict
- Fix: Make criteria more general
- Example: Change "Must have X AND Y AND Z" to "Has X OR Y OR shows Z"

**Pattern: Low Confidence Scores**
- Issue: Insufficient conversation data or vague prompts
- Fix: Enhance conversation history or clarify prompt criteria

**Pattern: All High Confidence but Wrong Stages**
- Issue: Prompts don't match your business logic
- Fix: Rewrite prompts to match how you actually categorize leads

### 6.3 Prompt Optimization

**Make Prompts More Effective:**

1. Add specific keywords:
   ```
   NEW LEAD keywords: "info", "what", "tell me", "curious"
   QUALIFIED keywords: "price", "cost", "interested", "need"
   HOT LEAD keywords: "buy", "purchase", "quote", "order"
   ```

2. Use clear criteria:
   ```
   ❌ Vague: "Contact shows interest"
   ✅ Clear: "Contact asked about specific product or pricing"
   ```

3. Add examples:
   ```
   Example messages that belong here:
   - "How much is the premium package?"
   - "I need pricing for 50 units"
   - "What features are included?"
   ```

4. Define exclusions:
   ```
   Does NOT belong here if:
   - Still in general exploration (→ New Lead)
   - Already discussing purchase terms (→ Hot Lead)
   ```

---

## Phase 7: Cleanup

### 7.1 Remove Test Data

**File:** `cleanup-test-data.sql`

**Steps:**
1. Review what will be deleted (script shows preview)
2. Run the deletion commands
3. Verify cleanup complete

**What it removes:**
- Test conversations (sender_id LIKE 'TEST_%')
- Test opportunities
- Keeps stages for future use

### 7.2 Document Learnings

Create `lessons-learned.txt`:
```
1. Configuration Requirements:
   - [What you learned about setup]

2. Prompt Effectiveness:
   - [Which prompts worked well]
   - [Which needed adjustment]

3. Edge Cases Found:
   - [Unusual cases discovered]

4. Recommendations:
   - [Changes to make]
   - [Best practices identified]
```

---

## Quick Reference: Test Execution Order

```
1. diagnose-current-state.sql          → Identify issues
2. setup-pipeline-for-testing.sql      → Fix configuration
3. create-test-conversations.sql       → Create test data
4. [Add to pipeline via UI]            → Trigger sorting
5. validate-test-results.sql           → Check accuracy
6. pipeline-sorting-metrics.sql        → Get metrics
7. test-pipeline-sorting-logic.js      → Validate logic
8. test-e2e-pipeline-flow.js           → E2E verification
9. backtest-pipeline-sorting.js        → Backtest analysis
10. generate-test-report.js            → Generate report
11. cleanup-test-data.sql              → Clean up
```

---

## Success Criteria

### Minimum Requirements:
- ✅ Accuracy >= 60%
- ✅ Analysis runs without errors
- ✅ At least some contacts sorted correctly

### Target Performance:
- ✅ Accuracy >= 80%
- ✅ High confidence >= 70%
- ✅ Agreement rate >= 70%
- ✅ Average confidence > 0.7

### Excellent Performance:
- ✅ Accuracy >= 90%
- ✅ High confidence >= 80%
- ✅ Agreement rate >= 80%
- ✅ Average confidence > 0.8

---

## Troubleshooting Common Issues

### Issue 1: "Pipeline settings not configured"

**Error in logs:**
```
[Pipeline Analyze] No global analysis prompt configured
```

**Fix:**
Run `setup-pipeline-for-testing.sql` in Supabase

**Verify:**
```sql
SELECT COUNT(*) FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID';
-- Should return 1
```

---

### Issue 2: "You exceeded your current quota"

**Error in logs:**
```
[Pipeline Analyze] Error: You exceeded your current quota
[Pipeline Analyze] Key #1 rate limited, trying next key...
[Pipeline Analyze] All 9 API keys failed
```

**Cause:** Gemini free tier limit reached (1,500 requests/day per key)

**Fix:**
- Wait 24 hours for quota reset
- Test will work automatically after reset
- For now, contacts will stay in default stage

**Verify key rotation:**
Should see in server startup logs:
```
[Pipeline Analyze] 🚀 Loaded 9 Gemini API key(s) for rotation
[Pipeline Analyze] 📊 Combined rate limit: 135 requests/minute
```

---

### Issue 3: All contacts show "Disagreed"

**In database:**
```sql
SELECT COUNT(*) FROM pipeline_opportunities 
WHERE user_id = 'YOUR_USER_ID' AND both_prompts_agreed = false;
-- High count
```

**Cause:** Stage prompts too strict or don't align with global prompt

**Fix:**
1. Review the analysis_prompt for each stage in `setup-pipeline-for-testing.sql`
2. Make criteria more general
3. Add more keyword examples
4. Rerun setup SQL to update prompts
5. Test again

**Example adjustment:**
```sql
-- Too strict:
'Must have asked about pricing AND delivery AND timeline'

-- Better:
'Asked about pricing OR delivery, showing purchase interest'
```

---

### Issue 4: Wrong stage assignments

**Example:** Contact asking about pricing goes to "New Lead" instead of "Qualified"

**Cause:** Global prompt and stage prompts misaligned

**Fix:**
1. Review global_analysis_prompt - is it clear about stage definitions?
2. Review stage analysis_prompt - does it match the global logic?
3. Ensure keywords are consistent across prompts
4. Add more specific examples

---

## Expected Test Timeline

### First Time Setup (with quota available):
1. Diagnosis: 5 minutes
2. Setup configuration: 5 minutes
3. Create test data: 5 minutes
4. Run tests: 10 minutes
5. Validate results: 5 minutes
6. Analyze metrics: 10 minutes
7. Generate report: 5 minutes

**Total: ~45 minutes**

### If Quota Exceeded:
1. Complete setup: 10 minutes
2. Wait for quota reset: 24 hours
3. Run tests: 15 minutes
4. Validate and report: 15 minutes

**Total: ~24 hours 40 minutes (most of it waiting)**

---

## Files Created for Testing

### SQL Scripts (Run in Supabase):
1. `diagnose-current-state.sql` - Initial diagnosis
2. `setup-pipeline-for-testing.sql` - Configuration setup
3. `create-test-conversations.sql` - Test data creation
4. `validate-test-results.sql` - Results validation
5. `pipeline-sorting-metrics.sql` - Performance metrics
6. `cleanup-test-data.sql` - Test data cleanup

### Node.js Scripts (Run in terminal):
1. `test-gemini-pipeline.js` - Gemini API connection test
2. `test-pipeline-sorting-logic.js` - Logic validation
3. `test-e2e-pipeline-flow.js` - End-to-end flow guide
4. `backtest-pipeline-sorting.js` - Backtest analysis
5. `generate-test-report.js` - Report generator

### Output Files:
1. `PIPELINE_TEST_REPORT.md` - Test report template (generated)
2. `diagnosis-findings.txt` - Your findings (you create)
3. `lessons-learned.txt` - Your learnings (you create)

---

## Quick Start (If Starting Fresh)

```bash
# 1. Check API keys
grep GOOGLE_AI_API_KEY .env.local

# 2. Get your user ID (run in Supabase)
SELECT id FROM auth.users WHERE email = 'your-email';

# 3. Run setup SQL in Supabase
# File: setup-pipeline-for-testing.sql
# Replace YOUR_USER_ID

# 4. Create test data in Supabase
# File: create-test-conversations.sql
# Replace YOUR_USER_ID and YOUR_PAGE_ID

# 5. Add test contacts to pipeline via UI
# Go to Conversations → Select TEST contacts → Add to Pipeline

# 6. Validate results in Supabase
# File: validate-test-results.sql
# Shows expected vs actual with accuracy

# 7. Review metrics in Supabase
# File: pipeline-sorting-metrics.sql
# Shows comprehensive performance data

# 8. Generate report
node generate-test-report.js

# 9. Fill in report with actual data
# Edit PIPELINE_TEST_REPORT.md

# 10. Clean up when done
# File: cleanup-test-data.sql
```

---

## Success Indicators

### ✅ Test Successful If:
- Setup scripts run without errors
- Test data created (6 conversations)
- Contacts added to pipeline successfully
- AI analysis completes (check logs)
- Accuracy >= 80% (from validation SQL)
- Most contacts show high confidence
- Both prompts agreed for majority

### ⚠️ Partial Success If:
- Analysis runs but many disagreements
- Accuracy 60-79%
- Some contacts in correct stages
- Need prompt adjustments

### ❌ Test Failed If:
- Setup scripts error
- No analysis runs
- All contacts in default
- Accuracy < 60%
- Need major fixes

---

## Documentation

After completing tests:

1. Fill in `PIPELINE_TEST_REPORT.md` with results
2. Document issues in `diagnosis-findings.txt`
3. Record learnings in `lessons-learned.txt`
4. Update prompts based on findings
5. Retest to verify improvements

---

## Next Steps After Testing

### If Tests Pass (Accuracy >= 80%):
1. Clean up test data
2. System is ready for production
3. Monitor real usage
4. Adjust prompts as needed

### If Tests Partially Pass (60-79%):
1. Review disagreement cases
2. Adjust stage prompts
3. Rerun tests
4. Iterate until >= 80%

### If Tests Fail (< 60%):
1. Review all prompts
2. Check if global and stage prompts align
3. Simplify criteria
4. Add more examples
5. Consider different stage definitions
6. Retest from scratch

---

## Support

If stuck:
1. Run `diagnose-current-state.sql` → Shows current state
2. Check server console logs → Shows runtime errors
3. Review `FIX_SORTING_NOT_WORKING.md` → Common solutions
4. Check `QUICK_FIX_NOW.md` → Fast fixes

For each issue pattern, there's a corresponding fix section in the docs.

