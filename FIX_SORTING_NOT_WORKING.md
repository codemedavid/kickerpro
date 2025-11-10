# 🔧 Fix: Pipeline Sorting Not Working - All Contacts in Default Stage

## ❌ Problem

All contacts went to the default/unmatched stage instead of being sorted to appropriate stages.

---

## 🔍 Diagnosis

Run this SQL in **Supabase SQL Editor** to find the problem:

```sql
-- Quick diagnosis query
-- Replace 'YOUR_USER_ID' with your actual user ID

-- 1. Check settings
SELECT 
    CASE WHEN COUNT(*) = 0 THEN '❌ NO SETTINGS' ELSE '✅ Settings OK' END as settings_status
FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID';

-- 2. Check stages
SELECT 
    name,
    CASE WHEN analysis_prompt IS NULL THEN '❌ NO PROMPT' ELSE '✅ Has prompt' END as prompt_status
FROM pipeline_stages WHERE user_id = 'YOUR_USER_ID';

-- 3. Check recent contacts
SELECT 
    sender_name,
    CASE WHEN ai_analyzed_at IS NULL THEN '❌ NOT ANALYZED' 
         WHEN both_prompts_agreed = false THEN '⚠️ DISAGREED' 
         ELSE '✅ ANALYZED' END as status
FROM pipeline_opportunities 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC LIMIT 5;
```

Or use the detailed diagnostic file: **`DIAGNOSE_PIPELINE_SORTING.sql`**

---

## 🎯 Most Likely Causes

### 1. **❌ NO SETTINGS CONFIGURED** (Most Common)

**Symptoms:**
- First query shows "❌ NO SETTINGS"
- All contacts in default stage
- No AI analysis ran

**Fix:**
1. Go to **Pipeline** page in your app
2. Click **"Settings"** or **"Configure"**
3. Add **Global Analysis Prompt**:

```
Analyze this contact's conversation to determine their pipeline stage.

Consider:
- Interest level (browsing vs serious inquiry)
- Purchase intent (questions vs ready to buy)
- Conversation stage (first contact vs ongoing)
- Urgency (casual vs time-sensitive)

Recommend the most appropriate stage based on their conversation.
```

4. **Save**
5. Try adding contacts again

---

### 2. **❌ STAGES MISSING ANALYSIS PROMPTS**

**Symptoms:**
- Second query shows stages with "❌ NO PROMPT"
- AI can't determine criteria for each stage

**Fix:**

Edit each stage and add an analysis prompt:

**New Lead Example:**
```
This contact is a "New Lead" if:
- First or second message
- Asking general questions about products
- No clear buying intent yet
- Just exploring options

Keywords: "info", "curious", "what", "tell me more"
```

**Qualified Example:**
```
This contact is "Qualified" if:
- Expressed clear interest in specific products
- Asked about pricing, features, or availability
- Discussed their needs or use case
- Comparing options

Keywords: "price", "cost", "interested", "need", "how much"
```

**Save each stage** after adding prompts.

---

### 3. **⚠️ API QUOTA EXCEEDED**

**Symptoms:**
- Third query shows "❌ NOT ANALYZED"
- Server console shows rate limit errors
- Test showed quota exceeded

**Current Status:**
Your Gemini API keys hit the daily free tier limit. This will **automatically reset in ~24 hours**.

**What happens:**
- Contacts added to pipeline ✅
- AI analysis tries to run
- All 9 keys hit rate limit ❌
- Contacts stay in default stage
- Will work automatically once quota resets

**Temporary solution:**
Wait for quota reset, then:
1. Go to Pipeline page
2. Select contacts in default stage
3. Click "Analyze with AI" (if available)
4. Or they'll auto-analyze when you add new contacts

**Long-term solution:**
- Gemini free tier: 1,500 requests/day per key
- You have 9 keys = ~13,500 requests/day
- Should be plenty once reset
- If still not enough, consider paid tier

---

### 4. **⚠️ AI PROMPTS DISAGREED**

**Symptoms:**
- Third query shows "⚠️ DISAGREED"
- `both_prompts_agreed = false`
- Contacts moved to default for manual review

**This is actually WORKING as designed!**

When this happens:
- Global AI recommended one stage
- Stage-specific AI said "doesn't meet criteria"
- System flagged contact for manual review
- **Better than wrong assignment**

**Why it happens:**
- Stage prompts too strict
- Criteria too specific
- Not enough keywords

**Fix:**
Make stage prompts less strict:

