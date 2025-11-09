# ⏱️ Time Interval - Complete Verification

## ✅ **How Time Intervals Work**

When you set a time interval, the system uses it in **TWO places**:

### **1. Finding Eligible Conversations**
Looks for conversations whose last message was MORE than [interval] ago

### **2. Cooldown Between Sends**
Won't send again to same conversation until [interval] has passed

---

## 🎯 **Current Implementation**

### **Step 1: Calculate Time Threshold**

```typescript
// Lines 146-160 in cron job
let totalMinutes = 0;

if (rule.time_interval_minutes) {
  totalMinutes = rule.time_interval_minutes;
} else if (rule.time_interval_hours) {
  totalMinutes = rule.time_interval_hours * 60;
} else if (rule.time_interval_days) {
  totalMinutes = rule.time_interval_days * 1440;
} else {
  totalMinutes = 1440; // Default: 1 day
}

timeThreshold.setMinutes(timeThreshold.getMinutes() - totalMinutes);
```

### **Step 2: Find Conversations Past Threshold**

```typescript
// Line 200
.lte('last_message_time', timeThreshold.toISOString())
```

**Result:** Only conversations with last message BEFORE threshold

### **Step 3: Check Cooldown (Same Interval)**

```typescript
// Lines 253-268
const cooldownMs = totalMinutes * 60 * 1000;
const { data: recentExecution } = await supabase
  .from('ai_automation_executions')
  .gte('created_at', new Date(Date.now() - cooldownMs).toISOString());

if (recentExecution) {
  console.log(`Skipped - already processed ${minutesSince} minutes ago (interval: ${totalMinutes} minutes)`);
  continue;
}
```

**Result:** Won't send if already sent within [interval]

---

## 📊 **Examples: How Each Interval Works**

### **Example 1: 30-Minute Interval**

```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 30
WHERE id = 'your-rule-id';
```

**Timeline:**
```
10:00 AM - Contact last messaged
10:30 AM - Now eligible (30 min passed)
10:30 AM - Automation sends message
10:45 AM - NOT eligible (only 15 min since send)
11:00 AM - Eligible again (30 min since last send)
11:00 AM - Automation sends again
```

**Behavior:**
- ✅ Sends every 30 minutes
- ✅ First send: 30 min after last message
- ✅ Repeats: every 30 min after that

---

### **Example 2: 1-Hour Interval**

```sql
UPDATE ai_automation_rules 
SET time_interval_hours = 1
WHERE id = 'your-rule-id';
```

**Timeline:**
```
2:00 PM - Contact last messaged
3:00 PM - Now eligible (1 hour passed)
3:00 PM - Automation sends
3:30 PM - NOT eligible (only 30 min)
4:00 PM - Eligible again (1 hour since send)
4:00 PM - Automation sends again
```

**Behavior:**
- ✅ Sends every 1 hour
- ✅ First send: 1 hour after last message
- ✅ Repeats: every 1 hour

---

### **Example 3: 24-Hour Interval**

```sql
UPDATE ai_automation_rules 
SET time_interval_days = 1
WHERE id = 'your-rule-id';
```

**Timeline:**
```
Monday 10:00 AM - Contact last messaged
Tuesday 10:00 AM - Now eligible (24 hours)
Tuesday 10:00 AM - Automation sends
Tuesday 11:00 AM - NOT eligible
Wednesday 10:00 AM - Eligible again (24 hours)
Wednesday 10:00 AM - Automation sends
```

**Behavior:**
- ✅ Sends once per day
- ✅ First send: 24 hours after last message
- ✅ Repeats: every 24 hours

---

## 🔍 **Verification Queries**

### **Check Your Current Interval:**

```sql
SELECT 
  name,
  time_interval_minutes,
  time_interval_hours,
  time_interval_days,
  CASE 
    WHEN time_interval_minutes IS NOT NULL THEN time_interval_minutes || ' minutes'
    WHEN time_interval_hours IS NOT NULL THEN time_interval_hours || ' hours = ' || (time_interval_hours * 60) || ' minutes'
    WHEN time_interval_days IS NOT NULL THEN time_interval_days || ' days = ' || (time_interval_days * 1440) || ' minutes'
    ELSE 'NOT SET'
  END as interval_display,
  COALESCE(
    time_interval_minutes,
    time_interval_hours * 60,
    time_interval_days * 1440
  ) as total_minutes
FROM ai_automation_rules
WHERE id = 'your-rule-id';
```

---

### **See When Contacts Will Be Eligible:**

```sql
SELECT 
  mc.sender_name,
  mc.last_message_time,
  NOW() - mc.last_message_time as time_since_last,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last,
  
  -- When will they be eligible?
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 >= 30 THEN '✅ ELIGIBLE NOW'
    ELSE '⏱️ Eligible in ' || (30 - EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60)::INTEGER || ' minutes'
  END as eligibility_status
FROM messenger_conversations mc
WHERE mc.user_id = 'your-user-id'
  AND mc.tag_ids @> ARRAY['your-tag-id']::TEXT[]
ORDER BY mc.last_message_time DESC
LIMIT 20;

-- Replace 30 with your actual interval in minutes
```

---

### **Check Actual Send Intervals:**

