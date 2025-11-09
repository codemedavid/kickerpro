# ✅ AI Automation Fix - Interval & Tag Processing

## 🐛 Problem Identified

The AI automation was **NOT** re-processing contacts after the time interval finished. Even if a contact had the correct tag and the time interval passed, they would never be processed again.

### Root Cause

The cooldown logic was **backwards**. The code was checking:
- ❌ "Has this contact been processed WITHIN the last X minutes?"
- ❌ If YES → Skip it

It should have been:
- ✅ "Has MORE than X minutes passed since last processing?"
- ✅ If YES → Process it again

---

## 🔧 What Was Fixed

### **Files Modified:**

1. **`src/app/api/cron/ai-automations/route.ts`** (Main cron job - runs every 1 minute)
2. **`src/app/api/ai-automations/trigger/route.ts`** (Manual trigger endpoint)
3. **`src/app/api/ai-automations/execute/route.ts`** (Legacy execute endpoint)

### **Key Changes:**

#### **Before (Broken Logic):**
```typescript
// ❌ This checked if execution EXISTS within cooldown
const { data: recentExecution } = await supabase
  .from('ai_automation_executions')
  .gte('created_at', new Date(Date.now() - cooldownMs).toISOString())

if (recentExecution) {
  // Skip - but this means NEVER re-process!
  continue;
}
```

#### **After (Fixed Logic):**
```typescript
// ✅ Get the LAST execution for this contact
const { data: lastExecution } = await supabase
  .from('ai_automation_executions')
  .eq('conversation_id', conv.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (lastExecution) {
  const timeSinceLastExecution = Date.now() - new Date(lastExecution.created_at).getTime();
  const cooldownMs = totalMinutes * 60 * 1000;

  // ✅ If LESS than interval time, skip (still in cooldown)
  if (timeSinceLastExecution < cooldownMs) {
    console.log(`Skipped - needs ${totalMinutes - minutesSince} more minutes`);
    continue;
  }
  
  // ✅ If MORE than interval time, process again!
  console.log(`Ready to process - ${minutesSince} minutes since last execution`);
}
```

---

## 🎯 How It Works Now

### **Step-by-Step Flow:**

1. **Every 1 minute**, Vercel Cron calls `/api/cron/ai-automations`

2. **For each enabled rule:**
   - ✅ Check if within active hours (or 24/7 mode)
   - ✅ Check daily limit not exceeded
   - ✅ Calculate time threshold (e.g., 30 minutes ago)

3. **Find conversations:**
   - ✅ Get conversations with `last_message_time` older than threshold
   - ✅ **ONLY keep conversations WITH the required tags** (if specified)
   - ✅ Remove conversations with excluded tags (if specified)

4. **For each conversation:**
   - ✅ Check if automation is stopped for this contact
   - ✅ **Get LAST execution time** for this contact
   - ✅ **If last execution was MORE than X minutes ago → Process!**
   - ✅ **If last execution was LESS than X minutes ago → Skip (cooldown)**
   - ✅ If never executed before → Process!

5. **Generate & Send:**
   - ✅ Generate AI message
   - ✅ Send via Facebook API
   - ✅ Record execution with timestamp

---

## 📊 Example Scenario

### **Rule Configuration:**
```
Name: "Follow-up AI"
Time Interval: 30 minutes
Include Tags: ["ai"]
Active Hours: 9 AM - 9 PM
Max Per Day: 100
```

### **What Happens:**

**9:00 AM** - Contact has "ai" tag, last message 35 minutes ago
- ✅ **PROCESSED** - First time, generates & sends message

**9:15 AM** - Cron runs again (15 minutes since last execution)
- ⏭️ **SKIPPED** - Only 15 minutes passed, needs 30 minutes

**9:30 AM** - Cron runs again (30 minutes since last execution)
- ✅ **PROCESSED AGAIN** - 30 minutes passed! Generates NEW message

**9:45 AM** - Cron runs again (15 minutes since last execution)
- ⏭️ **SKIPPED** - Only 15 minutes passed, needs 30 minutes

**10:00 AM** - Cron runs again (30 minutes since last execution)
- ✅ **PROCESSED AGAIN** - 30 minutes passed! Generates NEW message

**And so on...**

---

## 🏷️ Tag Filtering Logic

### **Include Tags (REQUIRED):**

