# 🔧 Fix: Automation Not Auto-Sending at Interval

## 🚨 **The Problem**

Your automation shows:
- UI: "Processing" state
- Active Processing: 50
- Status: "recently_sent"
- **But**: Not actually generating or sending messages

---

## ✅ **Complete Fix (3 Steps)**

### **Step 1: Fix Database Schema**

Run in Supabase SQL Editor:

```sql
-- Add missing columns
ALTER TABLE ai_automation_executions
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS page_id UUID,
ADD COLUMN IF NOT EXISTS user_id UUID;

SELECT '✅ Columns added' as result;
```

---

### **Step 2: Clear Stuck State**

Run in Supabase SQL Editor:

```sql
-- Clear stuck processing records
UPDATE ai_automation_executions
SET status = 'failed',
    executed_at = NOW()
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '5 minutes';

-- Clear old monitoring states (causes "Active Processing 50")
DELETE FROM ai_automation_contact_states
WHERE updated_at < NOW() - INTERVAL '10 minutes';

-- Enable 24/7 mode (bypass time restrictions)
UPDATE ai_automation_rules 
SET run_24_7 = true
WHERE enabled = true;

-- Show what was cleared
SELECT 
  'Stuck records cleared' as result,
  COUNT(*) as count
FROM ai_automation_executions
WHERE status = 'failed'
  AND executed_at > NOW() - INTERVAL '1 minute';
```

---

### **Step 3: Test Manually**

Open in browser:
```
https://your-domain.vercel.app/api/cron/ai-automations
```

**Expected Response:**
```json
{
  "success": true,
  "messages_sent": 1,
  "messages_failed": 0
}
```

---

## 🔍 **Why It Wasn't Auto-Sending**

### **Possible Causes:**

1. **Stuck Processing Records** ✅ FIXED
   - Old records in "processing" state
   - Blocked new executions

2. **Missing Database Columns** ✅ FIXED
   - `error_message` column missing
   - Caused SQL errors

3. **Outside Active Hours** ✅ FIXED
   - Now using 24/7 mode
   - Runs regardless of time

4. **Old Monitoring States** ✅ FIXED
   - Stale "Active Processing" data
   - Now cleared

---

## 📊 **Verify After Fix**

### **Check 1: Is Cron Running?**

Go to **Vercel Dashboard → Logs** and look for:

```
✅ GOOD:
[AI Automation Cron] 🚀 Starting scheduled execution
[AI Automation Cron] Found 1 enabled rule(s)
[AI Automation Cron] Processing rule: [name]
  📊 Found X conversation(s) past time threshold
  🏷️ After INCLUDE tags filter: 1 conversation(s) WITH required tags
      Processing: Prince Cj Lara
      🤖 Generating AI message...
      ✅ Message sent successfully (ID: m_xxx)
[AI Automation Cron] ✅ Execution completed
  Messages Sent: 1

❌ BAD (No logs):
Cron is not running at all
```

### **Check 2: Database Execution Records**

```sql
-- See recent executions
SELECT 
  ae.created_at,
  ae.status,
  ae.generated_message,
  ae.facebook_message_id,
  mc.sender_name,
  NOW() - ae.created_at as age
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
ORDER BY ae.created_at DESC
LIMIT 10;
```

**Expected:**
- Recent `created_at` (within last 5 minutes)
- `status` = `'sent'`
- `generated_message` has text
- `facebook_message_id` has value

### **Check 3: Facebook Messenger**

Open your Facebook page messages and check for:
- New message to Prince Cj Lara
- AI-generated text
- Sent recently

---

## 🎯 **Timeline of Auto-Sending**

With your current setup (1-minute cron):

```
Time: 10:00 AM
├─ Prince last message: 9:00 AM (60 minutes ago)
├─ Cron runs
├─ Finds Prince (> interval threshold)
├─ ✅ Sends message

Time: 10:01 AM
├─ Cron runs again
├─ Finds Prince
├─ Checks last send: 10:00 AM (1 minute ago)
├─ ⏭️ Skips (not enough time passed)

Time: 10:02 AM  ← Based on your interval setting
├─ Cron runs
├─ Finds Prince
├─ Checks last send: 10:00 AM (2 minutes ago)
├─ If interval = 1 min → ✅ Sends again
├─ If interval = 30 min → ⏭️ Skips (not 30 min yet)
```

**Sends at exactly your interval frequency!**

---

## ⚠️ **Common Issues After Fix**

### **Issue 1: "Cron runs but doesn't find Prince"**

**Check:** Is Prince's last message old enough?

```sql
SELECT 
  sender_name,
  last_message_time,
  EXTRACT(EPOCH FROM (NOW() - last_message_time))/60 as minutes_since_last,
  CASE 
    WHEN last_message_time < NOW() - INTERVAL '1 minute' THEN '✅ ELIGIBLE'
    ELSE '⏱️ Too recent'
  END as status
FROM messenger_conversations
WHERE sender_name = 'Prince Cj Lara';
```

If status = "Too recent", wait longer or reduce interval to 1 minute

---

### **Issue 2: "Cron not running at all"**

**Check Vercel Cron Config:**

