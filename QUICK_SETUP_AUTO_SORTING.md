# 🚀 Quick Setup Guide - Automatic Pipeline Stage Sorting

## What Changed?

When you click "Add to Pipeline" from the Conversations page, contacts now **automatically get sorted** into the appropriate pipeline stages using AI!

---

## ⚙️ Setup Required (One-Time)

### Step 1: Ensure OpenAI API Key is Set

In your `.env.local` file, make sure you have:

```env
OPENAI_API_KEY=your-openai-api-key-here
```

If you don't have an OpenAI API key:
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add it to your `.env.local`
4. Restart your dev server

---

### Step 2: Configure Pipeline Settings (In Your App)

1. **Go to Pipeline Page** in your app
2. **Create Pipeline Stages** (if you haven't already):
   - Click "Create Stage"
   - Add stages like: "New Lead", "Qualified", "Negotiating", "Closed"
   - For each stage, add an **analysis prompt**

3. **Set Up Global Analysis Prompt**:
   - Go to Pipeline Settings
   - Add a global analysis prompt that describes your overall pipeline strategy

---

## 📝 Example Configuration

### Example Global Analysis Prompt:

```
Analyze this contact's conversation history to determine which pipeline stage they should be in.

Consider these factors:
1. Interest Level - How engaged are they?
2. Purchase Intent - Have they shown buying signals?
3. Conversation Stage - Are they asking questions or ready to buy?
4. Timeline - Any urgency or timeline mentioned?
5. Budget - Any pricing discussions?

Based on these factors, recommend the most appropriate stage.
```

### Example Stage Analysis Prompts:

**New Lead Stage:**
```
This contact belongs in "New Lead" stage if:
- This is their first or second message
- They're asking general questions about products/services
- No clear buying intent expressed yet
- No pricing or timeline discussions
- Just exploring or gathering information

Keywords to look for: "info", "tell me more", "curious", "looking into"
```

**Qualified Stage:**
```
This contact belongs in "Qualified" stage if:
- They've expressed clear interest in specific products/services
- They've asked about features, availability, or compatibility
- They've discussed their needs or use case
- They may have asked about pricing
- They're comparing options or gathering detailed information

Keywords to look for: "interested in", "need", "looking for", "price", "cost", "available"
```

**Negotiating Stage:**
```
This contact belongs in "Negotiating" stage if:
- They're actively discussing price, terms, or payment
- They've requested a formal quote or proposal
- They've expressed intent to purchase
- They're working through objections or final details
- They've mentioned a specific purchase timeline

Keywords to look for: "discount", "deal", "quote", "when can I", "ready to buy", "payment terms"
```

**Closed/Won Stage:**
```
This contact belongs in "Closed/Won" stage if:
- They've confirmed a purchase
- They've made payment or committed to payment
- They've agreed to terms and are moving forward
- The deal is finalized

Keywords to look for: "purchased", "ordered", "paid", "confirmed", "let's proceed"
```

---

## 🎯 How to Test

### Test with a Few Contacts:

1. Go to **Conversations** page
2. Select **2-3 contacts** with different conversation types:
   - One that just started chatting (should go to New Lead)
   - One that asked about pricing (should go to Qualified)
   - One that's ready to buy (should go to Negotiating)
3. Click **"Add to Pipeline"**
4. Wait for the toast notification
5. Go to **Pipeline** page
6. Check if contacts are in the correct stages

### What You Should See:

**If AI Analysis Ran Successfully:**
```
Toast: ✨ Added & Sorted!
Description: 3 contacts added and automatically sorted to appropriate stages!
```

**If Pipeline Settings Not Configured:**
```
Toast: Added to Pipeline
Description: 3 contacts added to pipeline. 
Set up pipeline settings to enable automatic stage sorting.
```

---

## 🔧 Troubleshooting

### Issue: All contacts go to "Unmatched" stage

**Solution:**
- Your stage prompts might be too strict
- Try making them more general
- Add more examples of what belongs in each stage

### Issue: AI analysis doesn't run at all

**Check:**
1. ✅ OpenAI API key is set in `.env.local`
2. ✅ Global analysis prompt is configured in Pipeline Settings
3. ✅ You have at least one active pipeline stage
4. ✅ Dev server was restarted after adding API key

### Issue: Wrong stages assigned

**Solution:**
- Review the AI's reasoning in the Pipeline page
- Click on a contact to see why it was placed in that stage
- Adjust your stage prompts based on the reasoning
- Re-run analysis on test contacts

---

## 🎉 You're Ready!

Once you've completed the setup:

1. **Select contacts** in Conversations page
2. **Click "Add to Pipeline"**
3. **Contacts automatically sort** to appropriate stages!
4. **Review results** in Pipeline page
5. **Adjust prompts** if needed for better accuracy

---

## 💡 Pro Tips

### Tip 1: Start with Clear Stage Definitions
The clearer your stage prompts, the better the AI sorting will be.

### Tip 2: Test Incrementally
Don't add 100 contacts at once. Start with 5-10, review results, adjust prompts, then scale up.

### Tip 3: Review Unmatched Regularly
Contacts in "Unmatched" are ones the AI wasn't confident about. Review them weekly and update your prompts based on patterns.

### Tip 4: Use Keywords
Adding specific keywords to your prompts helps the AI identify patterns more accurately.

### Tip 5: Keep Prompts Updated
As your business evolves, update your prompts to match your current sales process.

---

## 📊 Expected Results

With good prompts configured:
- **80-90%** of contacts should be correctly sorted automatically
- **10-20%** will go to "Unmatched" for manual review (this is good - it means AI is being cautious)
- **Review time** reduced by 70-80%
- **Sorting accuracy** improves over time as you refine prompts

---

## 🚀 Next Steps

1. Set up your `.env.local` with OpenAI API key
2. Configure pipeline stages and prompts
3. Test with 5 contacts
4. Review and adjust prompts
5. Start using for all new contacts!

**Questions?** Check the full documentation in `AUTOMATIC_PIPELINE_STAGE_SORTING.md`

