# ⚡ AI Automation - 1 Minute Interval Enabled

## ✅ **What Changed**

### **1. Cron Frequency Updated**
Changed from running every **15 minutes** to every **1 minute**.

**vercel.json:**
```json
{
  "crons": [{
    "path": "/api/cron/ai-automations",
    "schedule": "* * * * *"  // Every 1 minute (was: */15 * * * *)
  }]
}
```

### **2. How to Set 1-Minute Interval in Your Rule**

In Supabase SQL Editor:
```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 1,
    time_interval_hours = NULL,
    time_interval_days = NULL,
    run_24_7 = true  -- Optional: runs 24/7
WHERE id = 'your-rule-id';
```

Or from the UI:
- Go to `/dashboard/ai-automations`
- Edit your automation
- Set **Time Interval Minutes** = `1`
- Save

---

## 🚀 **How It Works Now**

### **Timeline with 1-Minute Interval:**

```
10:00:00 → Cron runs → ✅ Send to John (last msg was 10+ min ago)
10:00:00 → Execution recorded for John

10:01:00 → Cron runs → ⏭️ Skip John (only 1 min since last send)
                     → ✅ Send to Sarah (last msg was 5 min ago)

10:02:00 → Cron runs → ✅ Send to John again (1 min passed since 10:00)
                     → ⏭️ Skip Sarah (only 1 min since last send)

10:03:00 → Cron runs → ⏭️ Skip John (only 1 min since 10:02)
                     → ✅ Send to Sarah again (1 min passed since 10:01)
```

### **What Happens Every Minute:**
1. ⏰ Cron triggers at top of every minute
2. 🔍 Finds conversations with last message > 1 minute ago
3. ✅ Excludes conversations sent to in last 1 minute
4. 🤖 Generates AI messages
5. 📤 Sends via Facebook Messenger
6. 📊 Tracks execution

---

## ⚠️ **Important Considerations**

### **1. High Frequency Messaging**
- ⚡ Messages will be sent **every minute** to qualifying conversations
- 💬 This is **VERY aggressive** for customer communication
- 😟 May annoy customers with rapid-fire messages
- 🚫 Risk of Facebook rate limiting

**Recommendation:**
- Use 1-minute intervals only for **testing**
- For production, use **5 minutes minimum** (preferably 15-30 minutes)

### **2. Vercel Cron Limits**
Vercel has execution limits:
- ⏱️ **10 seconds** execution limit per cron run (Hobby plan)
- ⏱️ **60 seconds** execution limit (Pro plan)
- 🔄 **100 executions per day** (Hobby plan)

**With 1-minute cron:**
- 1,440 executions per day (1 per minute × 1,440 minutes)
- ❌ **Exceeds Hobby plan limit** - You need Pro plan

### **3. Facebook API Rate Limits**
Facebook Messenger API has limits:
- 📊 Varies by page size and verification status
- ⚠️ Too many requests → Temporary blocks
- 🚫 Aggressive messaging → Account restrictions

### **4. Google AI API Rate Limits**
- 🤖 15 requests per minute per API key (with 9 keys = 135/min max)
- ⚡ At 1-minute intervals, can process ~135 conversations per cron run
- 📈 More than that → Need to slow down

### **5. Daily Quota Still Applies**
Even with 1-minute intervals, your `max_messages_per_day` limit applies:
```sql
-- Check quota
SELECT 
  name,
  max_messages_per_day,
  success_count as sent_today
FROM ai_automation_rules;
```

If quota = 100/day:
- With 1-min intervals: Quota reached after ~100 conversations
- After that: No more sends until next day

---

## 🎯 **Recommended Intervals by Use Case**

| Use Case | Recommended Interval | Reason |
|----------|---------------------|---------|
| **Testing** | 1 minute | See results quickly |
| **Urgent follow-ups** | 5 minutes | Balance speed & politeness |
| **Active leads** | 15-30 minutes | Standard follow-up cadence |
| **Warm leads** | 1-2 hours | Not too pushy |
| **Cold outreach** | 12-24 hours | Respectful spacing |
| **Re-engagement** | 3-7 days | Give time to respond |

---

## 🧪 **How to Test 1-Minute Interval**

### **Step 1: Create Test Rule**
```sql
INSERT INTO ai_automation_rules (
  user_id,
  name,
  description,
  enabled,
  time_interval_minutes,
  custom_prompt,
  message_tag,
  max_messages_per_day,
  run_24_7
) VALUES (
  'YOUR_USER_ID',
  'Test - 1 Minute',
  'Testing 1-minute automation',
  true,
  1,  -- 1 minute interval
  'Send a quick friendly hello in one sentence.',
  'ACCOUNT_UPDATE',
  5,  -- Low quota for testing
  true  -- 24/7 mode
);
```

