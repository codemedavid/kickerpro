# Pipeline Auto-Sorting: Complete Test Report and Results

## Test Overview

This document provides the complete testing framework, expected results, and troubleshooting guide for the pipeline auto-sorting feature.

---

## Test Files Created

### 1. Diagnostic Tools
- **diagnose-current-state.sql** - Identifies why contacts went to default
- **DIAGNOSE_PIPELINE_SORTING.sql** - Detailed diagnostic queries

### 2. Setup and Configuration
- **setup-pipeline-for-testing.sql** - Configures pipeline with proper prompts
- **PIPELINE_SETUP_COMPLETE.md** - Complete implementation documentation

### 3. Test Data
- **create-test-conversations.sql** - Creates 6 test contacts with different profiles

### 4. Testing Scripts
- **test-pipeline-sorting-full.js** - Automated Node.js test
- **test-gemini-pipeline.js** - Gemini API connectivity test
- **run-e2e-test-guide.md** - Step-by-step testing guide

### 5. Validation and Backtesting
- **validate-test-results.sql** - Compares expected vs actual results
- **backtest-pipeline-sorting.sql** - Comprehensive metrics and analysis

### 6. Cleanup
- **cleanup-test-data.sql** - Removes test data after testing

---

## Expected Test Results

### Test Contacts and Expected Stages

| Contact Name | Sender ID | Message Content | Expected Stage | Why |
|--------------|-----------|-----------------|----------------|-----|
| John Browser | TEST_BROWSE_001 | "just curious about what products you offer" | **New Lead** | General browsing, no specific interest |
| Lisa Explorer | TEST_BROWSE_002 | "wanted to learn more about your products" | **New Lead** | Early exploration, information gathering |
| Maria Interested | TEST_QUALIFIED_001 | "How much is your premium package?" | **Qualified** | Specific product interest, pricing question |
| Tom Comparer | TEST_QUALIFIED_002 | "comparing prices... What is your cost per unit?" | **Qualified** | Evaluating options, price comparison |
| Carlos Buyer | TEST_HOT_001 | "I want to order 50 units. Send quote" | **Hot Lead** | Ready to order, requesting quote |
| Sarah Urgent | TEST_HOT_002 | "Need 100 units ASAP! Ready to purchase" | **Hot Lead** | Purchase intent, urgency, specific quantity |

---

## Success Criteria

### Minimum Requirements (Must Pass)

- [ ] At least 4/6 contacts (66%) in correct stages
- [ ] Average confidence score > 0.70
- [ ] AI analysis ran (ai_analyzed_at not NULL)
- [ ] Toast shows "Added & Sorted!" not "Configure settings"
- [ ] No server errors in console

### Optimal Results (Ideal)

- [ ] 5-6/6 contacts (83-100%) in correct stages
- [ ] Average confidence score > 0.80
- [ ] At least 4/6 with both_prompts_agreed = true
- [ ] Analysis time < 5 seconds per contact
- [ ] Clear AI reasoning visible for each contact

---

## Test Execution Checklist

### Phase 1: Setup (One-time)
- [ ] Get your user_id from Supabase
- [ ] Get your facebook_page_id from Supabase
- [ ] Run diagnose-current-state.sql (identify issues)
- [ ] Run setup-pipeline-for-testing.sql (configure pipeline)
- [ ] Verify: Settings and stages created
- [ ] Run create-test-conversations.sql (create test data)
- [ ] Verify: 6 test contacts created

### Phase 2: Pre-Test Validation
- [ ] Dev server running (npm run dev)
- [ ] GOOGLE_AI_API_KEY in .env.local
- [ ] Logged into app in browser
- [ ] Browser console open (F12)
- [ ] Run pre-test browser script (see run-e2e-test-guide.md)
- [ ] All checks show ✅

### Phase 3: Execute Test
- [ ] Go to Conversations page
- [ ] Find 6 test contacts (names start with TEST_)
- [ ] Select all 6 contacts
- [ ] Click "Add to Pipeline"
- [ ] Note toast notification message
- [ ] Check server console for analysis logs
- [ ] Wait for completion (should be ~30 seconds for 6 contacts)

