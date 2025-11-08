# 🚀 AI Follow-Up Messages - Quick Start

## ⚡ Get Started in 2 Minutes

### **Step 1: Setup (One Time Only)**

#### **1A. Add API Keys**
Run this command:
```bash
./setup-ai-keys.bat
```

Or manually add to `.env.local`:
```
OPENROUTER_API_KEY_1=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
OPENROUTER_API_KEY_2=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
```

#### **1B. Run Database Migration**
```sql
-- Copy contents of add-ai-generated-messages-table.sql
-- Paste in Supabase SQL Editor
-- Click Run
```

#### **1C. Restart Server**
```bash
npm run dev
```

---

### **Step 2: Generate AI Messages**

1. Go to `/dashboard/conversations`
2. Select a **specific page** (not "All Pages")
3. **Select conversations** (checkbox them)
4. Click **"✨ AI Generate for X"** button
5. **Wait** ~10-30 seconds
6. **Review** generated messages in dialog

---

### **Step 3: Use Messages**

For each generated message:

**Option A: Copy & Paste**
```
Click "Copy Message"
→ Paste anywhere
```

**Option B: Send Directly**
```
Click "Use This Message"
→ Goes to Compose page
→ Message pre-filled
→ Edit if needed
→ Send!
```

---

## 🎯 Quick Examples

### **Example 1: Re-engage 10 Cold Leads**
```
Time: 30 seconds
1. Filter: Tag = "Cold Lead"
2. Select: 10 conversations
3. Click: "AI Generate for 10"
4. Wait: 15 seconds
5. Review: 10 unique messages
6. Use or copy each
```

### **Example 2: Follow-up After Promo**
```
Time: 1 minute
1. Filter: Tag = "Interested in Promo"
2. Select: 50 conversations
3. Generate: AI messages
4. Result: Each references their specific interest
```

---

## 💡 Pro Tips

### **Tip 1: Select the Right Conversations**
✅ Choose conversations with history (5+ messages)
✅ Use specific page (not "All Pages")
✅ Sync first for latest messages

### **Tip 2: Review & Edit**
✅ AI gets you 90% there
✅ Add your personal touch
✅ Adjust for brand voice

### **Tip 3: Use Tags**
✅ Filter by tags before generating
✅ Tag conversations after using AI
✅ Track which used AI messages

### **Tip 4: Batch Processing**
✅ For 100+ conversations, do 50 at a time
✅ Review each batch
✅ Take breaks between batches

---

## 🎨 What You'll See

### **Before Generating**
```
[Conversations selected]
[✨ AI Generate for 10] ← Click this!
```

### **While Generating**
```
[⏳ Generating...] ← Wait
Toast: "Processing 10 conversations..."
```

### **After Generating**
```
Dialog opens with 10 messages
Each showing:
- Contact name
- AI-generated message
- [Copy] and [Use] buttons
```

---

## ⚠️ Important Notes

### **Requirements**
- Must select specific page (not "All Pages")
- Must have conversations selected
- API keys must be configured
- Database migration must be run

### **Limitations**
- Works best with conversations that have history
- New conversations (1-2 messages) may get generic messages
- Takes time for large batches (be patient)

### **Best Results**
- Conversations with 5+ messages
- Back-and-forth dialogue
- Clear context/topic
- Recent activity

---

## 🚨 Troubleshooting

### **Button Disabled**
- **Problem:** "AI Generate" button is grayed out
- **Solution:** Select a specific page (not "All Pages")

### **No Messages Generated**
- **Problem:** Dialog shows "No messages generated"
- **Solution:** Check if conversations have message history

### **Takes Too Long**
- **Problem:** Generating for 100+ conversations is slow
- **Solution:** Normal! Process smaller batches (20-50)

### **Generic Messages**
- **Problem:** Messages not personalized enough
- **Solution:** Use conversations with more history

---

## 📊 Quick Reference

| Want To... | Do This |
|-----------|---------|
| Generate messages | Select convos → Click AI button |
| Copy message | Click "Copy Message" |
| Send message | Click "Use This Message" |
| Edit message | Use → Edit in compose → Send |
| Save for later | Copy to notes/doc |

---

## 🎉 You're Ready!

That's it! You now know how to:
- ✅ Generate AI follow-up messages
- ✅ Review generated content
- ✅ Copy or use directly
- ✅ Send personalized messages at scale

**Start generating personalized messages with AI!** 🤖✨

---

**Full Documentation:** See `AI_FOLLOW_UP_FEATURE_COMPLETE.md`

**Happy AI messaging!** 🚀

