# End-to-End Testing Guide: Pipeline Auto-Sorting

## Complete Test Flow from Start to Finish

This guide walks you through testing the entire pipeline auto-sorting system with real test data.

---

## Prerequisites Completed

Before running this test, you should have already:
- [x] Created diagnostic SQL (diagnose-current-state.sql)
- [x] Created setup SQL (setup-pipeline-for-testing.sql)
- [x] Created test data SQL (create-test-conversations.sql)
- [x] Created validation SQL (validate-test-results.sql)
- [x] Have GOOGLE_AI_API_KEY in .env.local
- [x] Dev server running (npm run dev)

---

## Test Execution Steps

### STEP 1: Diagnose Current State (5 min)

1. Open Supabase SQL Editor
2. Get your user_id:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
   ```
3. Copy your user_id
4. Open `diagnose-current-state.sql`
5. Replace all `'YOUR_USER_ID'` with your actual user_id
6. Run the entire script
7. Review output:
   - Settings check: Should show status
   - Stages check: Should list all stages
   - Recent contacts: Shows what happened

**Expected Issues:**
- "No pipeline_settings record found" → Proceed to Step 2
- "Stages missing prompts" → Proceed to Step 2
- All working → Skip to Step 4

---

### STEP 2: Setup Pipeline Configuration (3 min)

1. Open `setup-pipeline-for-testing.sql`
2. Replace `'YOUR_USER_ID'` with your actual user_id (find/replace all)
3. Run the entire script in Supabase
4. Verify output shows:
   - ✅ Settings Created
   - ✅ Stage Created: New Lead
   - ✅ Stage Created: Qualified
   - ✅ Stage Created: Hot Lead
   - ✅ Stage Created: Unmatched

**What This Does:**
- Creates comprehensive global analysis prompt
- Creates 4 pipeline stages with detailed analysis prompts
- Each stage has keywords and clear criteria
- Sets Unmatched as default stage

---

### STEP 3: Create Test Data (2 min)

1. Get your facebook_page_id:
   ```sql
   SELECT id, facebook_page_id, name 
   FROM facebook_pages 
   WHERE user_id = 'YOUR_USER_ID' 
   LIMIT 1;
   ```
2. Open `create-test-conversations.sql`
3. Replace `'YOUR_USER_ID'` and `'YOUR_PAGE_ID'` (find/replace all)
4. Run the entire script in Supabase
5. Verify 6 test conversations were created

**Test Contacts Created:**
- John Browser → Expected: New Lead
- Maria Interested → Expected: Qualified
- Carlos Buyer → Expected: Hot Lead
- Sarah Urgent → Expected: Hot Lead
- Lisa Explorer → Expected: New Lead
- Tom Comparer → Expected: Qualified

---

### STEP 4: Open Browser Console (1 min)

1. Open your app: http://localhost:3000
2. Log in to your account
3. Press F12 to open DevTools
4. Go to Console tab
5. Clear console (Ctrl+L or clear button)

---

### STEP 5: Run Browser Pre-Test (30 sec)

Paste this into browser console:

```javascript
(async function() {
  console.log('🧪 Pre-Test Check\n');
  
  // Check settings
  const settings = await fetch('/api/pipeline/settings').then(r => r.json());
  console.log('1. Settings:', settings.settings?.global_analysis_prompt ? '✅ OK' : '❌ MISSING');
  
  // Check stages
  const stages = await fetch('/api/pipeline/stages').then(r => r.json());
  const withPrompts = stages.stages.filter(s => s.analysis_prompt?.length > 50);
  console.log('2. Stages:', withPrompts.length >= 3 ? `✅ ${withPrompts.length} ready` : '❌ NEED MORE');
  
  // Check test conversations
  const convs = await fetch('/api/conversations?limit=100').then(r => r.json());
  const testConvs = convs.conversations.filter(c => c.sender_id?.startsWith('TEST_'));
  console.log('3. Test data:', testConvs.length === 6 ? '✅ 6 found' : `⚠️ ${testConvs.length} found`);
  
  console.log('\n' + (withPrompts.length >= 3 && testConvs.length >= 6 ? '✅ Ready to test!' : '❌ Fix issues above first'));
})();
```

**Expected Output:**
```
1. Settings: ✅ OK
2. Stages: ✅ 4 ready
3. Test data: ✅ 6 found
✅ Ready to test!
```

---

### STEP 6: Navigate to Conversations Page (10 sec)

1. In your app, go to Conversations page
2. You should see the 6 test contacts in the list
3. Look for names: John, Maria, Carlos, Sarah, Lisa, Tom
4. They all have sender_id starting with TEST_

---

### STEP 7: Add Test Contacts to Pipeline (1 min)

1. **Select all 6 test contacts** (click checkboxes)
2. **Click "Add to Pipeline"** button
3. **Watch the browser console** for any errors
4. **Watch your server terminal** for analysis logs

**Expected Server Logs:**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 6 new contacts
[Pipeline Analyze] 🚀 Loaded 9 Gemini API key(s) for rotation
[Pipeline Analyze] ✅ Analyzed John Browser: Agreed, confidence: 0.85
[Pipeline Analyze] ✅ Analyzed Maria Interested: Agreed, confidence: 0.88
[Pipeline Analyze] ✅ Analyzed Carlos Buyer: Agreed, confidence: 0.92
[Pipeline Analyze] ✅ Analyzed Sarah Urgent: Agreed, confidence: 0.90
[Pipeline Analyze] ✅ Analyzed Lisa Explorer: Agreed, confidence: 0.83
[Pipeline Analyze] ✅ Analyzed Tom Comparer: Agreed, confidence: 0.87
[Pipeline Bulk API] ✅ AI analysis completed: 6 contacts analyzed
```