### Phase 4: Verify Results
- [ ] Go to Pipeline page
- [ ] Check distribution across stages
- [ ] Click on each contact to see AI reasoning
- [ ] Note confidence scores
- [ ] Run validate-test-results.sql in Supabase
- [ ] Review accuracy percentage

### Phase 5: Analyze Results
- [ ] Run backtest-pipeline-sorting.sql
- [ ] Review all 10 backtest sections
- [ ] Note any failures or patterns
- [ ] Identify needed prompt adjustments
- [ ] Calculate final grade

### Phase 6: Cleanup
- [ ] Document test results below
- [ ] Run cleanup-test-data.sql
- [ ] Verify test data removed
- [ ] Keep stages and settings for production

---

## Test Results Template

Fill this out after running the test:

```
====================================================================
PIPELINE AUTO-SORTING TEST RESULTS
====================================================================
Date: ________________
Tester: ________________
User ID: ________________

CONFIGURATION STATUS:
✅/❌ Global analysis prompt configured
✅/❌ 4 stages created with analysis prompts
✅/❌ Gemini API key available
✅/❌ Test data created (6 contacts)

TEST EXECUTION:
- Started at: __:__
- Completed at: __:__
- Total duration: ___ seconds
- Toast message: _______________________

SERVER LOGS OBSERVED:
- "Triggering automatic AI analysis": YES / NO
- "Loaded 9 Gemini API keys": YES / NO
- "AI analysis completed": YES / NO
- Errors: _______________________

RESULTS BY CONTACT:
1. John Browser (TEST_BROWSE_001)
   Expected: New Lead
   Actual: _______________
   Confidence: ___
   Result: ✅ PASS / ⚠️ DEFAULT / ❌ FAIL

2. Lisa Explorer (TEST_BROWSE_002)
   Expected: New Lead
   Actual: _______________
   Confidence: ___
   Result: ✅ PASS / ⚠️ DEFAULT / ❌ FAIL

3. Maria Interested (TEST_QUALIFIED_001)
   Expected: Qualified
   Actual: _______________
   Confidence: ___
   Result: ✅ PASS / ⚠️ DEFAULT / ❌ FAIL

4. Tom Comparer (TEST_QUALIFIED_002)
   Expected: Qualified
   Actual: _______________
   Confidence: ___
   Result: ✅ PASS / ⚠️ DEFAULT / ❌ FAIL

5. Carlos Buyer (TEST_HOT_001)
   Expected: Hot Lead
   Actual: _______________
   Confidence: ___
   Result: ✅ PASS / ⚠️ DEFAULT / ❌ FAIL

6. Sarah Urgent (TEST_HOT_002)
   Expected: Hot Lead
   Actual: _______________
   Confidence: ___
   Result: ✅ PASS / ⚠️ DEFAULT / ❌ FAIL

ACCURACY METRICS:
- Total tested: 6
- Correct: ___ / 6
- In default: ___ / 6
- Wrong stage: ___ / 6
- Accuracy: ___%
- Avg confidence: ___
- Agreements: ___ / 6
- Disagreements: ___ / 6

PERFORMANCE METRICS:
- Avg analysis time: ___ seconds per contact
- Fastest: ___ seconds
- Slowest: ___ seconds
- API key rotation: WORKING / NOT WORKING
- Errors encountered: ___

FINAL GRADE: A+ / A / B / C / D / F

DEPLOYMENT READY: YES / NO / NEEDS ADJUSTMENT

ISSUES IDENTIFIED:
1. _______________________
2. _______________________
3. _______________________

RECOMMENDATIONS:
1. _______________________
2. _______________________
3. _______________________

====================================================================
```

---

## Troubleshooting Decision Tree

### If Accuracy = 0% (All in Default)

**Check 1:** Did AI analysis run?
```sql
SELECT ai_analyzed_at FROM pipeline_opportunities 
WHERE sender_id LIKE 'TEST_%' LIMIT 1;
```

- If NULL → AI didn't run → Check settings
- If NOT NULL → AI ran but disagreed → Check prompts

