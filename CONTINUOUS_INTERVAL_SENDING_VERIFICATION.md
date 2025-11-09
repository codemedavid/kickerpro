# ⚡ Continuous Interval Sending - Verification

## ✅ **Guaranteed: Sends Every Interval, Indefinitely**

After the first message, automation will **automatically trigger again** at each interval.

---

## 🔍 **How It Works (Already Correct)**

### **Code Logic (Lines 251-268 in Cron):**

```typescript
// Check if already processed within the rule's time interval
const cooldownMs = totalMinutes * 60 * 1000;
const { data: recentExecution } = await supabase
  .from('ai_automation_executions')
  .select('id, created_at')
  .eq('rule_id', rule.id)
  .eq('conversation_id', conv.id)
  .gte('created_at', new Date(Date.now() - cooldownMs).toISOString())
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (recentExecution) {
  console.log(`Skipped - already processed ${minutesSince} minutes ago (interval: ${totalMinutes} minutes)`);
  continue;  // Skip this time
}

// If no recent execution → Process and send!
```

**What this means:**
- ✅ Checks if sent within [interval]
- ✅ If yes → Skip
- ✅ If no → Send
- ✅ Repeats this check every cron run
- ✅ **Continuous sending at each interval**

---

## 📊 **Example: 30-Minute Interval**

### **Timeline:**

```
Contact: Prince Cj Lara
Last message: 9:00 AM

─────────────────────────────────────────
Time: 9:30 AM (30 min passed)
├─ Cron runs
├─ Check: Last message 9:00 AM (30 min ago) ✅
├─ Check: No execution in last 30 min ✅
└─ ✅ SEND MESSAGE #1
   Record: created_at = 9:30 AM

─────────────────────────────────────────
Time: 9:31 AM (1 min later)
├─ Cron runs
├─ Check: Last execution 9:30 AM (1 min ago)
├─ Cooldown: Need 30 min, only 1 min passed ❌
└─ ⏭️ SKIP (too soon)

─────────────────────────────────────────
Time: 10:00 AM (30 min since last send)
├─ Cron runs  
├─ Check: Last execution 9:30 AM (30 min ago) ✅
└─ ✅ SEND MESSAGE #2
   Record: created_at = 10:00 AM

─────────────────────────────────────────
Time: 10:30 AM (30 min since last send)
├─ Cron runs
├─ Check: Last execution 10:00 AM (30 min ago) ✅
└─ ✅ SEND MESSAGE #3
   Record: created_at = 10:30 AM

─────────────────────────────────────────
Time: 11:00 AM (30 min since last send)
├─ Cron runs
├─ Check: Last execution 10:30 AM (30 min ago) ✅
└─ ✅ SEND MESSAGE #4
   Record: created_at = 11:00 AM

(Repeats indefinitely every 30 minutes)
```

**Result:** Message #1, #2, #3, #4, #5... continues forever (or until quota/stop)

---

## 🎯 **Key Points**

### **1. First Message Triggers When:**
- ✅ Last message time > interval threshold
- ✅ Has required tag
- ✅ Not stopped
- ✅ Within quota

### **2. Repeat Messages Trigger When:**
- ✅ Last execution time > interval threshold
- ✅ Still has required tag
- ✅ Not stopped
- ✅ Within quota

### **3. Stops When:**
- ❌ Daily quota reached
- ❌ Automation stopped (ai_automation_stops table)
- ❌ Tag removed
- ❌ Rule disabled

### **4. Continues Indefinitely Unless:**
- One of the stop conditions above occurs
- Otherwise → **Sends forever at each interval**

---

## 🧪 **Test: Verify Continuous Sending**

### **Setup (1-Minute Interval for Quick Test):**

```sql
-- Set 1-minute interval for fast testing
UPDATE ai_automation_rules 
SET time_interval_minutes = 1,
    max_messages_per_day = 10,  -- Limit for safety
    run_24_7 = true
WHERE enabled = true;

-- Verify Prince is tagged
SELECT mc.sender_name, ct.tag_id
FROM messenger_conversations mc
JOIN conversation_tags ct ON mc.id = ct.conversation_id
WHERE mc.sender_name = 'Prince Cj Lara';
```

### **Watch It Send Multiple Times:**

```
Minute 0: Trigger cron → ✅ Send #1
Minute 1: Trigger cron → ✅ Send #2 (1 min passed)
Minute 2: Trigger cron → ✅ Send #3 (1 min passed)
Minute 3: Trigger cron → ✅ Send #4 (1 min passed)
...continues...
Minute 9: Trigger cron → ✅ Send #10 (1 min passed)
Minute 10: Trigger cron → ⏭️ Skip (quota reached: 10/10)
```

