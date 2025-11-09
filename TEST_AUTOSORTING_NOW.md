# 🧪 TEST: Pipeline Auto-Sorting

## ✅ Quick Test - 5 Minutes

Follow these steps to verify auto-sorting is working:

---

## Step 1: Verify Files Exist

Run in terminal:

```bash
# Check if new files were created
ls -la src/lib/pipeline/analyze.ts
grep -n "analyzePipelineOpportunities" src/app/api/pipeline/opportunities/bulk/route.ts
```

**Expected:**
```
✅ src/lib/pipeline/analyze.ts exists
✅ Found analyzePipelineOpportunities import
```

---

## Step 2: Check OpenAI API Key

```bash
# In terminal
grep OPENAI_API_KEY .env.local
```

**If you see your key:** ✅ Good  
**If "No such file" or key missing:**

```bash
# Create/edit .env.local
echo 'OPENAI_API_KEY=sk-your-actual-key-here' >> .env.local
```

Then **restart your dev server:**
```bash
# Press Ctrl+C to stop
npm run dev
```

---

## Step 3: Browser Console Test

1. **Open your app** in browser
2. **Go to Conversations page**
3. **Press F12** (open DevTools)
4. **Go to Console tab**
5. **Paste this entire code:**

```javascript
console.clear();
console.log('🧪 TESTING PIPELINE AUTO-SORTING\n');

// Test 1: Authentication
console.log('═══════════════════════════════════');
console.log('TEST 1: Authentication');
console.log('═══════════════════════════════════');
const hasAuthCookie = document.cookie.includes('fb-auth-user');
console.log('Has auth cookie:', hasAuthCookie ? '✅ YES' : '❌ NO');

if (!hasAuthCookie) {
  console.error('\n❌ STOP: You need to log in first!\n');
} else {
  console.log('✅ Authenticated\n');
  
  // Test 2: Pipeline Settings
  console.log('═══════════════════════════════════');
  console.log('TEST 2: Pipeline Settings');
  console.log('═══════════════════════════════════');
  
  fetch('/api/pipeline/settings')
    .then(async r => {
      console.log('API Status:', r.status);
      const data = await r.json();
      
      if (r.status === 200 && data.settings?.global_analysis_prompt) {
        console.log('✅ Global prompt configured');
        console.log('   Length:', data.settings.global_analysis_prompt.length, 'chars');
      } else if (r.status === 404 || !data.settings) {
        console.error('❌ NO SETTINGS CONFIGURED');
        console.log('\n📝 TO FIX:');
        console.log('   1. Go to Pipeline page');
        console.log('   2. Click Settings');
        console.log('   3. Add global analysis prompt');
        console.log('   4. Save\n');
      }
      
      // Test 3: Pipeline Stages
      console.log('\n═══════════════════════════════════');
      console.log('TEST 3: Pipeline Stages');
      console.log('═══════════════════════════════════');
      
      return fetch('/api/pipeline/stages');
    })
    .then(async r => {
      console.log('API Status:', r.status);
      const data = await r.json();
      const stages = data.stages || [];
      
      console.log('Number of stages:', stages.length);
      
      if (stages.length === 0) {
        console.error('❌ NO STAGES FOUND');
        console.log('\n📝 TO FIX:');
        console.log('   1. Go to Pipeline page');
        console.log('   2. Click "Create Stage"');
        console.log('   3. Create at least 2-3 stages');
        console.log('   4. Add analysis_prompt to each\n');
        return;
      }
      
      console.log('✅', stages.length, 'stages found\n');
      
      // Check each stage
      stages.forEach((stage, i) => {
        console.log(`Stage ${i + 1}: ${stage.name}`);
        console.log('  - Has prompt:', stage.analysis_prompt ? '✅ YES' : '❌ NO');
        console.log('  - Is active:', stage.is_active ? '✅ YES' : '❌ NO');
        console.log('  - Is default:', stage.is_default ? '✅ YES' : '⚪ NO');
      });
      
      const stagesWithPrompts = stages.filter(s => s.analysis_prompt?.length > 0);
      const activeStages = stages.filter(s => s.is_active);
      const defaultStage = stages.find(s => s.is_default);
      
      console.log('\n📊 Summary:');
      console.log('  Active stages:', activeStages.length);
      console.log('  With prompts:', stagesWithPrompts.length);
      console.log('  Default stage:', defaultStage ? defaultStage.name : '❌ NONE');
      
      if (stagesWithPrompts.length < 2) {
        console.error('\n❌ NEED AT LEAST 2 STAGES WITH PROMPTS');
        console.log('\n📝 TO FIX:');
        console.log('   1. Go to Pipeline page');
        console.log('   2. Edit each stage');
        console.log('   3. Add analysis_prompt');
        console.log('   4. Save\n');
      } else {
        console.log('\n✅ Configuration looks good!');
      }
      
      // Final Summary
      console.log('\n═══════════════════════════════════');
      console.log('TEST SUMMARY');
      console.log('═══════════════════════════════════');
      
      const allGood = hasAuthCookie && 
                      stagesWithPrompts.length >= 2 && 
                      defaultStage;
      
      if (allGood) {
        console.log('✅ ALL CHECKS PASSED!');
        console.log('\n🎯 READY TO TEST:');
        console.log('   1. Select 1-2 contacts in Conversations page');
        console.log('   2. Click "Add to Pipeline"');
        console.log('   3. Watch for toast notification');
        console.log('   4. Check console for analysis logs');
        console.log('   5. Go to Pipeline page to verify sorting\n');
      } else {
        console.error('❌ CONFIGURATION INCOMPLETE');
        console.log('\n📋 CHECKLIST:');
        console.log('   [' + (hasAuthCookie ? '✅' : '❌') + '] Authenticated');
        console.log('   [' + (stagesWithPrompts.length >= 2 ? '✅' : '❌') + '] At least 2 stages with prompts');
        console.log('   [' + (defaultStage ? '✅' : '❌') + '] Default stage exists');
        console.log('\n   Complete the checklist, then try again.\n');
      }
    })
    .catch(e => {
      console.error('❌ TEST FAILED:', e.message);
      console.log('\nPossible issues:');
      console.log('- Not logged in');
      console.log('- Database tables missing');
      console.log('- API endpoints not working\n');
    });
}
```

