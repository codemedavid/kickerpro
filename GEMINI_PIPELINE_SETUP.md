# ✅ Pipeline Auto-Sorting with Gemini AI

## 🎉 Updated to Use Google Gemini!

The pipeline auto-sorting now uses **Google Gemini AI** (same as your other AI features) instead of OpenAI.

---

## ⚙️ Setup (One-Time)

### Step 1: Verify Gemini API Key

Check your `.env.local` file:

```bash
# In terminal:
grep GOOGLE_AI_API_KEY .env.local
```

**Expected:** `GOOGLE_AI_API_KEY=AIza...`

**If missing:** Add your Google AI API key:

```env
GOOGLE_AI_API_KEY=your-gemini-api-key-here
```

Then **restart your dev server:**
```bash
# Press Ctrl+C
npm run dev
```

---

### Step 2: Configure Pipeline Settings

1. **Go to Pipeline page** in your app
2. **Click Settings** (or configure button)
3. **Add Global Analysis Prompt:**

```
Analyze this contact's conversation to determine their pipeline stage.

Consider:
- Interest level (browsing vs serious inquiry)
- Purchase intent (questions vs commitment) 
- Conversation stage (first contact vs ongoing)
- Urgency (casual vs time-sensitive)

Recommend the most appropriate stage based on these factors.
```

4. **Save settings**

---

### Step 3: Create Pipeline Stages

Create at least 2-3 stages with analysis prompts:

**Example: New Lead Stage**
```
Name: New Lead
Description: Early exploration stage

Analysis Prompt:
This contact is a "New Lead" if:
- First or second message exchange
- Asking general questions about products/services
- No clear buying intent yet
- Just exploring options

Keywords: "info", "curious", "tell me more", "what do you"
```

**Example: Qualified Stage**
```
Name: Qualified
Description: Showing clear interest

Analysis Prompt:
This contact is "Qualified" if:
- Expressed clear interest in specific products
- Asked about features, pricing, or availability
- Discussed their specific needs
- Comparing options

Keywords: "interested", "need", "price", "cost", "how much"
```

**Example: Hot Lead Stage**
```
Name: Hot Lead
Description: Ready to purchase

Analysis Prompt:
This contact is a "Hot Lead" if:
- Discussing price, terms, or payment
- Requested a quote or proposal
- Expressed intent to purchase
- Mentioned timeline for buying

Keywords: "buy", "purchase", "quote", "deal", "discount", "ready"
```

---

## 🧪 Quick Test

### 1. Browser Console Test

Open Conversations page → Press **F12** → Paste:

```javascript
console.clear();
console.log('🧪 Gemini Pipeline Test\n');

// Check auth
const auth = document.cookie.includes('fb-auth-user');
console.log('1. Auth:', auth ? '✅ YES' : '❌ LOG IN');

// Check settings
fetch('/api/pipeline/settings')
  .then(r => r.json())
  .then(d => console.log('2. Global Prompt:', d.settings?.global_analysis_prompt ? '✅ CONFIGURED' : '❌ MISSING'))
  .catch(() => console.log('2. Settings: ❌ ERROR'));

// Check stages
fetch('/api/pipeline/stages')
  .then(r => r.json())
  .then(d => {
    const stages = (d.stages || []).filter(s => s.analysis_prompt);
    console.log('3. Stages:', stages.length >= 2 ? `✅ ${stages.length} ready` : `❌ NEED ${2-stages.length} MORE`);
  });
```

### 2. Test Auto-Sorting

If test shows all ✅:
1. **Select 1-2 contacts** in Conversations
2. **Click "Add to Pipeline"**
3. **Watch for toast** notification
4. **Check Pipeline page** for results

---

## 📊 What You'll See

### ✅ **Success:**

**Toast Notification:**
```
✨ Added & Sorted!
2 contacts added and automatically sorted to appropriate stages!
```