```sql
-- See time between actual sends to same conversation
SELECT 
  mc.sender_name,
  ae.created_at as sent_at,
  LAG(ae.created_at) OVER (PARTITION BY ae.conversation_id ORDER BY ae.created_at) as previous_send,
  EXTRACT(EPOCH FROM (
    ae.created_at - LAG(ae.created_at) OVER (PARTITION BY ae.conversation_id ORDER BY ae.created_at)
  ))/60 as minutes_between_sends
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ae.rule_id = 'your-rule-id'
  AND ae.status = 'sent'
ORDER BY ae.created_at DESC
LIMIT 20;
```

**Expected:** `minutes_between_sends` should match your interval (±1-2 minutes)

---

## 🧪 **Complete Test Workflow**

### **Test: Verify 30-Minute Interval**

```sql
-- 1. Set 30-minute interval
UPDATE ai_automation_rules 
SET time_interval_minutes = 30,
    time_interval_hours = NULL,
    time_interval_days = NULL
WHERE id = 'your-rule-id';

-- 2. Tag a test conversation
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES ('test-conv-id', 'your-tag-id');

-- 3. Check when it will be eligible
SELECT 
  sender_name,
  last_message_time,
  NOW() - INTERVAL '30 minutes' as threshold,
  CASE 
    WHEN last_message_time < NOW() - INTERVAL '30 minutes' THEN '✅ ELIGIBLE NOW'
    ELSE '⏱️ Not eligible yet'
  END as status
FROM messenger_conversations
WHERE id = 'test-conv-id';

-- 4. If eligible, trigger automation
-- Visit: /api/cron/ai-automations

-- 5. Check execution record
SELECT created_at, status FROM ai_automation_executions
WHERE conversation_id = 'test-conv-id'
ORDER BY created_at DESC LIMIT 1;

-- 6. Wait 15 minutes and trigger again
-- Should see in logs: "Skipped - already processed 15 minutes ago (interval: 30 minutes)"

-- 7. Wait another 15 minutes (total 30) and trigger again
-- Should send message again!

-- 8. Verify timing
SELECT 
  created_at,
  LAG(created_at) OVER (ORDER BY created_at) as previous,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at)))/60 as minutes_between
FROM ai_automation_executions
WHERE conversation_id = 'test-conv-id'
  AND rule_id = 'your-rule-id'
ORDER BY created_at DESC;
-- Should show ~30 minutes between sends
```

---

## 🎯 **Set Your Interval**

### **30 Minutes:**
```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 30,
    time_interval_hours = NULL,
    time_interval_days = NULL;
```

### **1 Hour:**
```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = NULL,
    time_interval_hours = 1,
    time_interval_days = NULL;
```

### **2 Hours:**
```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 120,  -- Or use hours = 2
    time_interval_hours = NULL,
    time_interval_days = NULL;
```

### **24 Hours (1 Day):**
```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = NULL,
    time_interval_hours = NULL,
    time_interval_days = 1;
```

---

## ⚠️ **Common Issues**

### **Issue: "Messages sending too frequently"**

**Check:**
```sql
SELECT 
  time_interval_minutes,
  time_interval_hours,
  time_interval_days
FROM ai_automation_rules WHERE id = 'your-rule-id';
```

**Fix:** Set a longer interval

---

### **Issue: "Messages not sending at all"**

**Check 1: Is interval too long?**
```sql
-- How long since last message?
SELECT 
  sender_name,
  EXTRACT(EPOCH FROM (NOW() - last_message_time))/60 as minutes_ago,
  'Your interval: 30 minutes' as note  -- Replace with your interval
FROM messenger_conversations
WHERE tag_ids @> ARRAY['your-tag-id']::TEXT[];
```

**Check 2: Already sent recently?**
```sql
-- When was last send?
SELECT 
  mc.sender_name,
  ae.created_at,
  EXTRACT(EPOCH FROM (NOW() - ae.created_at))/60 as minutes_since_send
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ae.rule_id = 'your-rule-id'
ORDER BY ae.created_at DESC;
```

---

## 📋 **Interval Priority**

If multiple interval types are set, the system uses this priority:

1. **`time_interval_minutes`** (highest priority)
2. **`time_interval_hours`** (if minutes is NULL)
3. **`time_interval_days`** (if hours is NULL)
4. **Default: 1 day** (if all are NULL)

**Best Practice:** Set ONLY ONE interval type:
```sql
-- Good:
UPDATE ai_automation_rules SET 
  time_interval_minutes = 30,
  time_interval_hours = NULL,
  time_interval_days = NULL;

-- Bad (confusing):
UPDATE ai_automation_rules SET 
  time_interval_minutes = 30,
  time_interval_hours = 1,  -- Which one?
  time_interval_days = 1;   -- Too many!
```

---

## ✅ **Summary**

**The system correctly:**
1. ✅ Calculates time threshold from your interval
2. ✅ Finds conversations past that threshold
3. ✅ Uses same interval for cooldown between sends
4. ✅ Logs exact timing in messages
5. ✅ Respects the interval you set

**Your interval setting is followed exactly:**
- Set 30 minutes → Sends every 30 minutes
- Set 1 hour → Sends every 1 hour
- Set 1 day → Sends once per day

**The fix ensures:**
- ✅ Cooldown matches your interval (not hardcoded 24 hours)
- ✅ Repeating sends respect your timing
- ✅ Detailed logs show exact intervals