**❌ Too strict:**
```
Must have:
- Asked about bulk pricing
- Mentioned specific quantity over 50 units
- Discussed delivery timeline
- Shown budget approval
```

**✅ Better:**
```
Shows interest in purchasing:
- Asked about pricing OR quantities
- Discussed delivery OR payment
- Any purchase-related questions

Keywords: "price", "buy", "order", "quantity", "delivery"
```

---

## 🚀 Quick Fix Steps

### **If Settings Missing:**

1. **Open your app**
2. **Go to Pipeline** page
3. **Click Settings** button
4. **Add global prompt** (see example above)
5. **Save**
6. **Go to Conversations** 
7. **Select 1 test contact**
8. **Click "Add to Pipeline"**
9. **Check result** in Pipeline page

---

### **If Stage Prompts Missing:**

1. **Go to Pipeline** page
2. **Click edit** on first stage
3. **Add analysis_prompt** (see examples above)
4. **Save**
5. **Repeat** for all stages (need at least 2)
6. **Test** with 1 contact

---

### **If API Quota Exceeded:**

**Option A: Wait (Recommended)**
- Quota resets in ~24 hours
- Will work automatically
- No action needed

**Option B: Test Later**
- Add contacts now (they go to default)
- Once quota resets, re-analyze them
- Or new contacts will auto-sort

---

## 🧪 Test After Fix

1. **In browser console** (F12):

```javascript
// Quick test
fetch('/api/pipeline/settings')
  .then(r => r.json())
  .then(d => console.log('Settings:', d.settings ? '✅ OK' : '❌ MISSING'));

fetch('/api/pipeline/stages')
  .then(r => r.json())
  .then(d => {
    const withPrompts = d.stages.filter(s => s.analysis_prompt);
    console.log('Stages with prompts:', withPrompts.length, '/', d.stages.length);
  });
```

2. **Add 1 test contact** to pipeline
3. **Check server console** for logs:
   - Should see: `[Pipeline Analyze] ✅ Analyzed...`
   - Not: `[Pipeline Analyze] No global analysis prompt configured`

4. **Check Pipeline page** - contact should be in appropriate stage

---

## 📊 Expected Results After Fix

### ✅ **When Working:**

**Server Console:**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 1 new contacts
[Pipeline Analyze] 🚀 Loaded 9 Gemini API key(s) for rotation
[Pipeline Analyze] ✅ Analyzed John Doe: Agreed, confidence: 0.85
[Pipeline Bulk API] ✅ AI analysis completed: 1 contacts analyzed
```

**Toast:**
```
✨ Added & Sorted!
1 contact added and automatically sorted to appropriate stages!
```

**Pipeline Page:**
- Contact in appropriate stage (not default)
- Shows confidence score
- Can see AI reasoning

---

### ⚠️ **When Not Fixed:**

**Server Console:**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 1 new contacts
[Pipeline Analyze] No global analysis prompt configured
[Pipeline Bulk API] AI analysis failed or not configured
```

**Toast:**
```
Added to Pipeline
Set up pipeline settings to enable automatic stage sorting.
```

**Pipeline Page:**
- All contacts in default/unmatched stage
- No confidence scores
- No AI reasoning

---

## 📝 Checklist

Complete this checklist:

- [ ] Pipeline settings configured (global prompt added)
- [ ] At least 2 stages created
- [ ] Each stage has analysis_prompt filled
- [ ] One stage marked as default
- [ ] Gemini API keys in .env.local (already done ✅)
- [ ] API quota not exceeded (or waited for reset)
- [ ] Tested with 1 contact
- [ ] Contact sorted to appropriate stage (not default)

**Once all checked → Auto-sorting will work! ✅**

---

## 🆘 Still Not Working?

Run the full diagnostic: **`DIAGNOSE_PIPELINE_SORTING.sql`**

Then share:
1. Output from diagnostic SQL
2. Server console logs when adding contact
3. Toast message received
4. Settings status (configured or not?)

---

## 💡 Pro Tips

### Tip 1: Start Simple
Create just 2-3 stages initially with broad criteria.

### Tip 2: Test Incrementally
Add 1 contact → Check result → Adjust prompts → Repeat

### Tip 3: Review Unmatched
Contacts in default stage show what needs prompt adjustment.

### Tip 4: Check Reasoning
Click contacts in Pipeline to see WHY AI chose that stage.

### Tip 5: Iterate Prompts
Refine based on actual results, not guesses.

---

**📌 Most users fix this in 5 minutes by adding the global analysis prompt!**