### **Verify in Database:**

```sql
-- See all sends to Prince with timing
SELECT 
  ae.created_at as sent_at,
  LAG(ae.created_at) OVER (ORDER BY ae.created_at) as previous_send,
  EXTRACT(EPOCH FROM (
    ae.created_at - LAG(ae.created_at) OVER (ORDER BY ae.created_at)
  ))/60 as minutes_between_sends,
  ae.status,
  ae.generated_message
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE mc.sender_name = 'Prince Cj Lara'
  AND ae.status = 'sent'
ORDER BY ae.created_at ASC;
```

**Expected Result:**
```
sent_at              | previous_send       | minutes_between_sends | status | generated_message
---------------------|---------------------|----------------------|--------|-------------------
2025-11-09 10:00:00  | NULL                | NULL                 | sent   | "Hi Prince..."
2025-11-09 10:01:00  | 2025-11-09 10:00:00 | 1                    | sent   | "Hey Prince..."
2025-11-09 10:02:00  | 2025-11-09 10:01:00 | 1                    | sent   | "Kumusta Prince..."
2025-11-09 10:03:00  | 2025-11-09 10:02:00 | 1                    | sent   | "Uy Prince..."
...
```

All `minutes_between_sends` should be exactly your interval setting!

---

## 📋 **The Guarantee**

### **Code Flow for Continuous Sending:**

```
Cron Run #1 (e.g., 10:00 AM)
├─ Find conversations > interval old
├─ Check: Last execution > interval ago?
│   └─ No recent execution found
├─ ✅ SEND MESSAGE
└─ Record: created_at = 10:00 AM

Cron Run #2 (e.g., 10:01 AM)
├─ Find same conversation
├─ Check: Last execution (10:00 AM) > interval ago?
│   └─ No, only 1 minute (need 30)
└─ ⏭️ SKIP

Cron Run #30 (e.g., 10:30 AM)
├─ Find same conversation
├─ Check: Last execution (10:00 AM) > interval ago?
│   └─ Yes! 30 minutes passed ✅
├─ ✅ SEND MESSAGE
└─ Record: created_at = 10:30 AM

Cron Run #60 (e.g., 11:00 AM)
├─ Find same conversation
├─ Check: Last execution (10:30 AM) > interval ago?
│   └─ Yes! 30 minutes passed ✅
├─ ✅ SEND MESSAGE
└─ Record: created_at = 11:00 AM

(Repeats forever unless stopped or quota reached)
```

---

## ⚙️ **Configuration for Continuous Sending**

### **For Testing (Fast Repeats):**

```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 1,    -- Send every 1 minute
    max_messages_per_day = 20,    -- Limit to 20 for safety
    run_24_7 = true,              -- Always active
    include_tag_ids = ARRAY['your-tag-id']  -- Only tagged
WHERE id = 'your-rule-id';
```

Result: Sends to Prince every 1 minute (max 20 times per day)

---

### **For Production (Normal Repeats):**

```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 30,   -- Send every 30 minutes
    max_messages_per_day = 100,   -- Up to 100 per day
    run_24_7 = true,              -- Always active
    include_tag_ids = ARRAY['your-tag-id']
WHERE id = 'your-rule-id';
```

Result: Sends to Prince every 30 minutes (max 100 times per day)

---

## 🛑 **How to Stop Continuous Sending**

### **Option 1: Stop for Specific Contact**
```sql
-- Stop automation for Prince
INSERT INTO ai_automation_stops (rule_id, conversation_id, sender_id, stopped_reason)
VALUES (
  'your-rule-id',
  (SELECT id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara'),
  (SELECT sender_id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara'),
  'manual_stop'
);
```

### **Option 2: Remove Tag**
```sql
-- Remove tag from Prince
DELETE FROM conversation_tags
WHERE conversation_id = (SELECT id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara')
  AND tag_id = 'your-tag-id';
```

### **Option 3: Disable Rule**
```sql
-- Turn off automation
UPDATE ai_automation_rules SET enabled = false WHERE id = 'your-rule-id';
```

### **Option 4: Quota Reached**
- Automatically stops when `max_messages_per_day` is reached
- Resets at midnight (sends again next day)

---

## 📊 **Monitor Continuous Sending**

