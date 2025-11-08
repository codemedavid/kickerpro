# 🚀 Scheduled Auto-Fetch - Quick Start Guide

## ⚡ Setup in 60 Seconds

### **Step 1: Run Database Migration**
```sql
-- Copy and run this in Supabase SQL Editor
-- File: add-scheduled-autofetch-features.sql
```

### **Step 2: Schedule a Message**
1. Go to `/dashboard/compose`
2. Fill in message details
3. Select **"Schedule"** type
4. Choose date & time

### **Step 3: Enable Auto-Fetch**
1. Toggle **"Auto-Fetch New Conversations"** ON
2. Done! (Or continue to add filters)

### **Step 4: Add Filters (Optional)**
- **Include tags**: Select tags to target
- **Exclude tags**: Select tags to avoid
- Review summary

### **Step 5: Schedule**
Click **"Schedule Message"** button

### ✅ Done!
Message will auto-fetch and filter before sending!

---

## 🎯 Common Scenarios

### **Scenario 1: Target New Hot Leads**
```
Auto-Fetch: ✅ ON
Include: [Hot Lead]
Exclude: [Contacted]
```

### **Scenario 2: Weekly Newsletter**
```
Auto-Fetch: ✅ ON
Include: [Customer]
Exclude: [Unsubscribed]
```

### **Scenario 3: Re-engagement Campaign**
```
Auto-Fetch: ✅ ON
Include: [Lead], [No Response]
Exclude: [Customer], [Not Interested]
```

---

## 💡 Quick Tips

### **Tip 1: Use Exclude for Safety**
Always exclude:
- Unsubscribed
- Banned
- Test contacts

### **Tip 2: Test First**
1. Create test tag
2. Tag 2-3 conversations
3. Schedule with that tag
4. Verify before scaling

### **Tip 3: Review Filters**
- Include = Target audience
- Exclude = Safety net
- Both = Precise targeting

### **Tip 4: Monitor Results**
Check after first send:
- How many recipients?
- Right audience?
- Adjust filters if needed

---

## 🎨 Visual Quick Reference

### **Auto-Fetch Toggle**
```
[Toggle Switch] Auto-Fetch New Conversations
Description below toggle
```

### **Include Filters**
```
🏷️ Include Conversations With Tags
☑ Hot Lead  ☑ Priority  ☐ Follow-up
```

### **Exclude Filters**
```
🏷️ Exclude Conversations With Tags
☑ Archived  ☐ Test  ☐ Unsubscribed
```

### **Filter Summary**
```
Filter Summary:
✓ Include 2 tags
✗ Exclude 1 tag
```

---

## ⏱️ Timeline

| Task | Time |
|------|------|
| Enable auto-fetch | 5 seconds |
| Add filters | 10 seconds |
| Schedule message | 5 seconds |
| **Total** | **20 seconds** |

---

## 🔍 What Happens

```
You Schedule Message
      ↓
Time Arrives
      ↓
System Syncs Conversations (30s)
      ↓
Applies Your Filters (2s)
      ↓
Updates Recipient List (1s)
      ↓
Sends to Filtered Recipients
      ↓
✅ Done!
```

---

## ⚠️ Things to Know

### **1. Only for Scheduled Messages**
- Not available for "Send Now"
- Not available for "Save Draft"
- Only appears when "Schedule" is selected

### **2. Fetches Before Sending**
- Happens automatically
- Can't manually trigger
- Runs at scheduled time

### **3. Tag Filters are Optional**
- Can use auto-fetch alone
- Can use just include tags
- Can use just exclude tags
- Can use both

### **4. Maximum Recipients**
- Fetches up to 2,000
- Same as manual selection limit
- Facebook API limit

---

## 🎓 Learning Path

### **Beginner:**
1. Enable auto-fetch (no filters)
2. Schedule message
3. Check results

### **Intermediate:**
1. Add include filters
2. Schedule and test
3. Review recipients

### **Advanced:**
1. Combine include + exclude
2. Multiple tag filters
3. Regular campaigns

---

## 📊 Results You Can Expect

### **Without Auto-Fetch:**
```
Schedule: Monday 9 AM
Recipients: 100 (from when you scheduled)
New conversations: Not included ❌
Tags changed: Not reflected ❌
```

### **With Auto-Fetch:**
```
Schedule: Monday 9 AM
Recipients: 125 (updated at send time)
New conversations: Included ✅
Tags changed: Reflected ✅
```

---

## 🚨 Common Mistakes

### **Mistake 1: Too Many Exclude Tags**
**Problem:** No recipients left
**Fix:** Use fewer exclude tags

### **Mistake 2: Conflicting Filters**
**Problem:** Include and exclude same tags
**Fix:** Tags can't be in both lists

### **Mistake 3: No Page Selected**
**Problem:** Can't fetch without page
**Fix:** Select page first

### **Mistake 4: Forgetting to Schedule**
**Problem:** Message stays as draft
**Fix:** Choose date/time and "Schedule"

---

## ✅ Checklist

Before scheduling:
- [ ] Message content written
- [ ] Page selected
- [ ] Date and time set
- [ ] Auto-fetch toggle checked
- [ ] Filters configured (if desired)
- [ ] Filter summary reviewed
- [ ] Clicked "Schedule Message"

---

## 🎉 You're Ready!

You now know how to:
- ✅ Enable auto-fetch
- ✅ Add tag filters
- ✅ Schedule messages
- ✅ Target precise audiences
- ✅ Automate campaigns

**Start scheduling smarter campaigns!** 🚀

---

**Full Documentation:** See `SCHEDULED_AUTO_FETCH_FEATURE_COMPLETE.md`