**Check 2:** Server logs
- "No global analysis prompt" → Run setup SQL
- "quota exceeded" → Wait for reset or use other keys
- No errors but still default → Prompts too strict

**Fix:**
- Run setup-pipeline-for-testing.sql
- Restart server
- Test again

---

### If Accuracy = 50-75% (Mixed Results)

**Pattern Analysis:**
- Which stage has most errors?
- Are errors consistent (e.g., all Hot Leads go to Qualified)?
- Check AI reasoning for pattern

**Fix:**
- Adjust that specific stage's prompt
- Add more keywords
- Make criteria more general
- Re-test affected contacts

---

### If Accuracy > 80% (Good Results)

**Minor Adjustments:**
- Review the 1-2 that failed
- Check if their message was truly ambiguous
- Decide: Is manual review acceptable for edge cases?

**Proceed to Production:**
- Clean up test data
- Start using with real contacts
- Monitor for issues

---

## Common Patterns and Fixes

### Pattern 1: Hot Leads Going to Qualified

**Reason:** "Hot Lead" prompt too strict (requires too many signals)

**Fix:**
```
Change from: "Must have quote request AND timeline AND payment discussion"
Change to: "Shows ONE of: quote request, purchase intent, timeline, or payment discussion"
```

### Pattern 2: New Leads Going to Qualified

**Reason:** "Qualified" prompt too broad (catches general questions)

**Fix:**
```
Add: "Does NOT belong if: Just asking 'what do you sell' or general browsing"
Clarify: "Must show interest in SPECIFIC product, not general inquiry"
```

### Pattern 3: All Disagreements

**Reason:** Global and stage prompts use different criteria

**Fix:**
```
Align keywords:
- Global uses: "price question" → Qualified
- Stage uses: "must discuss detailed pricing"
- Make consistent: Both use "any price-related question"
```

---

## After Testing

### If Test Passed (>80% accuracy):

1. **Document what worked:**
   - Save your successful prompts
   - Note the accuracy achieved
   - Record average confidence scores

2. **Clean up:**
   ```sql
   -- Run in Supabase
   \i cleanup-test-data.sql
   ```

3. **Deploy to production:**
   - Test with 1-2 real contacts
   - Monitor results
   - Adjust as needed

### If Test Failed (<80% accuracy):

1. **Analyze failures:**
   - Run backtest-pipeline-sorting.sql
   - Identify patterns
   - Note AI reasoning

2. **Adjust prompts:**
   - Make changes in Supabase or UI
   - Focus on failed cases
   - Keep successful ones unchanged

3. **Re-run test:**
   - Don't cleanup test data yet
   - Re-analyze same contacts
   - Compare results

4. **Iterate:**
   - Repeat until accuracy >80%
   - Then cleanup and deploy

---

## Production Readiness Checklist

Before using with real contacts:

- [ ] Test accuracy >80%
- [ ] Average confidence >0.7
- [ ] Agreement rate >70%
- [ ] Performance <5 sec/contact
- [ ] No critical errors
- [ ] Prompts documented
- [ ] Team trained on reviewing Unmatched stage
- [ ] Monitoring plan in place

---

## Files Summary

**Run in this order:**

1. `diagnose-current-state.sql` → Identify issues
2. `setup-pipeline-for-testing.sql` → Fix configuration
3. `create-test-conversations.sql` → Create test data
4. `test-pipeline-sorting-full.js` → Run automated checks
5. Test in UI → Add contacts to pipeline
6. `validate-test-results.sql` → Check accuracy
7. `backtest-pipeline-sorting.sql` → Detailed analysis
8. `cleanup-test-data.sql` → Remove test data

**Total time:** ~30-45 minutes for complete testing cycle

---

## Support

If issues persist after following this guide:

1. Share output from `diagnose-current-state.sql`
2. Share output from `validate-test-results.sql`
3. Share server console logs
4. Share your global_analysis_prompt text
5. Share one example of stage analysis_prompt

This will help identify the specific issue quickly.

---

**Testing framework complete. Ready to diagnose and validate pipeline sorting!**

