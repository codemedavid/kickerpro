# START HERE - Pipeline Sorting Testing

## Your Issue

All contacts went to the default stage instead of being automatically sorted.

## What Was Built

A complete testing framework with diagnosis, setup, test data, validation, and metrics - everything needed to identify and fix the issue.

---

## Quick Start (5 Minutes)

### Step 1: Diagnose

**Run in Supabase SQL Editor:**

```sql
-- Get your user ID first
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
```

Copy your user ID, then run `diagnose-current-state.sql` (replace YOUR_USER_ID in 3 places).

**Look for:**
- "❌ NO SETTINGS FOUND" → This is your problem!
- "Stages missing prompts" → Another issue
- "NOT ANALYZED" → Check server logs

---

### Step 2: Fix Configuration

**Run in Supabase SQL Editor:**

Open `setup-pipeline-for-testing.sql`:
1. Replace `'YOUR_USER_ID'` with your actual user ID
2. Replace `'YOUR_PAGE_ID'` with a page ID from:
   ```sql
   SELECT id FROM facebook_pages WHERE user_id = 'YOUR_USER_ID' LIMIT 1;
   ```
3. Run entire script

This creates:
- Pipeline settings with global analysis prompt ✅
- 4 stages with detailed analysis prompts ✅
- Proper configuration for auto-sorting ✅

---

### Step 3: Test It

**In your app:**
1. Go to Conversations page
2. Select 1-2 real contacts
3. Click "Add to Pipeline"
4. Watch for toast: "✨ Added & Sorted!" (not just "Added to Pipeline")
5. Check Pipeline page - contacts should be in different stages

**If it works:** You're done! The issue is fixed.

**If not:** Continue to full testing below.

---

## Full Testing (45 Minutes)

If quick test didn't work or you want comprehensive validation:

### Complete Test Flow:

**File to follow:** `RUN_ALL_TESTS.md`

This walks you through:
1. Diagnosis (5 min)
2. Setup (5 min)
3. Test data creation (5 min)
4. Test execution (10 min)
5. Results validation (10 min)
6. Metrics analysis (5 min)
7. Report generation (5 min)

---

## Most Likely Fix (90% of cases)

Your issue is probably **missing pipeline settings**.

**Quick Fix (2 minutes):**

Run this in Supabase:
```sql
-- Replace YOUR_USER_ID with your actual user ID

INSERT INTO pipeline_settings (user_id, global_analysis_prompt)
VALUES (
  'YOUR_USER_ID',
  'Analyze conversation and recommend stage: New Lead for browsing, Qualified for showing interest, Hot Lead for ready to buy. Consider keywords: browsing/info/curious → New Lead, price/interested/need → Qualified, buy/purchase/quote/order → Hot Lead.'
)
ON CONFLICT (user_id) 
DO UPDATE SET global_analysis_prompt = EXCLUDED.global_analysis_prompt;

-- Ensure stages have prompts
UPDATE pipeline_stages
SET analysis_prompt = 
  CASE name
    WHEN 'New Lead' THEN 'Contact is browsing, asking general questions. Keywords: info, what, tell me'
    WHEN 'Qualified' THEN 'Contact asked about pricing, products, features. Keywords: price, cost, interested'
    WHEN 'Hot Lead' THEN 'Contact ready to buy, asking for quote. Keywords: buy, purchase, order, quote'
    ELSE 'Manual review needed'
  END
WHERE user_id = 'YOUR_USER_ID' AND (analysis_prompt IS NULL OR analysis_prompt = '');
```

Then test again by adding a contact to pipeline!

---

## Files Reference

### Must Read:
- **This file** - Quick start
- `RUN_ALL_TESTS.md` - Complete test guide
- `COMPLETE_TESTING_GUIDE.md` - Detailed instructions

### SQL Scripts (Order matters):
1. `diagnose-current-state.sql` - Run first
2. `setup-pipeline-for-testing.sql` - Fix config
3. `create-test-conversations.sql` - Create test data
4. `validate-test-results.sql` - Check accuracy
5. `pipeline-sorting-metrics.sql` - Get metrics
6. `cleanup-test-data.sql` - Clean up

### Node Scripts:
1. `test-gemini-pipeline.js` - Test API connection
2. `test-pipeline-sorting-logic.js` - Test sorting logic
3. `test-e2e-pipeline-flow.js` - Test full flow
4. `backtest-pipeline-sorting.js` - Backtest analysis
5. `generate-test-report.js` - Generate report

---

## Decision Tree

```
Start here
    ↓
Run diagnose-current-state.sql
    ↓
What's the issue?
    ↓
┌───────────────┴──────────────┐
│                              │
"NO SETTINGS"              "API quota exceeded"
    ↓                              ↓
Run setup SQL               Wait 24 hours
    ↓                              ↓
Test again                  Test tomorrow
    ↓                              ↓
Works? ──Yes──→ Done!       Works? ──Yes──→ Done!
    ↓                              ↓
   No                             No
    ↓                              ↓
Full testing                Full testing
    ↓                              ↓
Adjust prompts              Check logs
    ↓                              ↓
Retest                      Fix issues
    ↓                              ↓
Done!                       Done!
```

---

## Support

**If stuck after quick fix:**
- Read `COMPLETE_TESTING_GUIDE.md` for detailed steps
- Check `FIX_SORTING_NOT_WORKING.md` for specific issues
- Review `DIAGNOSIS_RESULTS.md` for interpreting diagnostics

**If tests fail:**
- Check `PIPELINE_TEST_REPORT.md` template
- Document your results
- Review recommendations section
- Iterate on prompts

---

## Next Steps

1. **Run diagnose-current-state.sql** (2 min)
2. **If "NO SETTINGS":** Run setup-pipeline-for-testing.sql (3 min)
3. **Test with 1 contact** via UI (1 min)
4. **If works:** You're done! ✅
5. **If not:** Follow RUN_ALL_TESTS.md for full testing

---

**Most users fix this in 5 minutes by running the setup SQL!**

