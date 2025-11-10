# Run All Pipeline Sorting Tests - Master Guide

## Quick Start

This is your master checklist for complete pipeline sorting testing.

---

## Prerequisites

- [ ] Supabase project accessible
- [ ] .env.local has GOOGLE_AI_API_KEY (and ideally _2 through _9)
- [ ] Dev server running (`npm run dev`)
- [ ] Logged into your app
- [ ] Your user ID handy

---

## Step-by-Step Execution

### STEP 1: Get Your User ID

**Run in Supabase SQL Editor:**
```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
```

**Copy your user ID** (UUID format)

---

### STEP 2: Diagnose Current State

**File:** `diagnose-current-state.sql`

1. Open file
2. Replace `'YOUR_USER_ID'` in 3 places with your actual user ID
3. Run entire script in Supabase
4. Note the results:
   - Settings status: ____________
   - Stages count: ____________
   - Issues found: ____________

---

### STEP 3: Setup Configuration

**File:** `setup-pipeline-for-testing.sql`

1. Get your page ID:
   ```sql
   SELECT id, facebook_page_id, name FROM facebook_pages 
   WHERE user_id = 'YOUR_USER_ID' LIMIT 1;
   ```

2. Replace in setup file:
   - `'YOUR_USER_ID'` → your user ID
   - `'YOUR_PAGE_ID'` → your page ID

3. Run entire script in Supabase

4. Verify at end shows ✅ for settings and stages

---

### STEP 4: Create Test Data

**File:** `create-test-conversations.sql`

1. Replace `'YOUR_USER_ID'` and `'YOUR_PAGE_ID'`
2. Run entire script in Supabase
3. Verify 6 test conversations created
4. Note the sender_ids (TEST_PSID_001, 002, etc.)

---

### STEP 5: Test Auto-Sorting (Browser)

1. **Go to Conversations page** in your app
2. **Search or filter** for "TEST" in sender name
3. **Select all 6 test contacts** (checkboxes)
4. **Click "Add to Pipeline"** button
5. **Watch for:**
   - Toast notification (should say "✨ Added & Sorted!")
   - Server console logs (terminal)

**Server logs should show:**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 6 new contacts
[Pipeline Analyze] 🚀 Loaded 9 Gemini API key(s)
[Pipeline Analyze] ✅ Analyzed Test User 1: Agreed, confidence: 0.85
[Pipeline Analyze] ✅ Analyzed Test User 2: Agreed, confidence: 0.90
... (for all 6)
[Pipeline Bulk API] ✅ AI analysis completed: 6 contacts analyzed
```

**If you see errors:** Note them and check troubleshooting section

---

### STEP 6: Validate Results

**File:** `validate-test-results.sql`

1. Replace `'YOUR_USER_ID'`
2. Run in Supabase
3. Review output:
   - Expected vs Actual stages
   - ✅ CORRECT or ❌ WRONG markers
   - Confidence scores
   - Accuracy percentage at bottom

**Target:** Accuracy >= 80%

**Actual Accuracy:** ______%

---

### STEP 7: Check Metrics

**File:** `pipeline-sorting-metrics.sql`

1. Replace `'YOUR_USER_ID'`
2. Run in Supabase
3. Review all 8 metrics sections
4. Note the scorecard grades at end

**Grades:**
- Analysis Coverage: ______
- Agreement Rate: ______
- Confidence: ______

---

### STEP 8: Run Node Tests (Optional)

**If you want programmatic validation:**

```bash
# Get opportunity IDs
# Run in Supabase:
SELECT id FROM pipeline_opportunities
WHERE user_id = 'YOUR_USER_ID' AND sender_id LIKE 'TEST_%'
ORDER BY created_at DESC;

# Run test with IDs
node test-pipeline-sorting-logic.js <id1> <id2> <id3> <id4> <id5> <id6>
```

---

### STEP 9: Generate Report

```bash
node generate-test-report.js
```

Opens `PIPELINE_TEST_REPORT.md` - fill in your results

---

### STEP 10: Cleanup

**File:** `cleanup-test-data.sql`

1. Review what will be deleted
2. Run deletion commands
3. Verify cleanup complete

---

## Results Interpretation

### Scenario A: Perfect (80%+ accuracy)

**What you see:**
- 5-6 out of 6 contacts in correct stages
- High confidence scores (>0.7)
- Most show "both_prompts_agreed = true"

**Action:**
- ✅ System working correctly
- Clean up test data
- Ready for production use

---

### Scenario B: Good (60-79% accuracy)

**What you see:**
- 4-5 out of 6 contacts correct
- Some disagreements
- Mixed confidence scores

**Action:**
- Review disagreement cases
- Adjust stage prompts to be less strict
- Retest
- Should reach 80%+ after adjustments

---

### Scenario C: Poor (< 60% accuracy)

**What you see:**
- Most contacts in wrong stages or default
- Low confidence scores
- Many disagreements

**Action:**
- Review all prompts comprehensively
- Check if global and stage prompts align
- Simplify criteria
- Add more keyword examples
- May need to rewrite prompts from scratch

---

### Scenario D: Not Analyzed

**What you see:**
- All contacts in default/unmatched
- ai_analyzed_at is NULL
- No confidence scores

**Possible causes:**
1. Settings not configured → Run STEP 3
2. API quota exceeded → Wait 24 hours
3. Server error → Check logs

---

## Time Estimates

### If Everything Works:
- Setup: 15 minutes
- Testing: 10 minutes
- Validation: 10 minutes
- Report: 10 minutes
**Total: 45 minutes**

### If Need Adjustments:
- Initial test: 45 minutes
- Adjustment iteration: 20 minutes
- Retest: 15 minutes
**Total: 80 minutes**

### If API Quota Hit:
- Setup today: 15 minutes
- Wait: 24 hours
- Test tomorrow: 30 minutes
**Total: 24 hours 45 minutes**

---

## Final Checklist

After completing all steps:

- [ ] Diagnosis completed and documented
- [ ] Configuration setup verified
- [ ] Test data created (6 conversations)
- [ ] Auto-sorting tested via UI
- [ ] Results validated in database
- [ ] Metrics calculated and reviewed
- [ ] Test report filled out
- [ ] Issues identified and documented
- [ ] Recommendations written
- [ ] Test data cleaned up
- [ ] System ready for production OR needs fixes documented

---

## Emergency Quick Fix

If you just want it working NOW and will test later:

```sql
-- Run this in Supabase (replace YOUR_USER_ID):

-- 1. Add minimal settings
INSERT INTO pipeline_settings (user_id, global_analysis_prompt)
VALUES ('YOUR_USER_ID', 'Analyze conversation and recommend: New Lead for browsing, Qualified for interested, Hot Lead for ready to buy')
ON CONFLICT (user_id) DO UPDATE SET global_analysis_prompt = EXCLUDED.global_analysis_prompt;

-- 2. Ensure stages have prompts
UPDATE pipeline_stages
SET analysis_prompt = 'This is "' || name || '" if the contact matches this stage criteria'
WHERE user_id = 'YOUR_USER_ID' AND (analysis_prompt IS NULL OR analysis_prompt = '');

-- 3. Try adding a contact to pipeline again
```

Then add 1 test contact and see if it sorts!

---

## Support Resources

- **Configuration:** `GEMINI_PIPELINE_SETUP.md`
- **Quick fixes:** `QUICK_FIX_NOW.md`
- **Troubleshooting:** `FIX_SORTING_NOT_WORKING.md`
- **Complete guide:** `COMPLETE_TESTING_GUIDE.md` (this file)

---

**Start with STEP 1 and work through each step in order!**

