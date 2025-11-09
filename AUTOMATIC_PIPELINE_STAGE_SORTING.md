# ✨ Automatic Pipeline Stage Sorting - Feature Documentation

## 🎉 What's New

When you add contacts to the pipeline from the **Conversations** page, they are now **automatically sorted** into the appropriate pipeline stages using AI analysis!

---

## 🚀 How It Works

### Before This Update:
1. Click "Add to Pipeline" on selected contacts
2. All contacts go to "Unmatched" stage
3. You manually run AI analysis to sort them
4. Contacts move to appropriate stages

### After This Update: ✅
1. Click "Add to Pipeline" on selected contacts
2. Contacts are added to pipeline
3. **AI automatically analyzes each contact**
4. **Contacts are sorted to appropriate stages** based on:
   - Global analysis prompt (overall pipeline strategy)
   - Stage-specific criteria (each stage's requirements)
   - Conversation history with the contact
5. You see them already sorted when you open the pipeline!

---

## 📋 Requirements

For automatic sorting to work, you need to have:

### 1. **Pipeline Stages Created**
- Go to Pipeline page
- Create stages (e.g., "New Lead", "Qualified", "Negotiating", "Closed")
- Each stage should have an analysis prompt

### 2. **Global Analysis Prompt Configured**
- Go to Pipeline Settings
- Set up a global analysis prompt
- This tells the AI how to evaluate contacts overall

### Example Global Prompt:
```
Analyze this contact's conversation history and determine which stage 
they should be in. Consider:
- Their level of interest (questions asked, engagement)
- Purchase intent (mentioned buying, pricing questions)
- Objections or concerns raised
- Timeline mentions
- Budget discussions

Recommend the most appropriate stage based on these factors.
```

### 3. **Stage-Specific Analysis Prompts**
Each stage should have a prompt that defines its criteria.

### Example Stage Prompts:

**New Lead Stage:**
```
This contact belongs in "New Lead" if:
- First interaction or very early conversation
- No clear buying intent expressed yet
- Asked general questions about products/services
- Has not discussed pricing or timeline
```

**Qualified Stage:**
```
This contact belongs in "Qualified" if:
- Expressed clear interest in specific products/services
- Asked about pricing, features, or availability
- Discussed their needs or use case
- Still comparing options or gathering information
```

**Negotiating Stage:**
```
This contact belongs in "Negotiating" if:
- Actively discussing price, terms, or conditions
- Requested quotes or proposals
- Expressed intent to purchase
- Working through final details or objections
```

---

## 🎯 User Experience

### When AI Analysis Runs Successfully:

**Toast Message:**
```
✨ Added & Sorted!
3 contacts added and automatically sorted to appropriate stages!
```

**What Happens:**
- Contacts are analyzed using AI
- Each contact is placed in the best matching stage
- If AI is highly confident (both prompts agree), contact goes to that stage
- If AI is uncertain (prompts disagree), contact goes to "Unmatched" for manual review

### When AI Analysis Doesn't Run:

**Toast Message:**
```
Added to Pipeline
3 contacts added to pipeline. Set up pipeline settings 
to enable automatic stage sorting.
```

**Why This Happens:**
- Pipeline settings not configured
- No global analysis prompt set
- No OpenAI API key configured

**What to Do:**
1. Go to Pipeline Settings
2. Configure global analysis prompt
3. Add OpenAI API key to environment variables
4. Next time you add contacts, they'll be auto-sorted!

---

## 🔍 How AI Decides the Stage

### Dual-Prompt System:

The AI uses a **two-step analysis** for accuracy:

#### Step 1: Global Analysis
```
Question: "Overall, which stage should this contact be in?"
AI considers: All stages, conversation history, contact behavior
Result: Recommends one stage
```

#### Step 2: Stage-Specific Analysis
```
Question: "Does this contact meet the criteria for [Stage Name]?"
AI considers: Specific stage requirements, conversation details
Result: Yes/No for each stage
```

#### Step 3: Agreement Check
```
Both prompts must agree:
- Global says: "Qualified Stage" ✓
- Stage-specific says: "Yes, belongs in Qualified" ✓
- Result: Contact goes to Qualified Stage ✅

If they disagree:
- Global says: "Negotiating Stage"
- Stage-specific says: "No, doesn't meet Negotiating criteria"
- Result: Contact goes to "Unmatched" for manual review ⚠️
```

---

## 📊 What Gets Analyzed

For each contact, the AI sees:

1. **Contact Information:**
   - Name
   - Facebook ID
   - Last interaction time

2. **Full Conversation History:**
   - All messages exchanged
   - Message timestamps
   - Who sent each message (customer vs business)

3. **Available Stages:**
   - Stage names and descriptions
   - Stage-specific criteria
   - Stage order/position

4. **Context:**
   - Global pipeline strategy
   - Your business goals
   - Stage definitions

---

## 🎨 Visual Indicators

### In Conversations Page:

When you select contacts and click "Add to Pipeline":
- Button shows: "Add to Pipeline"
- While processing: "Adding..." (with spinner)
- After success: Toast notification with results

### In Pipeline Page:

After automatic sorting:
- Contacts appear in their assigned stages
- Each contact shows:
  - ✅ AI confidence score (if analyzed)
  - 📊 Agreement status (both prompts agreed?)
  - 📝 AI reasoning (why this stage?)
  - 🕐 Analysis timestamp

---

## 🛠️ Technical Details

### API Flow:

```
1. User clicks "Add to Pipeline"
   ↓
2. POST /api/pipeline/opportunities/bulk
   - Adds contacts to pipeline
   - Initially in "Unmatched" stage
   ↓
3. Checks if pipeline settings configured
   - If YES: Continue to step 4
   - If NO: Return success (contacts in Unmatched)
   ↓
4. POST /api/pipeline/analyze (automatic)
   - Analyzes each contact
   - Runs global + stage-specific prompts
   - Calculates confidence scores
   ↓
5. Updates contact stages
   - Moves to appropriate stages
   - Records analysis results
   - Creates stage history
   ↓
6. Returns success + analysis results
   ↓
7. User redirected to Pipeline page
   - Sees contacts already sorted!
```

### Performance:

- **Small batches (1-5 contacts):** ~2-5 seconds
- **Medium batches (6-20 contacts):** ~10-30 seconds
- **Large batches (20+ contacts):** ~30-60 seconds

**Note:** AI analysis runs in the background. The UI shows a loading state until complete.

---

## 🎯 Use Cases

### Use Case 1: Daily Lead Management
```
Scenario: You get 10 new Facebook messages daily

Before:
1. Add all to pipeline
2. Manually run AI analysis
3. Review and adjust
Time: 5-10 minutes

After:
1. Select all conversations
2. Click "Add to Pipeline"
3. Done! They're sorted automatically
Time: 30 seconds
```

### Use Case 2: Campaign Follow-ups
```
Scenario: Following up with 50 contacts from an ad campaign

Before:
1. Add to pipeline in batches
2. Run analysis on each batch
3. Review 50 contacts manually
Time: 30-45 minutes

After:
1. Select all 50 contacts
2. Click "Add to Pipeline"
3. AI sorts all 50 automatically
4. Review only uncertain ones (in Unmatched)
Time: 5-10 minutes
```

### Use Case 3: Reactivation Campaign
```
Scenario: Re-engaging 100 old conversations

Before:
1. Add all to pipeline
2. Manually categorize by last interaction
3. Create stages based on conversation stage
Time: 1-2 hours

After:
1. Select all 100 contacts
2. Click "Add to Pipeline"
3. AI reads each conversation history
4. Sorts based on actual conversation content
Time: 2-3 minutes
```

---

## 🔧 Configuration Guide

### Step 1: Set Up Pipeline Stages

1. Go to **Pipeline** page
2. Click **"Create Stage"**
3. For each stage, provide:
   - **Name:** e.g., "New Lead"
   - **Description:** Brief explanation
   - **Analysis Prompt:** Criteria for this stage
   - **Color:** Visual identifier

### Step 2: Configure Global Settings

1. Go to **Pipeline Settings**
2. Add **Global Analysis Prompt:**
   ```
   You are analyzing sales conversations to determine 
   pipeline stages. Consider the contact's:
   - Interest level
   - Purchase intent
   - Conversation maturity
   - Objections/concerns
   - Timeline and budget
   
   Recommend the most appropriate stage.
   ```

### Step 3: Test with a Few Contacts

1. Go to **Conversations**
2. Select 2-3 test contacts
3. Click **"Add to Pipeline"**
4. Wait for analysis
5. Check Pipeline page to verify sorting

### Step 4: Adjust Prompts if Needed

If contacts aren't sorted correctly:
1. Review AI reasoning in Pipeline
2. Adjust stage-specific prompts
3. Update global prompt if needed
4. Re-run analysis on test contacts

---

## 🐛 Troubleshooting

### Issue: Contacts always go to "Unmatched"

**Possible Causes:**
- Stage prompts too strict
- Global prompt not aligned with stage prompts
- Conversation history too short

**Solution:**
- Review and relax stage criteria
- Make prompts more specific
- Add context to global prompt

### Issue: AI analysis takes too long

**Possible Causes:**
- Too many contacts at once
- API rate limits
- Slow network connection

**Solution:**
- Add contacts in smaller batches (10-20 at a time)
- Wait between batches
- Check OpenAI API status

### Issue: Wrong stages assigned

**Possible Causes:**
- Prompts not clear enough
- Stages overlap in criteria
- Missing conversation context

**Solution:**
- Make stage prompts more specific
- Ensure stages are mutually exclusive
- Review conversation history quality

---

## 📈 Best Practices

### 1. **Clear Stage Definitions**
```
✅ Good: "New Lead - First contact, no buying intent expressed"
❌ Bad: "New Lead - People who just started talking"
```

### 2. **Mutually Exclusive Stages**
```
✅ Good: Stages have clear boundaries between them
❌ Bad: "Interested" and "Engaged" stages overlap
```

### 3. **Test Incrementally**
```
✅ Good: Test with 5 contacts, adjust prompts, test again
❌ Bad: Add 100 contacts without testing prompts
```

### 4. **Review Unmatched Contacts**
```
✅ Good: Check Unmatched stage weekly, adjust prompts
❌ Bad: Ignore Unmatched contacts forever
```

### 5. **Update Prompts Regularly**
```
✅ Good: Refine prompts based on results
❌ Bad: Set once and never adjust
```

---

## 🎓 Advanced Tips

### Tip 1: Use Examples in Prompts
```
This contact belongs in "Qualified" if:
- Expressed clear interest
- Asked about pricing

Example conversations:
- "How much is the premium package?"
- "Do you offer bulk discounts?"
- "What's included in the service?"
```

### Tip 2: Reference Specific Keywords
```
Look for keywords like:
- New Lead: "just browsing", "tell me more", "info"
- Qualified: "price", "how much", "quote"
- Negotiating: "discount", "terms", "contract"
```

### Tip 3: Consider Timeline
```
If last message was:
- Within 24 hours: Active conversation
- 1-7 days ago: Follow-up needed
- 7+ days ago: Cold/inactive
```

---

## 🔐 Privacy & Security

- AI only sees conversation data you already have access to
- No data is stored outside your Supabase database
- OpenAI API calls are encrypted
- AI analysis results are stored with the contact record
- You can delete analysis results anytime

---

## 🚀 Next Steps

1. **Set up your pipeline stages** if you haven't already
2. **Configure global analysis prompt** in Pipeline Settings
3. **Test with a few contacts** to verify sorting works
4. **Adjust prompts** based on results
5. **Start using for all new contacts!**

---

## 📚 Related Features

- **Manual Stage Movement:** Drag contacts between stages
- **Stage History:** See all stage changes
- **AI Re-analysis:** Re-run analysis anytime
- **Bulk Stage Update:** Move multiple contacts at once
- **Custom Fields:** Add custom data to track

---

## 🎉 Summary

**Before:** Add to pipeline → Manually analyze → Manually sort  
**After:** Add to pipeline → ✨ **Automatically sorted!**

Enjoy your automated pipeline management! 🚀