### **Real-Time Count:**
```sql
-- Count messages sent to Prince today
SELECT 
  COUNT(*) as messages_sent_today,
  MAX(created_at) as last_sent,
  EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/60 as minutes_since_last
FROM ai_automation_executions
WHERE conversation_id = (SELECT id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara')
  AND created_at >= CURRENT_DATE
  AND status = 'sent';
```

### **Send History with Intervals:**
```sql
SELECT 
  created_at as sent_at,
  LAG(created_at) OVER (ORDER BY created_at) as previous_send,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at)))/60 as actual_interval
FROM ai_automation_executions
WHERE conversation_id = (SELECT id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara')
  AND status = 'sent'
ORDER BY created_at ASC;
```

---

## ✅ **Summary:**

**The System Already Does This:**
1. ✅ Sends first message when interval threshold is met
2. ✅ Records execution with timestamp
3. ✅ Checks that timestamp on next cron run
4. ✅ If interval has passed → Sends again
5. ✅ Repeats steps 3-4 forever

**Continuous Sending Guaranteed:**
- ✅ No maximum limit (unless you set `max_messages_per_day`)
- ✅ No hardcoded stops
- ✅ Repeats at each interval
- ✅ Only stops when: quota reached, manually stopped, tag removed, or rule disabled

**Your Interval Setting:**
- Set 1 minute → Sends every minute
- Set 30 minutes → Sends every 30 minutes
- Set 1 hour → Sends every hour
- **Pattern repeats indefinitely** ♾️

---

## 🎯 **Example: Continuous 30-Minute Sends**

```
Day 1:
├─ 10:00 AM → Send #1
├─ 10:30 AM → Send #2
├─ 11:00 AM → Send #3
├─ 11:30 AM → Send #4
├─ 12:00 PM → Send #5
├─ 12:30 PM → Send #6
...continues all day...
└─ 5:00 PM → Send #15

Day 2:
├─ 10:00 AM → Send #16
├─ 10:30 AM → Send #17
...continues indefinitely...
```

**Stops only if:**
- Daily quota reached (e.g., max 100/day)
- You manually stop it
- Tag is removed
- Rule is disabled

---

## 🧪 **Test Continuous Sending (1-Minute Interval)**

Run this complete test to verify continuous sending:

```sql
-- 1. Setup for rapid testing
UPDATE ai_automation_rules 
SET time_interval_minutes = 1,
    max_messages_per_day = 5,  -- Limit to 5 for testing
    run_24_7 = true
WHERE enabled = true;

-- 2. Clear any previous executions for clean test
DELETE FROM ai_automation_executions
WHERE conversation_id = (SELECT id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara');

-- 3. Verify Prince is eligible
SELECT 
  sender_name,
  EXTRACT(EPOCH FROM (NOW() - last_message_time))/60 as minutes_since_last,
  CASE WHEN last_message_time < NOW() - INTERVAL '1 minute' THEN '✅ ELIGIBLE' ELSE '⏱️ Wait' END
FROM messenger_conversations
WHERE sender_name = 'Prince Cj Lara';
```

**Now watch it send 5 times in 5 minutes:**

```bash
# Minute 0: Trigger
curl https://your-domain.vercel.app/api/cron/ai-automations
# → Should send #1

# Minute 1: Trigger (or wait for auto cron)
curl https://your-domain.vercel.app/api/cron/ai-automations
# → Should send #2

# Minute 2: Trigger
curl https://your-domain.vercel.app/api/cron/ai-automations
# → Should send #3

# Minute 3: Trigger
curl https://your-domain.vercel.app/api/cron/ai-automations
# → Should send #4

# Minute 4: Trigger
curl https://your-domain.vercel.app/api/cron/ai-automations
# → Should send #5

# Minute 5: Trigger
curl https://your-domain.vercel.app/api/cron/ai-automations
# → Should skip (quota 5/5 reached)
```

**Verify in Database:**
```sql
-- Should show 5 sends, 1 minute apart each
SELECT 
  created_at,
  status,
  LAG(created_at) OVER (ORDER BY created_at) as prev,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at)))/60 as mins_between
FROM ai_automation_executions
WHERE conversation_id = (SELECT id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara')
  AND status = 'sent'
ORDER BY created_at ASC;
```

**Expected Result:**
```
created_at           | status | prev                | mins_between
---------------------|--------|---------------------|-------------
2025-11-09 10:00:00  | sent   | NULL                | NULL
2025-11-09 10:01:00  | sent   | 2025-11-09 10:00:00 | 1
2025-11-09 10:02:00  | sent   | 2025-11-09 10:01:00 | 1
2025-11-09 10:03:00  | sent   | 2025-11-09 10:02:00 | 1
2025-11-09 10:04:00  | sent   | 2025-11-09 10:03:00 | 1
```