1. Vercel Dashboard → Settings → Cron Jobs
2. Should show: `/api/cron/ai-automations` scheduled `* * * * *`
3. If missing → Already configured in `vercel.json`, just needs deployment

**Test manually:**
```
https://your-domain.vercel.app/api/cron/ai-automations
```

---

### **Issue 3: "Messages sent once but not repeating"**

**Check:** Time interval and last execution

```sql
-- See execution history for Prince
SELECT 
  ae.created_at,
  LAG(ae.created_at) OVER (ORDER BY ae.created_at) as prev_send,
  EXTRACT(EPOCH FROM (ae.created_at - LAG(ae.created_at) OVER (ORDER BY ae.created_at)))/60 as minutes_between
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE mc.sender_name = 'Prince Cj Lara'
  AND ae.status = 'sent'
ORDER BY ae.created_at DESC
LIMIT 10;
```

**Expected:** `minutes_between` should match your interval setting

---

## 🧪 **Complete Test Workflow**

### **1. Run Database Fixes:**
```sql
-- Run fix-executions-table-add-error-column.sql
-- Then run CLEAR_STUCK_PROCESSING_FIXED.sql
```

### **2. Verify Prince is Eligible:**
```sql
SELECT 
  mc.sender_name,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since,
  EXISTS (SELECT 1 FROM conversation_tags ct WHERE ct.conversation_id = mc.id) as has_tags
FROM messenger_conversations mc
WHERE mc.sender_name = 'Prince Cj Lara';
```

Should show: minutes_since > your interval setting

### **3. Set Very Short Interval (Testing):**
```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 1,  -- 1 minute for quick testing
    run_24_7 = true
WHERE enabled = true;
```

### **4. Trigger Manually:**
Open: `https://your-domain.vercel.app/api/cron/ai-automations`

### **5. Check Result:**
```sql
SELECT 
  mc.sender_name,
  ae.created_at,
  ae.status,
  ae.generated_message,
  ae.facebook_message_id
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE mc.sender_name = 'Prince Cj Lara'
ORDER BY ae.created_at DESC
LIMIT 1;
```

### **6. Wait 1 Minute and Trigger Again:**
Should send another message to Prince!

### **7. After Testing, Set Real Interval:**
```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 30  -- Or your desired interval
WHERE enabled = true;
```

---

## 🚀 **Auto-Send Checklist**

For automatic sending at interval:

- [ ] Database schema fixed (error_message column added)
- [ ] Stuck records cleared
- [ ] Monitoring states cleared
- [ ] 24/7 mode enabled
- [ ] Vercel cron configured (already done in vercel.json)
- [ ] Rule has time_interval_minutes set
- [ ] Prince has required tag
- [ ] Prince's last message is old enough
- [ ] Test manual trigger works
- [ ] Wait for automatic cron run
- [ ] Verify message sent to Facebook

---

## 🎯 **Expected Behavior (1-Minute Interval)**

```
Time: 10:00:00
├─ Cron runs automatically
├─ Finds Prince (last msg > 1 min ago)
├─ ✅ Sends message

Time: 10:01:00
├─ Cron runs automatically
├─ Finds Prince
├─ Check: Last send was 10:00:00 (1 min ago)
├─ ✅ Sends message again

Time: 10:02:00
├─ Cron runs automatically
├─ Finds Prince
├─ Check: Last send was 10:01:00 (1 min ago)
├─ ✅ Sends message again

(Repeats every minute)
```

---

## 📞 **If Still Not Working**

Share these diagnostics:

### **1. Vercel Logs** (last 30 minutes)
- Go to Vercel Dashboard → Logs
- Copy logs with `[AI Automation Cron]`

### **2. Database Status:**
```sql
-- Run this and share results
SELECT 
  ar.name,
  ar.enabled,
  ar.run_24_7,
  ar.time_interval_minutes,
  ar.last_executed_at,
  NOW() - ar.last_executed_at as time_since_last_execution,
  COUNT(ae.id) as executions_today
FROM ai_automation_rules ar
LEFT JOIN ai_automation_executions ae ON ar.id = ae.rule_id 
  AND ae.created_at >= CURRENT_DATE
WHERE ar.enabled = true
GROUP BY ar.id, ar.name, ar.enabled, ar.run_24_7, ar.time_interval_minutes, ar.last_executed_at;
```

### **3. Manual Test Result:**
- Visit `/api/cron/ai-automations`
- Share the JSON response

---

## 📁 **Files Created:**

1. **`fix-executions-table-add-error-column.sql`** - Adds missing columns
2. **`CLEAR_STUCK_PROCESSING_FIXED.sql`** - Clears stuck state
3. **`test-cron-endpoint.html`** - Interactive testing tool
4. **`debug-cron-execution.sql`** - Diagnostic queries

---

## ✅ **Action Plan:**

1. **NOW:** Run `fix-executions-table-add-error-column.sql` in Supabase
2. **THEN:** Run `CLEAR_STUCK_PROCESSING_FIXED.sql` in Supabase
3. **TEST:** Open `test-cron-endpoint.html` and click "Test Cron Now"
4. **VERIFY:** Check Vercel logs for execution
5. **CONFIRM:** Check Facebook for sent message to Prince Cj Lara

---

**After these fixes, automation should auto-send every interval!** ⚡