---

## Step 4: Interpret Results

### ✅ **PASS - All Good:**

```
✅ ALL CHECKS PASSED!

🎯 READY TO TEST:
   1. Select 1-2 contacts in Conversations page
   2. Click "Add to Pipeline"
   3. Watch for toast notification
   4. Check console for analysis logs
   5. Go to Pipeline page to verify sorting
```

**→ Proceed to Step 5!**

---

### ❌ **FAIL - Missing Config:**

```
❌ CONFIGURATION INCOMPLETE

📋 CHECKLIST:
   [❌] Authenticated
   [❌] At least 2 stages with prompts
   [❌] Default stage exists
```

**→ Fix the issues shown, then run test again**

---

## Step 5: Test the Actual Sorting

Once Step 3 shows **ALL CHECKS PASSED**:

1. **Stay on Conversations page**
2. **Keep Console open** (F12)
3. **Select 1 contact** (checkbox)
4. **Click "Add to Pipeline"** button
5. **Watch the console**

---

## Step 6: What to Look For

### ✅ **SUCCESS - Auto-Sorting Works:**

**Console shows:**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 1 new contacts
[Pipeline Analyze] ✅ Analyzed John Doe: Agreed, confidence: 0.85
[Pipeline Bulk API] ✅ AI analysis completed: 1 contacts analyzed
```

**Toast shows:**
```
✨ Added & Sorted!
1 contact added and automatically sorted to appropriate stages!
```

**In Pipeline page:**
- Contact is in appropriate stage (not "Unmatched")
- Shows AI confidence score
- Click contact to see reasoning

**→ SUCCESS! 🎉**

---

### ⚠️ **PARTIAL - No Config:**

**Console shows:**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 1 new contacts
[Pipeline Analyze] No global analysis prompt configured
[Pipeline Bulk API] AI analysis failed or not configured
```