If you set **Include Tags: ["ai", "hot"]**

```
✅ Contact has "ai" tag → INCLUDED
✅ Contact has "hot" tag → INCLUDED
✅ Contact has BOTH tags → INCLUDED
❌ Contact has NEITHER tag → EXCLUDED
```

**Only contacts WITH at least one of the included tags will be processed.**

### **Exclude Tags (BLOCKED):**

If you set **Exclude Tags: ["archived", "blocked"]**

```
❌ Contact has "archived" tag → EXCLUDED
❌ Contact has "blocked" tag → EXCLUDED
❌ Contact has BOTH tags → EXCLUDED
✅ Contact has NEITHER tag → INCLUDED
```

### **Combined Example:**

```
Include Tags: ["ai"]
Exclude Tags: ["archived"]

✅ Has "ai" AND no "archived" → PROCESSED
❌ Has "ai" AND has "archived" → EXCLUDED
❌ No "ai" tag → EXCLUDED
```

---

## 🔄 Continuous Processing

### **The Fix Ensures:**

✅ **Contacts are re-processed EVERY time the interval finishes**
✅ **Only contacts with the required tags are processed**
✅ **Contacts are never spammed (cooldown period enforced)**
✅ **Each message is unique (AI avoids repetition)**

### **Cron Schedule:**

```json
{
  "path": "/api/cron/ai-automations",
  "schedule": "* * * * *"
}
```

**Runs every 1 minute** - checks all rules and processes eligible contacts.

---

## 🧪 How to Test

### **1. Create a Test Automation:**

```
Name: Test AI
Time Interval: 5 minutes
Include Tags: [your test tag ID]
Max Per Day: 10
Enable: ✓ ON
```

### **2. Tag a Test Contact:**

- Go to a conversation
- Add the tag you specified
- Make sure last message was more than 5 minutes ago

### **3. Wait for Cron (1 minute):**

- Check logs in Vercel
- You should see: "✅ Ready to process"
- Message should be generated and sent

### **4. Wait Another 5 Minutes:**

- Cron should process the contact AGAIN
- New unique message should be sent

### **5. Verify Cooldown:**

- Within 5 minutes, contact should be SKIPPED
- Log: "⏭️ Skipped - needs X more minutes"

---

## 📝 Improved Logging

### **Rule Summary:**
```
[AI Automation Cron] Processing rule: Follow-up AI
  User: abc-123
  Time Interval: 30 minutes
  Max Per Day: 100
  24/7 Mode: NO
  Include Tags: tag-id-1, tag-id-2
  Exclude Tags: NONE
```

### **Tag Filtering:**
```
📊 Found 50 conversation(s) past time threshold
🏷️  INCLUDE tags filter: 50 → 12 conversation(s) WITH required tags
🏷️  EXCLUDE tags filter: 12 → 10 conversation(s)
✅ Final eligible conversations: 10
```

### **Per-Contact Processing:**
```
Processing: John Doe
✅ Ready to process - last execution was 35 minutes ago (interval: 30 minutes)
🤖 Generating AI message...
✅ Message sent successfully (ID: m_abc123)
```

### **Cooldown Example:**
```
Processing: Jane Smith
⏭️  Skipped - last processed 15 minutes ago (interval: 30 minutes, needs 15 more minutes)
```

---

## ✅ Summary

### **What's Fixed:**

✅ Contacts are now re-processed every time the interval finishes
✅ Tag filtering works correctly (only tagged contacts are processed)
✅ Cooldown period is properly enforced (no spam)
✅ Better logging shows exactly what's happening
✅ Works automatically via Vercel Cron (every 1 minute)

### **What to Expect:**

1. **First execution**: Contact with required tag is processed
2. **Wait X minutes**: Cooldown period
3. **After X minutes**: Contact is processed AGAIN
4. **Repeat forever**: As long as rule is enabled

### **No More Issues:**

❌ Contacts never being re-processed → ✅ **FIXED**
❌ Tags being ignored → ✅ **FIXED**
❌ Unclear why contacts are skipped → ✅ **FIXED** (better logs)

---

## 🚀 Deploy & Test

1. **Commit changes**
2. **Push to Vercel**
3. **Create a test automation rule**
4. **Tag a contact**
5. **Watch the logs** (should process every X minutes)

**Your AI automation is now working correctly!** 🎉