**Expected Toast Notification:**
```
✨ Added & Sorted!
6 contacts added and automatically sorted to appropriate stages!
```

**If you see different logs, note them for troubleshooting.**

---

### STEP 8: Verify in Pipeline Page (2 min)

1. **Navigate to Pipeline page** in your app
2. **Look at each stage column:**

**Expected Distribution:**

```
┌─────────────────────────┐
│      New Lead (2)        │
├─────────────────────────┤
│  • John Browser         │
│  • Lisa Explorer        │
└─────────────────────────┘

┌─────────────────────────┐
│     Qualified (2)        │
├─────────────────────────┤
│  • Maria Interested     │
│  • Tom Comparer         │
└─────────────────────────┘

┌─────────────────────────┐
│      Hot Lead (2)        │
├─────────────────────────┤
│  • Carlos Buyer         │
│  • Sarah Urgent         │
└─────────────────────────┘

┌─────────────────────────┐
│      Unmatched (0)       │
├─────────────────────────┤
│  (empty - all sorted!)  │
└─────────────────────────┘
```

3. **Click on each contact** to view:
   - AI confidence score
   - Both prompts agreed status
   - AI reasoning

---

### STEP 9: Validate Results with SQL (2 min)

1. Open Supabase SQL Editor
2. Open `validate-test-results.sql`
3. Replace `'YOUR_USER_ID'` with your actual user_id
4. Run the entire script
5. Review the output

**Expected Validation Output:**

```
=== TEST RESULT ===
Carlos Buyer      | Hot Lead  | Hot Lead  | ✅ CORRECT    | 0.92 | true
John Browser      | New Lead  | New Lead  | ✅ CORRECT    | 0.85 | true
Lisa Explorer     | New Lead  | New Lead  | ✅ CORRECT    | 0.83 | true
Maria Interested  | Qualified | Qualified | ✅ CORRECT    | 0.88 | true
Sarah Urgent      | Hot Lead  | Hot Lead  | ✅ CORRECT    | 0.90 | true
Tom Comparer      | Qualified | Qualified | ✅ CORRECT    | 0.87 | true

=== ACCURACY METRICS ===
total_tests: 6
correct_assignments: 6
accuracy_percentage: 100.0%
avg_confidence: 0.87
agreements: 6
disagreements: 0
```

---

### STEP 10: Review AI Reasoning (3 min)

Look at the detailed reasoning section from validation SQL:

**Example Good Result:**
```
John Browser:
  Global: "New Lead" (confidence: 0.85)
  Reasoning: "Contact is asking general exploratory questions with keywords 'curious' and 'what products'. No specific product interest or pricing questions. Clear early-stage inquiry."
  Stage Match: New Lead → belongs: true (confidence: 0.88)
  Final: ✅ Agreed → New Lead
```

**Example Disagreement (if any):**
```
Ambiguous Contact:
  Global: "Qualified" (confidence: 0.65)
  Reasoning: "Some interest shown but unclear"
  Stage Match: Qualified → belongs: false (confidence: 0.45)
  Final: ⚠️ Disagreed → Moved to Unmatched
```

---

## Success Criteria

Test is successful if:

- ✅ At least 4/6 contacts in expected stages (66% accuracy)
- ✅ Average confidence > 0.70
- ✅ Toast shows "Added & Sorted!" (not "Set up pipeline settings")
- ✅ Server logs show "AI analysis completed"
- ✅ No critical errors in console

