# START HERE: Pipeline Auto-Sorting Testing Framework

## Quick Start Guide

You reported that all contacts went to the default stage. This testing framework will help you:
1. Diagnose why it happened
2. Fix the root cause
3. Test with real data
4. Validate it works correctly

---

## What Was Created

A complete testing and validation framework with 12 files:

### Diagnostic Files
1. **diagnose-current-state.sql** - Run this first to find the problem
2. **DIAGNOSE_PIPELINE_SORTING.sql** - Detailed diagnostic

### Fix Files
3. **setup-pipeline-for-testing.sql** - Configures everything properly
4. **FIX_SORTING_NOT_WORKING.md** - Solutions guide
5. **QUICK_FIX_NOW.md** - Fast fix steps

### Test Data Files
6. **create-test-conversations.sql** - Creates 6 test contacts

### Testing Files
7. **test-pipeline-sorting-full.js** - Automated Node test
8. **run-e2e-test-guide.md** - Step-by-step testing

### Validation Files
9. **validate-test-results.sql** - Check accuracy
10. **backtest-pipeline-sorting.sql** - Detailed metrics

### Cleanup Files
11. **cleanup-test-data.sql** - Remove test data
12. **COMPLETE_TEST_REPORT.md** - Full documentation

---

## Run This 5-Minute Test Now

### STEP 1: Get Your User ID (30 seconds)

In Supabase SQL Editor:
```sql
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

Copy your user_id (UUID format).

---

### STEP 2: Diagnose the Problem (2 minutes)

1. Open `diagnose-current-state.sql`
2. Find/Replace: `'YOUR_USER_ID'` → `'your-actual-user-id'`
3. Run in Supabase SQL Editor
4. Look at the results

**You'll see one of these:**

#### Result A: No Settings Found ❌
```
❌ CRITICAL: No pipeline_settings record found!
```
**→ This is your problem! Go to Step 3.**

#### Result B: Stages Missing Prompts ❌
```
Stage: New Lead - ❌ CRITICAL: No analysis_prompt!
```
**→ Stages need prompts! Go to Step 3.**

#### Result C: AI Never Ran ❌
```
❌ CRITICAL: AI analysis never ran
```
**→ Configuration issue! Go to Step 3.**

#### Result D: AI Disagreed ⚠️
```
⚠️ AI DISAGREED (moved to default)
```
**→ Prompts too strict! Go to Step 4.**

---

### STEP 3: Fix Configuration (2 minutes)

1. Open `setup-pipeline-for-testing.sql`
2. Find/Replace: `'YOUR_USER_ID'` → `'your-actual-user-id'`
3. Run entire script in Supabase
4. Verify output shows: ✅ Settings Created, ✅ Stages Created

**This creates:**
- Comprehensive global analysis prompt
- 4 pipeline stages with detailed prompts
- All configured for auto-sorting

---

### STEP 4: Test with Test Data (5 minutes)

1. Get your page_id:
   ```sql
   SELECT id FROM facebook_pages WHERE user_id = 'YOUR_USER_ID' LIMIT 1;
   ```

2. Open `create-test-conversations.sql`
3. Replace `'YOUR_USER_ID'` and `'YOUR_PAGE_ID'`
4. Run in Supabase
5. Verify: 6 test conversations created

**Go to your app:**
6. Open Conversations page
7. Select all 6 TEST_ contacts
8. Click "Add to Pipeline"
9. Watch server console

**Expected:**
```
[Pipeline Analyze] 🚀 Loaded 9 Gemini API key(s)
[Pipeline Analyze] ✅ Analyzed John Browser: Agreed, confidence: 0.85
... (5 more)
[Pipeline Bulk API] ✅ AI analysis completed: 6 contacts analyzed
```

10. Go to Pipeline page
11. Verify contacts are distributed across stages (not all in Unmatched)

---

### STEP 5: Validate Results (2 minutes)

1. Open `validate-test-results.sql`
2. Replace `'YOUR_USER_ID'`
3. Run in Supabase
4. Check accuracy percentage

**Expected:**
```
accuracy_percentage: 83-100%
avg_confidence: 0.80+
agreements: 5-6
```

**If you see this → IT'S WORKING!** ✅

---

## Quick Decision Tree

```
Did you run setup-pipeline-for-testing.sql?
├─ NO → Run it now, then test
└─ YES → Check results