**Server Console:**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] ✅ Analyzed John Doe: Agreed, confidence: 0.85
[Pipeline Analyze] ✅ Analyzed Jane Smith: Agreed, confidence: 0.92
[Pipeline Bulk API] ✅ AI analysis completed: 2 contacts analyzed
```

**In Pipeline:**
- Contacts in different stages (not all "Unmatched")
- Shows AI confidence scores
- Click contact to see AI reasoning

---

### ⚠️ **Not Configured:**

**Toast:**
```
Added to Pipeline
Set up pipeline settings to enable automatic stage sorting.
```

**Fix:** Complete Step 2 above (add global prompt)

---

## 🆚 Gemini vs OpenAI

**Why Gemini is Better for This:**

| Feature | Gemini | OpenAI |
|---------|--------|--------|
| **Cost** | FREE (with limits) | Paid ($) |
| **Speed** | Very fast | Fast |
| **JSON Mode** | Native support | Supported |
| **Rate Limits** | 15 req/min | Varies |
| **Integration** | Already in project | Would need adding |

**You're already using Gemini** for AI message generation, so this keeps everything consistent!

---

## 🔧 Configuration Options

### Using Multiple Gemini Keys (Optional)

For higher rate limits, add more keys:

```env
GOOGLE_AI_API_KEY=your-key-1
GOOGLE_AI_API_KEY_2=your-key-2
GOOGLE_AI_API_KEY_3=your-key-3
```

**Benefits:**
- 15 requests/min per key
- With 3 keys = 45 requests/min
- Automatic key rotation

---

## 🐛 Troubleshooting

### Issue: "GOOGLE_AI_API_KEY not configured"

**Console shows:** `Error: GOOGLE_AI_API_KEY not configured`

**Fix:**
1. Check `.env.local` has `GOOGLE_AI_API_KEY`
2. Verify key starts with `AIza`
3. Restart dev server
4. Try again

---

### Issue: All contacts go to "Unmatched"

**Console shows:** `Disagreed, confidence: 0`

**This means:**
- Global analysis recommended one stage
- Stage-specific analysis disagreed
- Contact moved to Unmatched for manual review

**Fix:**
- Make stage prompts less strict
- Add more example keywords
- Make criteria more general

---

### Issue: Gemini API Error

**Console shows:** `Gemini API error: ...`

**Common causes:**
- Invalid API key
- Rate limit exceeded
- Network issues

**Fix:**
1. Verify API key on Google AI Studio
2. Check you haven't exceeded free tier limits
3. Wait a minute and try again
4. Add more API keys for rotation

---

## 📈 Performance

With Gemini:
- **Speed:** 2-3 seconds per contact
- **Cost:** FREE (within limits)
- **Accuracy:** Similar to OpenAI
- **Rate Limit:** 15 requests/min per key

**Gemini Free Tier:**
- 15 requests per minute
- 1,500 requests per day
- 1 million tokens per day

**For most users:** Free tier is plenty!

---

## 🎯 Model Used

**Gemini 2.0 Flash Experimental**
- Fast responses (< 3 seconds)
- Good at following instructions
- Native JSON output
- Cost-effective
- Handles pipeline analysis well

---

## ✅ Verification

Run in Supabase SQL Editor to verify it worked:

```sql
-- Check recent pipeline additions
SELECT 
  po.sender_name,
  ps.name as stage_name,
  po.ai_confidence_score,
  po.both_prompts_agreed,
  po.created_at
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
ORDER BY po.created_at DESC
LIMIT 5;
```

**Should show:**
- Recent contacts
- Assigned to appropriate stages
- `ai_confidence_score` > 0
- `both_prompts_agreed` = true (for well-matched)

---

## 📝 Summary

**What Changed:**
- ❌ Removed: OpenAI dependency
- ✅ Added: Gemini AI (Google)
- ✅ Same API as other features
- ✅ Free tier available

**What You Need:**
- ✅ `GOOGLE_AI_API_KEY` in `.env.local`
- ✅ Global analysis prompt configured
- ✅ Stages created with analysis prompts

**What You Get:**
- ✅ Automatic stage sorting
- ✅ AI-powered analysis
- ✅ FREE (within limits)
- ✅ Fast and accurate

---

## 🚀 Get Started

1. **Verify Gemini key** in `.env.local`
2. **Restart dev server**
3. **Configure pipeline settings**
4. **Create stages with prompts**
5. **Test with 1 contact**
6. **Check results in Pipeline page**

---

## 🎉 Benefits

**Using Gemini means:**
- ✨ No additional API costs
- ✨ Consistent with other AI features
- ✨ Fast and reliable
- ✨ Free tier is generous
- ✨ Easy to scale with multiple keys

**Enjoy automatic pipeline sorting with Gemini AI!** 🚀

