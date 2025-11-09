# 🔧 Pipeline Auto-Sorting Setup & Testing Guide

## ✅ What Was Fixed

The automatic pipeline stage sorting now uses a **direct function call** instead of an internal HTTP request, making it more reliable and eliminating authentication issues.

---

## 📋 Prerequisites Checklist

Before auto-sorting will work, you need:

### 1. ✅ Database Tables

Run this in Supabase SQL Editor if you haven't already:

```sql
-- Check if pipeline_settings table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'pipeline_settings'
);
```

If it returns `false`, run the pipeline setup SQL (check files like `add-pipeline-complete.sql`).

### 2. ✅ OpenAI API Key

In your `.env.local`:
```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Verify it's set:**
```bash
# In terminal:
echo $OPENAI_API_KEY  # Should show your key
```

### 3. ✅ Pipeline Stages Created

You need at least 2-3 stages with analysis prompts:
- Go to Pipeline page
- Create stages (e.g., "New Lead", "Qualified", "Negotiating")
- **Each stage needs an analysis_prompt**

### 4. ✅ Global Analysis Prompt Configured

- Go to Pipeline Settings
- Add a global analysis prompt (see examples below)

---

## 🧪 Testing Steps

### Step 1: Check Your Setup

1. **Open browser DevTools Console** (F12)
2. **Go to Conversations page**
3. **Look for logs** - you should see:
   ```
   [Conversations] User: { id: "user_..." }
   [Conversations] Query enabled: true
   ```

### Step 2: Select Test Contacts

1. **Select 1-2 contacts** with different conversation types
2. **Click "Add to Pipeline"**

### Step 3: Watch Console Logs

You should see:
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] ✅ Analyzed Contact Name: Agreed, confidence: 0.85
[Pipeline Bulk API] ✅ AI analysis completed: 2 contacts analyzed
```

###Step 4: Check Pipeline Page

1. **Go to Pipeline page**
2. **Contacts should be in different stages** (not all in "Unmatched")
3. **Click on a contact** to see AI reasoning

---

## 📊 What You'll See

### ✅ Success Case:

**Toast Notification:**
```
✨ Added & Sorted!
2 contacts added and automatically sorted to appropriate stages!
```

**In Pipeline:**
- Contact 1 → "New Lead" stage
- Contact 2 → "Qualified" stage
- Each shows AI confidence score

### ⚠️ No Configuration Case:

**Toast Notification:**
```
Added to Pipeline
2 contacts added to pipeline. 
Set up pipeline settings to enable automatic stage sorting.
```

**In Pipeline:**
- All contacts → "Unmatched" stage
- Need to configure settings

---

## 🎯 Example Configuration

### Global Analysis Prompt:

```
You are analyzing sales leads to determine their pipeline stage.

Consider these factors:
1. Interest Level - How engaged is the contact?
2. Purchase Intent - Have they shown buying signals?
3. Conversation Stage - First contact or ongoing discussion?
4. Urgency - Any deadlines or timeline mentioned?

Analyze the conversation history and recommend the most appropriate stage.
Be confident in your recommendation but flag unclear cases.
```

### Stage Analysis Prompts:

**New Lead:**
```
This contact is a "New Lead" if:
- First or second message exchange
- Asking general questions about products/services
- No clear buying intent yet
- Just exploring options or gathering information
- No pricing or timeline discussions

Keywords: "info", "curious", "tell me more", "what do you offer"
```

**Qualified:**
```
This contact is "Qualified" if:
- Expressed clear interest in specific products/services
- Asked about features, availability, or specifications
- Discussed their specific needs or use case
- May have asked about pricing
- Comparing options or gathering detailed information

Keywords: "interested in", "need", "looking for", "price", "cost", "how much"
```

**Negotiating:**
```
This contact is "Negotiating" if:
- Actively discussing price, terms, or payment options
- Requested a formal quote or proposal
- Expressed intent to purchase or move forward
- Working through final details or objections
- Mentioned a specific purchase timeline

Keywords: "discount", "deal", "quote", "when can", "ready to buy", "payment terms"
```

---

## 🐛 Troubleshooting

### Issue 1: Still Going to "Unmatched"

**Check Console:**
```
[Pipeline Bulk API] No pipeline settings configured, skipping AI analysis
```

**Solution:**
- Go to Pipeline Settings
- Add global analysis prompt
- Click Save
- Try again

---

### Issue 2: "Pipeline settings not configured" Error

**Verify in Supabase:**
```sql
SELECT * FROM pipeline_settings WHERE user_id = 'your-user-id';
```

**If empty:**
- Go to Pipeline page → Settings
- Create global analysis prompt
- Save

---

### Issue 3: OpenAI API Error

**Check Console:**
```
[Pipeline Analyze] Error: OpenAI API key invalid
```

**Solution:**
1. Verify API key in `.env.local`
2. Check key is valid on OpenAI dashboard
3. Restart dev server
4. Try again

---

### Issue 4: All AI Responses Disagree

**Check Console:**
```
[Pipeline Analyze] ✅ Analyzed Contact: Disagreed, confidence: 0
```