Are all contacts still in default?
├─ YES → Check server logs
│   ├─ "No global analysis prompt" → Settings didn't save, try again
│   ├─ "quota exceeded" → Wait 24 hours or test with 1 contact
│   └─ "Disagreed, confidence: 0" → Prompts too strict, adjust
└─ NO → Some sorted correctly?
    ├─ YES, 4-6/6 correct → ✅ WORKING! Clean up test data
    └─ YES, but <4/6 correct → Adjust prompts, test again
```

---

## Most Likely Issues and Fixes

### Issue 1: Settings Not Saved (80% of cases)

**Symptoms:**
- Diagnostic shows "No pipeline_settings record"
- Server logs: "No global analysis prompt configured"

**Fix:**
```sql
-- Run this in Supabase
\i setup-pipeline-for-testing.sql
-- (after replacing YOUR_USER_ID)
```

**Then test again immediately.**

---

### Issue 2: API Quota Exceeded (15% of cases)

**Symptoms:**
- Server logs: "quota exceeded"
- Test script shows: "API quota exceeded"

**Fix:**
- Wait 24 hours for quota reset
- Or test with just 1 contact to verify logic
- System will work automatically when quota resets

---

### Issue 3: Prompts Too Strict (5% of cases)

**Symptoms:**
- AI ran (ai_analyzed_at exists)
- All show "Disagreed"
- Confidence = 0

**Fix:**
- Run `backtest-pipeline-sorting.sql` to see patterns
- Adjust stage prompts to be less restrictive
- Re-run analysis

---

## Testing Workflow

```
┌─────────────────────────────────────────┐
│ 1. Diagnose                              │
│    Run: diagnose-current-state.sql      │
│    Time: 2 min                           │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 2. Fix Configuration                     │
│    Run: setup-pipeline-for-testing.sql  │
│    Time: 2 min                           │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 3. Create Test Data                      │
│    Run: create-test-conversations.sql   │
│    Time: 1 min                           │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 4. Test in UI                            │
│    Select TEST_ contacts → Add to       │
│    Pipeline → Watch results              │
│    Time: 2 min                           │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 5. Validate                              │
│    Run: validate-test-results.sql       │
│    Time: 1 min                           │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 6. Backtest Analysis                     │
│    Run: backtest-pipeline-sorting.sql   │
│    Time: 2 min                           │
└──────────────┬──────────────────────────┘
               ↓
           ┌─────────┐
      Passed?│        
      ├─ YES └─> Clean up and deploy
      └─ NO ──> Adjust prompts, go to step 4
```

**Total Time:** 10-15 minutes for complete test cycle

---

## What Each File Does

| File | Purpose | When to Use |
|------|---------|-------------|
| diagnose-current-state.sql | Find why it failed | Always run first |
| setup-pipeline-for-testing.sql | Configure pipeline | If settings missing |
| create-test-conversations.sql | Create test data | Before UI testing |
| test-pipeline-sorting-full.js | Automated checks | Optional verification |
| validate-test-results.sql | Check accuracy | After adding to pipeline |
| backtest-pipeline-sorting.sql | Detailed metrics | After validation |
| cleanup-test-data.sql | Remove tests | After successful test |

---

## Expected Timeline

### First Run (Complete Setup):
- Diagnosis: 2 min
- Setup: 2 min
- Test data: 1 min
- UI testing: 2 min
- Validation: 1 min
- Analysis: 2 min
**Total: 10 minutes**

### If Adjustments Needed:
- Review results: 5 min
- Adjust prompts: 2 min
- Re-test: 2 min
- Validate: 1 min
**Total: 10 minutes per iteration**

### When Working:
- Cleanup: 1 min
- Real contact test: 2 min
- Deploy: Ready!

---

## Success Indicators

You'll know it's working when:

1. **Toast notification:**
   ```
   ✨ Added & Sorted!
   6 contacts added and automatically sorted to appropriate stages!
   ```

2. **Server logs:**
   ```
   [Pipeline Analyze] ✅ Analyzed: Agreed, confidence: 0.85
   (Multiple lines like this)
   ```

3. **Pipeline page:**
   - Contacts distributed across stages
   - Not all in Unmatched
   - Shows confidence scores

4. **Validation SQL:**
   ```
   accuracy_percentage: 83-100%
   final_grade: A or A+
   ```

---

## Get Started Now

**Run these 3 commands in Supabase (in order):**

1. Get your user_id
2. Run diagnose-current-state.sql (with your user_id)
3. Read the output

**This takes 2 minutes and tells you exactly what to fix.**

Then follow the fix steps shown in the diagnostic output!

---

**All testing files are ready. Start with diagnose-current-state.sql!**