**Toast shows:**
```
Added to Pipeline
1 contact added. Set up pipeline settings to enable automatic stage sorting.
```

**Fix:**
1. Go to Pipeline → Settings
2. Add global analysis prompt
3. Try again

---

### ⚠️ **PARTIAL - Disagreement:**

**Console shows:**
```
[Pipeline Analyze] ✅ Analyzed John Doe: Disagreed, confidence: 0
```

**This is normal!** It means:
- AI wasn't confident about the match
- Contact went to "Unmatched" for manual review
- Review your stage prompts (might be too strict)

---

## Step 7: Verify in Database (Optional)

Run in **Supabase SQL Editor**:

```sql
-- Check the most recent opportunities
SELECT 
  po.sender_name,
  ps.name as stage_name,
  po.ai_confidence_score,
  po.both_prompts_agreed,
  po.ai_analyzed_at,
  po.created_at
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
ORDER BY po.created_at DESC
LIMIT 5;
```

**Should show:**
- Recent contact added
- Stage name (not just "Unmatched" if auto-sorting worked)
- `ai_confidence_score` > 0
- `both_prompts_agreed` = true
- `ai_analyzed_at` timestamp

---

## 🐛 Common Issues & Fixes

### Issue 1: "Module not found: src/lib/pipeline/analyze"

**Cause:** New file not recognized  
**Fix:**
```bash
# Restart dev server
# Press Ctrl+C
npm run dev
```

---

### Issue 2: All contacts go to "Unmatched"

**Cause:** Prompts are too strict or don't match  
**Fix:**
1. Check Stage prompts are not overly specific
2. Make criteria more general
3. Add more example keywords
4. Test with simpler prompts

---

### Issue 3: OpenAI Error

**Console shows:** `Error: OpenAI API key invalid`  
**Fix:**
1. Check `.env.local` has correct key
2. Key should start with `sk-`
3. Verify on OpenAI dashboard
4. Restart server

---

### Issue 4: No logs appear

**Cause:** Not looking at server console  
**Fix:**
- Check your **terminal** where `npm run dev` is running
- That's where `[Pipeline Bulk API]` logs appear
- Browser console shows different logs

---

## 📊 Expected Timeline

- **Configuration:** 5-10 minutes (one-time)
- **Running test:** 1 minute
- **Testing sorting:** 30 seconds per contact
- **Verification:** 1 minute

**Total first time:** ~15 minutes  
**After configured:** ~2 minutes per test

---

## ✅ Success Criteria

Auto-sorting is working when:

1. ✅ All Step 3 checks pass
2. ✅ Console shows analysis logs
3. ✅ Toast says "Added & Sorted!"
4. ✅ Contacts appear in appropriate stages
5. ✅ AI confidence scores visible
6. ✅ Can see AI reasoning

---

## 🎯 Next Steps After Success

1. **Test with different conversation types**
2. **Review AI reasoning for accuracy**
3. **Adjust prompts based on results**
4. **Scale up to multiple contacts**
5. **Monitor "Unmatched" stage weekly**

---

## 🆘 If Test Fails

**Share this info:**

1. **Output from Step 3** (browser console)
2. **Output from Step 5** (server console)
3. **Toast notification** text
4. **OpenAI key status** (present/missing, not the actual key)

---

## 📝 Quick Reference

**Files created:**
- `src/lib/pipeline/analyze.ts` ← New analysis function
- Modified: `src/app/api/pipeline/opportunities/bulk/route.ts`

**What to configure:**
- OpenAI API key in `.env.local`
- Global analysis prompt in Pipeline Settings
- Stage analysis prompts for each stage

**Where to look:**
- Browser console: Frontend logs, API calls
- Server console: Analysis logs, errors
- Toast notifications: User feedback
- Pipeline page: Results verification

---

**🎊 Ready to test? Run Step 3 in your browser console!**