**This means:**
- Global analysis recommended one stage
- Stage-specific analysis said "doesn't meet criteria"
- Contact moved to "Unmatched" for manual review

**Solution:**
- Review your prompts - they might be too strict
- Make stage criteria more general
- Add more example keywords
- Test with simpler criteria first

---

### Issue 5: Timeout or Slow Performance

**Symptoms:**
- Takes > 30 seconds
- Request times out
- No response

**Causes:**
- Too many contacts at once (> 10)
- OpenAI API rate limits
- Network issues

**Solution:**
- Add contacts in smaller batches (5 at a time)
- Wait between batches
- Check OpenAI API status

---

## 🔍 Debug Console Commands

### Check if User is Authenticated:
```javascript
// In browser console
console.log(document.cookie.includes('fb-auth-user'));
```

### Check Pipeline Settings:
```sql
-- In Supabase SQL Editor
SELECT 
  ps.id,
  ps.user_id,
  LENGTH(ps.global_analysis_prompt) as prompt_length,
  ps.auto_analyze,
  ps.created_at
FROM pipeline_settings ps
WHERE user_id = 'your-user-id';
```

### Check Pipeline Stages:
```sql
-- In Supabase SQL Editor
SELECT 
  id,
  name,
  description,
  is_default,
  is_active,
  LENGTH(analysis_prompt) as prompt_length,
  position
FROM pipeline_stages
WHERE user_id = 'your-user-id'
ORDER BY position;
```

### Check Opportunities:
```sql
-- In Supabase SQL Editor
SELECT 
  po.id,
  po.sender_name,
  ps.name as stage_name,
  po.ai_confidence_score,
  po.both_prompts_agreed,
  po.ai_analyzed_at
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'your-user-id'
ORDER BY po.created_at DESC
LIMIT 10;
```

---

## 📈 Success Metrics

After proper configuration, you should see:

| Metric | Target | Actual |
|--------|--------|--------|
| Contacts auto-sorted | 80-90% | ? |
| In "Unmatched" | 10-20% | ? |
| AI confidence > 0.7 | 70%+ | ? |
| Processing time | < 5s per contact | ? |

---

## 🎓 Understanding the Logs

### Good Logs (Success):
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] ✅ Analyzed John Doe: Agreed, confidence: 0.85
[Pipeline Analyze] ✅ Analyzed Jane Smith: Agreed, confidence: 0.92
[Pipeline Bulk API] ✅ AI analysis completed: 2 contacts analyzed
```

### Warning Logs (Partial Success):
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] ✅ Analyzed John Doe: Disagreed, confidence: 0
[Pipeline Analyze] ✅ Analyzed Jane Smith: Agreed, confidence: 0.88
[Pipeline Bulk API] ✅ AI analysis completed: 2 contacts analyzed
```
*One contact went to Unmatched (disagreement), one sorted correctly*

### Error Logs (Failure):
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] No global analysis prompt configured
[Pipeline Bulk API] AI analysis failed or not configured: Pipeline settings not configured
[Pipeline Bulk API] Contacts added to Unmatched stage
```
*Need to configure settings*

---

## 🔄 Quick Test Script

Run this in browser console on Conversations page:

```javascript
// 1. Check auth
console.log('Auth cookie:', document.cookie.includes('fb-auth-user'));

// 2. Test fetch to tags API (should work if auth is good)
fetch('/api/tags')
  .then(r => r.json())
  .then(d => console.log('Tags loaded:', d.tags?.length || 0))
  .catch(e => console.error('Tags error:', e));

// 3. Check pipeline settings
fetch('/api/pipeline/settings')
  .then(r => r.json())
  .then(d => console.log('Pipeline settings:', d))
  .catch(e => console.error('Settings error:', e));
```

---

## ✅ Verification Checklist

Before testing, verify:

- [ ] OpenAI API key in `.env.local`
- [ ] Dev server restarted after adding API key
- [ ] Pipeline stages created (at least 2-3)
- [ ] Each stage has an analysis_prompt
- [ ] Global analysis prompt configured
- [ ] At least one stage marked as `is_default: true`
- [ ] Logged into the app
- [ ] Can see conversations in Conversations page

---

## 🚀 Next Steps

1. **Complete the checklist** above
2. **Test with 1 contact** first
3. **Check the logs** in console
4. **Verify it worked** in Pipeline page
5. **Adjust prompts** if needed
6. **Scale up** to multiple contacts

---

## 📝 Notes

- Analysis uses `gpt-4o-mini` model (cost-effective)
- Each contact analyzed individually
- Approximately $0.01-0.02 per 100 contacts
- Analysis takes 2-5 seconds per contact
- Results are cached in database

---

## 🆘 Still Having Issues?

**Check these files:**
1. `src/lib/pipeline/analyze.ts` - Analysis logic
2. `src/app/api/pipeline/opportunities/bulk/route.ts` - Bulk add logic
3. Browser DevTools Console - For error messages
4. Supabase Logs - For database errors

**Common fixes:**
- Restart dev server
- Clear browser cache
- Check Supabase is running
- Verify all environment variables
- Check OpenAI API usage limits

---

**🎉 Once working, enjoy automatic pipeline sorting!**