Perfect 1-minute spacing! ✅

---

## 🔒 **Guarantees**

### **What's Guaranteed:**
1. ✅ After first send, cooldown timer starts
2. ✅ Once cooldown expires (interval passed), eligible again
3. ✅ Next cron run will send again
4. ✅ Process repeats indefinitely
5. ✅ No maximum message count (except daily quota)

### **What Would Stop It:**
1. ❌ `max_messages_per_day` reached → Stops until tomorrow
2. ❌ Manual stop added → Stops until you remove it
3. ❌ Tag removed → Stops immediately
4. ❌ Rule disabled → Stops until you enable

### **What Does NOT Stop It:**
- ✅ Number of sends (unlimited)
- ✅ Time of day (if 24/7 mode)
- ✅ Previous sends (just creates cooldown)
- ✅ Contact doesn't reply (continues anyway)

---

## 📊 **Monitoring Continuous Sends**

### **Live Count:**
```sql
-- Count sends to Prince today
SELECT 
  COUNT(*) as total_today,
  MIN(created_at) as first_send,
  MAX(created_at) as last_send,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/60 as duration_minutes,
  COUNT(*) / NULLIF(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/60, 0) as sends_per_minute
FROM ai_automation_executions
WHERE conversation_id = (SELECT id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara')
  AND created_at >= CURRENT_DATE
  AND status = 'sent';
```

### **Check if Still Active:**
```sql
-- Will Prince get another message?
SELECT 
  mc.sender_name,
  ae.created_at as last_sent,
  EXTRACT(EPOCH FROM (NOW() - ae.created_at))/60 as minutes_since_last,
  ar.time_interval_minutes as interval_required,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - ae.created_at))/60 >= ar.time_interval_minutes 
    THEN '✅ ELIGIBLE - Will send on next cron'
    ELSE '⏱️ Wait ' || (ar.time_interval_minutes - EXTRACT(EPOCH FROM (NOW() - ae.created_at))/60)::INTEGER || ' more minutes'
  END as next_send_status
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
JOIN ai_automation_rules ar ON ae.rule_id = ar.id
WHERE mc.sender_name = 'Prince Cj Lara'
  AND ae.status = 'sent'
ORDER BY ae.created_at DESC
LIMIT 1;
```

---

## ⚠️ **Important Considerations**

### **For 1-Minute Interval:**
- ⚡ Very aggressive (60 messages per hour!)
- 😟 May annoy customers
- 🚫 Risk of Facebook blocking
- ✅ Good for testing only

### **Recommended for Production:**
- 30 minutes = 48 messages/day
- 1 hour = 24 messages/day
- 2 hours = 12 messages/day

---

## ✅ **Quick Setup for Continuous Sending**

```sql
-- Complete setup for continuous 30-minute sends
UPDATE ai_automation_rules 
SET time_interval_minutes = 30,     -- Every 30 minutes
    time_interval_hours = NULL,
    time_interval_days = NULL,
    max_messages_per_day = 100,     -- Up to 100 per day
    run_24_7 = true,                -- Always active
    include_tag_ids = ARRAY['your-tag-id']  -- Only tagged
WHERE id = 'your-rule-id';

-- Tag Prince
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES (
  (SELECT id FROM messenger_conversations WHERE sender_name = 'Prince Cj Lara'),
  'your-tag-id'
) ON CONFLICT DO NOTHING;

-- Verify configuration
SELECT 
  name,
  time_interval_minutes || ' minutes' as interval,
  max_messages_per_day || ' per day' as quota,
  run_24_7 as always_active,
  enabled
FROM ai_automation_rules;
```

---

## 🎯 **Final Checklist**

For continuous sending at intervals:

- [ ] Database columns added (`error_message`, etc.)
- [ ] Stuck records cleared
- [ ] 24/7 mode enabled
- [ ] Time interval set (1-60 minutes)
- [ ] Max messages per day set (safety limit)
- [ ] Prince has required tag
- [ ] Rule is enabled
- [ ] Test manual trigger works
- [ ] Verify first send successful
- [ ] Wait for interval to pass
- [ ] Verify second send happens
- [ ] Confirm pattern repeats

---

**✅ The system is designed to send continuously at each interval. After the first send, it will trigger again and again at your specified interval until stopped or quota reached!** ♾️