### **Step 2: Monitor Execution**
Watch Vercel logs in real-time:
1. Go to Vercel Dashboard → Logs
2. Every minute, you should see:
```
[AI Automation Cron] 🚀 Starting scheduled execution
[AI Automation Cron] Found 1 enabled rule(s)
[AI Automation Cron] ✅ Execution completed
  Messages Sent: X
```

### **Step 3: Check Database**
```sql
-- See executions spacing
SELECT 
  created_at,
  status,
  LAG(created_at) OVER (ORDER BY created_at) as prev_execution,
  EXTRACT(EPOCH FROM (
    created_at - LAG(created_at) OVER (ORDER BY created_at)
  ))/60 as minutes_between
FROM ai_automation_executions
WHERE rule_id = 'test-rule-id'
ORDER BY created_at DESC
LIMIT 10;
```

Expected: `minutes_between` should be ~1 minute

### **Step 4: Check Facebook Messages**
- Open Messenger
- Check test conversation
- Should see new message every minute (if eligible)

---

## 🛑 **How to Slow Down (If Too Fast)**

### **Option 1: Change Interval to 5 Minutes**
```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 5
WHERE id = 'your-rule-id';
```

### **Option 2: Change Cron to Every 5 Minutes**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/ai-automations",
    "schedule": "*/5 * * * *"  // Every 5 minutes
  }]
}
```

### **Option 3: Disable Rule Temporarily**
```sql
UPDATE ai_automation_rules 
SET enabled = false
WHERE id = 'your-rule-id';
```

---

## 📊 **Comparison: Different Cron Frequencies**

| Cron Schedule | Runs Per Day | Best For | Vercel Plan |
|---------------|--------------|----------|-------------|
| `* * * * *` (1 min) | 1,440 | Testing only | Pro required |
| `*/5 * * * *` (5 min) | 288 | Urgent follow-ups | Pro recommended |
| `*/15 * * * *` (15 min) | 96 | Standard use | Hobby OK |
| `*/30 * * * *` (30 min) | 48 | Relaxed cadence | Hobby OK |
| `0 * * * *` (1 hour) | 24 | Light usage | Hobby OK |

---

## ⚡ **Current Setup Summary**

After this update:
- ✅ Cron runs **every 1 minute**
- ✅ Can set rules with `time_interval_minutes = 1`
- ⚠️ Very aggressive - use for testing only
- 📊 Vercel Pro plan recommended

---

## 🔄 **Reverting to 15-Minute Cron**

If 1-minute is too frequent, revert with:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/ai-automations",
    "schedule": "*/15 * * * *"  // Back to 15 minutes
  }]
}
```

Then:
```bash
git add vercel.json
git commit -m "revert: change cron back to 15 minutes"
git push origin main
```

---

## 📝 **Best Practices**

### **For Testing:**
1. ✅ Use 1-minute interval
2. ✅ Set low quota (5-10 messages)
3. ✅ Test with 1-2 conversations
4. ✅ Monitor Vercel logs
5. ✅ Change to longer interval after testing

### **For Production:**
1. ✅ Use 15-30 minute intervals minimum
2. ✅ Set reasonable quotas (50-100/day)
3. ✅ Monitor customer feedback
4. ✅ Adjust based on response rates
5. ✅ Consider time zones

---

## 🚀 **Deploy Instructions**

```bash
git add vercel.json
git commit -m "feat: enable 1-minute cron for AI automations

- Changed schedule from */15 to * * * * *
- Allows testing 1-minute intervals
- Requires Vercel Pro plan for execution limits"
git push origin main
```

After deployment:
1. Wait 1 minute
2. Check Vercel logs
3. Should see cron running every minute
4. Test with 1-minute interval rule

---

## ⚠️ **Final Warning**

**1-minute intervals are VERY aggressive for customer messaging!**

Recommended usage:
- ✅ Testing and development
- ✅ Urgent, time-sensitive scenarios
- ✅ Internal testing conversations
- ❌ NOT for regular customer communication
- ❌ NOT for cold outreach
- ❌ NOT for long-term use

**Use 15-30 minute intervals for production!**

---

**✅ 1-minute interval is now possible! Deploy and test carefully.** ⚡

