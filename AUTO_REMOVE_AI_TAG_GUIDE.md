# 🏷️ Auto-Remove AI Tag - Complete Guide

## 🎯 What This Does

**Automatically removes the "AI" tag from conversations when customers reply.**

This is a universal feature that works for ALL customer replies, regardless of which automation is running.

---

## ✨ Key Features

✅ **Universal** - Works for all conversations, not tied to specific automations
✅ **Instant** - Happens as soon as webhook receives the reply
✅ **Case-Insensitive** - Matches "AI", "ai", "Ai", "aI"
✅ **Safe** - If no "AI" tag exists, nothing breaks
✅ **Automatic** - No configuration needed

---

## 🚀 How To Use

### **Step 1: Create "AI" Tag**

1. Go to your dashboard
2. Create a new tag
3. Name it: **"AI"** (case doesn't matter)
4. Pick any color you want

### **Step 2: Tag Conversations**

Tag conversations that should be handled by AI:
- Manual tagging in conversations view
- Auto-tag when sending bulk messages
- Tag via automation rules

### **Step 3: Customer Replies**

When customer replies:
- ✅ "AI" tag is automatically removed
- ✅ You see it in the logs
- ✅ Conversation can be filtered differently now

---

## 💡 Use Cases

### **Use Case 1: AI to Human Handoff**

```
🤖 AI handling conversation
   ↓
Tag: "AI" ✅
   ↓
AI sends follow-ups
   ↓
Customer replies with question
   ↓
🏷️ "AI" tag removed automatically ✅
   ↓
👤 Human agent takes over
   ↓
Filter: Show conversations WITHOUT "AI" tag
   ↓
Agent sees conversations needing attention ✅
```

**Benefits:**
- Clear separation between AI and human handled conversations
- Easy filtering in dashboard
- Automatic handoff trigger

---

### **Use Case 2: AI Follow-up Automation**

```
📤 Send bulk message
   ↓
Auto-tag all recipients with "AI" ✅
   ↓
AI Automation Rule:
   Include Tag: "AI"
   Stop on Reply: ON
   ↓
AI sends follow-ups to conversations with "AI" tag
   ↓
Customer replies ✅
   ↓
🏷️ "AI" tag removed ✅
   ↓
AI automation skips this conversation ✅
   ↓
No more unwanted follow-ups! 🎉
```

**Benefits:**
- Automatic opt-out when customer replies
- Clean workflow management
- No duplicate messages

---

### **Use Case 3: Lead Qualification**

```
New lead comes in
   ↓
Tag: "AI" (for initial qualification)
   ↓
AI asks qualification questions
   ↓
Lead replies: "Yes, I'm interested"
   ↓
🏷️ "AI" tag removed ✅
   ↓
Tag: "Qualified" (manually or via rule)
   ↓
Sales team takes over ✅
```

**Benefits:**
- AI handles initial qualification
- Automatic transition to human when engaged
- Clear lead status tracking

---

## 🎬 Example Workflow

### **Complete AI Follow-up System**

#### **Setup:**

1. **Create Tags:**
   - "AI" (will be auto-removed on reply)
   - "Responded" (for tracking)
   - "Needs Follow-up" (for manual flagging)

2. **Create Bulk Message:**
   - Compose your outreach
   - Auto-tag recipients with: "AI"
   - Send to all/active/selected

3. **Create AI Automation:**
   ```
   Name: AI Follow-up System
   Trigger: Time-based
   Interval: 24 hours
   Include Tags: "AI"
   Stop on Reply: ON
   Max Follow-ups: 3
   ```

#### **What Happens:**

**Day 1 - Initial Send:**
```
Send bulk message to 100 contacts
   ↓
All 100 tagged with "AI" ✅
   ↓
Waiting for replies...
```

**Day 2 - After 24 Hours:**
```
30 customers replied
   ↓
🏷️ "AI" tag removed from those 30 ✅
   ↓
AI automation runs
   ↓
Only 70 remaining contacts get follow-up #1 ✅
```

**Day 3 - After 48 Hours:**
```
10 more customers replied to follow-up #1
   ↓
🏷️ "AI" tag removed from those 10 ✅
   ↓
AI automation runs
   ↓
Only 60 remaining contacts get follow-up #2 ✅
```

**Day 4 - After 72 Hours:**
```
5 more customers replied
   ↓
🏷️ "AI" tag removed from those 5 ✅
   ↓
AI automation runs
   ↓
55 contacts get follow-up #3 (max reached)
   ↓
Automation stops ✅
```

**Final Results:**
- 45 customers engaged (replied)
- 55 customers didn't respond
- 0 customers got unwanted messages after replying ✅

---

## 📊 Monitoring

### **Check Logs**

Look for these log entries in Vercel:

```bash
# When customer replies:
[Reply Detector] 💬 Contact 123456 replied to page 789
[Reply Detector] ✅ Found conversation: John Doe (uuid-abc)
[Reply Detector] 🏷️✨ Auto-removed "AI" tag for John Doe

# If no AI tag to remove:
[Reply Detector] ℹ️ No "AI" tag found to remove (might not exist)
```

### **Database Check**

```sql
-- Check conversations with AI tag
SELECT c.sender_name, t.name
FROM messenger_conversations c
JOIN conversation_tags ct ON c.id = ct.conversation_id
JOIN tags t ON ct.tag_id = t.id
WHERE t.name ILIKE 'AI';

-- Should decrease after customers reply!
```

---

## 🔧 Technical Details

### **How It Works:**

1. **Webhook receives message**
   ```typescript
   POST /api/webhook
   ```

2. **Check if it's from user (not echo)**
   ```typescript
   const isEcho = event.message.is_echo === true;
   if (!isEcho) {
     // This is a real user reply
   }
   ```

3. **Find conversation in database**
   ```typescript
   const conversation = await supabase
     .from('messenger_conversations')
     .select('id')
     .eq('sender_id', senderPSID)
     .single();
   ```

4. **Look for "AI" tag (case-insensitive)**
   ```typescript
   const aiTag = await supabase
     .from('tags')
     .select('id')
     .ilike('name', 'AI')
     .single();
   ```

5. **Remove AI tag from conversation**
   ```typescript
   await supabase
     .from('conversation_tags')
     .delete()
     .eq('conversation_id', conversation.id)
     .eq('tag_id', aiTag.id);
   ```

### **Code Location:**

- Main webhook: `src/app/api/webhook/route.ts`
- Reply detector: `src/app/api/webhook/reply-detector/route.ts`

---

## ❓ FAQ

### **Q: What if I don't have an "AI" tag?**
**A:** The feature gracefully skips if no "AI" tag exists. Nothing breaks.

### **Q: Can I use a different tag name?**
**A:** Currently hardcoded to "AI". You'd need to modify the code to use a different name.

### **Q: Is it case-sensitive?**
**A:** No! Matches "AI", "ai", "Ai", "aI" - all work.

### **Q: What if conversation has multiple tags?**
**A:** Only the "AI" tag is removed. Other tags remain untouched.

### **Q: Does this work with automation rules?**
**A:** Yes! This is separate from rule-specific tag removal. Both can work together:
- Universal: "AI" tag always removed on reply
- Rule-specific: Additional tags removed based on automation settings

### **Q: Can I disable this feature?**
**A:** Simply don't create an "AI" tag, or remove it from your system.

### **Q: What happens if customer replies multiple times?**
**A:** First reply removes the "AI" tag. Subsequent replies have no AI tag to remove (safe).

---

## 🎊 Summary

✅ Create "AI" tag
✅ Tag conversations handled by AI
✅ Tag automatically removed when customer replies
✅ Use for AI-to-human handoff
✅ Use for automation management
✅ Works universally across your system

**It's that simple!** 🚀

---

## 🔗 Related Docs

- `STOP_ON_REPLY_FIX.md` - Complete fix documentation
- `QUICK_FIX_CHECKLIST.md` - Quick setup guide
- `AI_AUTOMATION_COMPLETE_WITH_LIMITS_AND_AUTOSTOP.md` - Automation system overview

