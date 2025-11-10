# 🚨 QUICK FIX: All Contacts in Default Stage

## Problem
You added contacts to pipeline but they all went to the default/unmatched stage instead of being sorted.

---

## ✅ 3-Step Fix (5 Minutes)

### Step 1: Check What Happened

**Look at your server console** (terminal where `npm run dev` is running).

Find logs from when you added contacts. Look for:

#### ✅ **Good (AI Ran):**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] 🚀 Loaded 9 Gemini API key(s)
[Pipeline Analyze] ✅ Analyzed Contact: Agreed, confidence: 0.85
```

#### ❌ **Bad (Settings Missing):**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] No global analysis prompt configured
[Pipeline Bulk API] AI analysis failed or not configured: Pipeline settings not configured
```

#### ⚠️ **Warning (Quota Issue):**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] Error: You exceeded your current quota
```

---

### Step 2: Apply the Right Fix

#### **If you see: "No global analysis prompt configured"**

**This is the issue!** Fix it:

1. **Go to Pipeline page** in your app
2. Look for **"Settings"** button (top right)
3. **Add this global prompt:**

```
Analyze this contact's conversation to determine which pipeline stage they should be in.

Consider these factors:
- Interest level: How engaged are they with your business?
- Purchase intent: Have they shown signals they want to buy?
- Conversation maturity: Is this their first message or an ongoing discussion?
- Urgency: Did they mention any timeline or deadline?

Based on their conversation history, recommend the most appropriate stage.
```

4. **Click Save**
5. **Try adding contacts again**

**That should fix it!**

---

#### **If you see: "quota exceeded"**

**This is expected** - your Gemini API hit the daily limit.

**Quick fixes:**

**Option 1: Wait for Reset (Recommended)**
- Quota resets in ~24 hours
- Then auto-sorting will work automatically
- No action needed now

**Option 2: Manually Sort for Now**
- Contacts are in pipeline (just not sorted)
- Drag them to appropriate stages
- Once quota resets, new contacts will auto-sort

**Option 3: Check Other Keys**
Wait a few hours and try again - with 9 keys rotating, one might reset sooner.

---

#### **If you see: "Analyzed... Disagreed, confidence: 0"**

**This means:**
- AI analysis ran
- Global AI recommended a stage
- Stage-specific AI said "doesn't meet criteria"
- Contact moved to default for manual review

**This is working as designed** - AI is being cautious!

**To reduce "disagreed" contacts:**
1. Make stage prompts less strict
2. Add more example keywords
3. Make criteria more general

---

### Step 3: Test Again

1. **Go to Conversations** page
2. **Select 1 new contact**
3. **Click "Add to Pipeline"**
4. **Watch server console** for logs
5. **Check Pipeline page** - should be sorted now!

---

## 🎯 Most Common Issue (90% of cases)

**Problem:** Pipeline settings not configured

**Symptoms:**
- Server logs say "No global analysis prompt configured"
- Toast says "Set up pipeline settings"
- All contacts in default stage

**Fix:** Add global analysis prompt (see Step 2 above)

**Time to fix:** 2 minutes

---

## 🔧 Configuration Checklist

To make auto-sorting work, you need:

### Required:
- [x] Gemini API keys (you have 9 ✅)
- [ ] **Pipeline settings configured** ← Usually missing!
- [ ] **Global analysis prompt added** ← This is key!
- [ ] At least 2 stages created
- [ ] Each stage has analysis_prompt

### How to Check in App:

1. **Go to Pipeline page**
2. **Look for Settings button**
3. **If no settings page exists**, you need to create it
4. **Check each stage** - click edit and verify analysis_prompt is filled

---

## 📋 Example Configuration

### Global Analysis Prompt (Required):

```
You are analyzing sales conversations to determine pipeline stages.

Look at the conversation and determine:
1. Is this a new contact just browsing? → New Lead
2. Have they shown interest in specific products? → Qualified
3. Are they discussing pricing or ready to buy? → Hot Lead

Consider the conversation content and recommend the best stage.
```

### Stage Prompts (Required for each stage):

**New Lead:**
```
This is a "New Lead" if:
- First or second message
- General questions
- No buying signals yet

Keywords: "info", "what", "tell me", "curious"
```

**Qualified:**
```
This is "Qualified" if:
- Interested in specific products
- Asked about features or pricing
- Discussed needs

Keywords: "price", "interested", "need", "cost"
```

**Hot Lead:**
```
This is a "Hot Lead" if:
- Ready to buy
- Discussing payment or delivery
- Asked for quote

Keywords: "buy", "purchase", "quote", "order"
```

---

## 🧪 Verify Configuration

Run in **browser console** (F12):

```javascript
// Test 1: Check settings
fetch('/api/pipeline/settings')
  .then(r => r.json())
  .then(d => {
    if (d.settings?.global_analysis_prompt) {
      console.log('✅ Settings configured!');
      console.log('Prompt length:', d.settings.global_analysis_prompt.length);
    } else {
      console.log('❌ Settings missing - ADD GLOBAL PROMPT!');
    }
  });

// Test 2: Check stages
fetch('/api/pipeline/stages')
  .then(r => r.json())
  .then(d => {
    const stages = d.stages || [];
    const withPrompts = stages.filter(s => s.analysis_prompt);
    console.log(`Stages: ${withPrompts.length}/${stages.length} have prompts`);
    
    if (withPrompts.length < 2) {
      console.log('❌ Need at least 2 stages with prompts!');
    } else {
      console.log('✅ Stages configured!');
    }
  });
```

**Should show:**
```
✅ Settings configured!
✅ Stages configured!
```

---

## 🎉 After Fix

Once configured, when you add contacts:

**Server logs:**
```
[Pipeline Bulk API] Triggering automatic AI analysis
[Pipeline Analyze] 🚀 Loaded 9 Gemini API key(s)
[Pipeline Analyze] ✅ Analyzed: Agreed, confidence: 0.85
```

**Toast:**
```
✨ Added & Sorted!
Contacts automatically sorted to appropriate stages!
```

**Pipeline page:**
- Contacts in different stages
- Not all in default
- Shows confidence scores

---

## 🆘 Still Need Help?

### What to Share:

1. **Server console logs** from when you added contacts
2. **Result from configuration check** (browser console test above)
3. **Toast message** you received
4. **Did you add the global analysis prompt?** Yes/No

### Common Answers:

**"I don't see a Settings button"**
- Need to add pipeline settings page/dialog
- Or directly insert into database

**"All my stages have prompts"**
- Check if prompts are too strict
- Try making them more general

**"API quota exceeded"**
- Wait 24 hours for reset
- Normal for free tier

---

## 💡 Quick Summary

**Issue:** All contacts in default stage  
**Most likely cause:** Pipeline settings not configured (95% of cases)  
**Quick fix:** Add global analysis prompt (2 minutes)  
**Test:** Add 1 contact and verify it sorts correctly

---

**Start with Step 1 to identify your specific issue!**