**If all criteria met: AUTO-SORTING IS WORKING! 🎉**

---

## Troubleshooting Common Issues

### Issue 1: All Contacts in Unmatched

**Check:** Did AI analysis run?

Run in Supabase:
```sql
SELECT sender_name, ai_analyzed_at, both_prompts_agreed 
FROM pipeline_opportunities 
WHERE sender_id LIKE 'TEST_%';
```

**If ai_analyzed_at is NULL:**
- AI didn't run
- Check server logs for "No global analysis prompt"
- Re-run setup-pipeline-for-testing.sql

**If ai_analyzed_at exists but all disagreed:**
- Prompts are too strict
- Review AI reasoning
- Adjust stage prompts to be less restrictive

---

### Issue 2: API Quota Exceeded

**Server logs show:** "quota exceeded"

**Solution:**
- Wait 24 hours for quota reset
- Test will work automatically after reset
- Or run just 1-2 contacts at a time

---

### Issue 3: Wrong Stages Assigned

**Some contacts in unexpected stages:**

1. Check AI reasoning for those contacts
2. See why AI chose that stage
3. Adjust prompts if logic is wrong
4. Re-run analysis on those contacts

---

### Issue 4: Server Errors

**Check server console for:**
- TypeScript errors
- Database connection issues
- Missing environment variables

**Common fixes:**
- Restart dev server
- Check .env.local has GOOGLE_AI_API_KEY
- Verify Supabase connection

---

## After Testing

### If Test Passed (80%+ accuracy):

1. ✅ Auto-sorting is working correctly
2. Clean up test data (see cleanup-test-data.sql)
3. Start using with real contacts
4. Monitor results and adjust prompts as needed

### If Test Failed (<80% accuracy):

1. Review AI reasoning from validation SQL
2. Identify patterns in errors
3. Adjust prompts based on patterns
4. Re-run test
5. Iterate until accuracy improves

---

## Performance Benchmarks

**Expected Performance:**

| Metric | Target | Actual |
|--------|--------|--------|
| Contacts tested | 6 | ___ |
| Correctly sorted | 5-6 (83-100%) | ___ |
| Avg confidence | > 0.75 | ___ |
| Agreement rate | > 80% | ___ |
| Analysis time | 2-5 sec/contact | ___ |
| Errors | 0 | ___ |

Fill in actual results after testing.

---

## Next Steps

### After Successful Test:

1. **Document your configuration** (prompts that worked well)
2. **Clean up test data** (run cleanup-test-data.sql)
3. **Test with 1-2 real contacts**
4. **Monitor results over time**
5. **Refine prompts based on production use**

### If Changes Needed:

1. **Adjust prompts** in Supabase or via UI
2. **Re-run test** with same test data
3. **Compare results** to see improvement
4. **Iterate** until accuracy is acceptable

---

## Test Report Template

After completing the test, fill this out:

```
PIPELINE AUTO-SORTING TEST REPORT
Date: _______________
Tester: _______________

CONFIGURATION:
- Global prompt configured: YES / NO
- Stages with prompts: ___ / 4
- API keys available: 9
- API quota status: Available / Exceeded

TEST RESULTS:
- Total contacts tested: 6
- Correctly sorted: ___ (___%)
- In default stage: ___
- Average confidence: ___
- Both agreed: ___ / 6

DETAILED RESULTS:
1. John Browser: Expected New Lead → Got _______ (✅/❌)
2. Maria Interested: Expected Qualified → Got _______ (✅/❌)
3. Carlos Buyer: Expected Hot Lead → Got _______ (✅/❌)
4. Sarah Urgent: Expected Hot Lead → Got _______ (✅/❌)
5. Lisa Explorer: Expected New Lead → Got _______ (✅/❌)
6. Tom Comparer: Expected Qualified → Got _______ (✅/❌)

ISSUES FOUND:
- _______________________
- _______________________

ACCURACY: ___% (acceptable: >80%, good: >90%, excellent: 100%)

STATUS: PASS / FAIL

NEXT ACTIONS:
- _______________________
- _______________________
```

---

## Files Used in This Test

1. `diagnose-current-state.sql` - Initial diagnosis
2. `setup-pipeline-for-testing.sql` - Configuration setup
3. `create-test-conversations.sql` - Test data creation
4. `test-pipeline-sorting-full.js` - Automated checks
5. `validate-test-results.sql` - Results validation
6. `run-e2e-test-guide.md` - This file

---

**Ready to run the complete end-to-end test? Start with STEP 1!**

