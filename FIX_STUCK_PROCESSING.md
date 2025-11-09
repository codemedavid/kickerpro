# 🔍 Automation Stuck in "Processing" - Diagnostic & Fix

## 🚨 **Problem Identified**

Your UI shows:
- Status: "recently_sent" 
- State: "Processing"
- Active Processing: 50

But:
- ❌ No messages are actually being generated
- ❌ No messages are being sent
- ❌ Stuck in processing state

---

## 🎯 **Most Likely Causes**

### **1. Cron Job Not Actually Running** (80% probability)
Vercel cron may not be triggering the endpoint

### **2. Outside Active Hours** (10% probability)
Rule skipped due to time restrictions

### **3. Stuck Execution Records** (5% probability)
Old records blocking new executions

### **4. Facebook Token Expired** (3% probability)
Can't send messages to Facebook

### **5. AI API Error** (2% probability)
Can't generate messages

---

## 🔧 **IMMEDIATE FIXES**

Run these in Supabase SQL Editor:

### **Fix 1: Clear Stuck Records**

```sql
-- Clear any stuck processing records
UPDATE ai_automation_executions
SET status = 'failed',
    error_message = 'Execution timed out - cleared',
    executed_at = NOW()
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '5 minutes';

-- Check how many were cleared
SELECT 
  'Cleared stuck records' as action,
  COUNT(*) as count
FROM ai_automation_executions
WHERE error_message = 'Execution timed out - cleared';
```

### **Fix 2: Clear Old Monitoring States**

```sql
-- Clear old monitoring states (these cause "Active Processing" count)
DELETE FROM ai_automation_contact_states
WHERE updated_at < NOW() - INTERVAL '10 minutes';

SELECT 'Cleared old monitoring states' as action;
```

### **Fix 3: Enable 24/7 Mode**

```sql
-- Ensure automation runs regardless of time
UPDATE ai_automation_rules 
SET run_24_7 = true
WHERE enabled = true;

SELECT 'Enabled 24/7 mode' as action;
```

### **Fix 4: Reset Execution Tracker**

```sql
-- Reset last_executed_at to force fresh execution
UPDATE ai_automation_rules
SET last_executed_at = NULL
WHERE enabled = true;

SELECT 'Reset execution tracker' as action;
```

---

## 🧪 **Manual Test Trigger**

After running the fixes above, test manually:

### **Method 1: Browser**
Visit: `https://your-domain.vercel.app/api/cron/ai-automations`

### **Method 2: Command Line**
```bash
curl https://your-domain.vercel.app/api/cron/ai-automations
```

### **Expected Response:**
```json
{
  "success": true,
  "rules_processed": 1,
  "messages_processed": 1,
  "messages_sent": 1,
  "messages_failed": 0
}
```

---

## 📊 **Check Vercel Cron Logs**

### **Where to Look:**
1. Go to Vercel Dashboard
2. Click on your project
3. Click "Logs" tab
4. Filter time to last 30 minutes
5. Search for: `[AI Automation Cron]`

### **What You Should See:**
```
✅ GOOD (Cron is running):
[AI Automation Cron] 🚀 Starting scheduled execution
[AI Automation Cron] Found 1 enabled rule(s)
[AI Automation Cron] Processing rule: Your Rule Name
[AI Automation Cron] ✅ Execution completed
  Messages Sent: 1

❌ BAD (Cron NOT running):
No logs with "[AI Automation Cron]" at all
```

### **If No Logs:**
Vercel cron might not be triggering. Check:
1. Vercel Dashboard → Settings → Cron Jobs
2. Should show: `/api/cron/ai-automations` with schedule `* * * * *`
3. If missing → Need to redeploy

---

## 🔍 **Deep Diagnostic Queries**

Run `debug-cron-execution.sql` in Supabase to get complete diagnostic.

Or run these individually:

### **Check 1: When Did Cron Last Run?**
```sql
SELECT 
  name,
  last_executed_at,
  NOW() - last_executed_at as time_since,
  CASE 
    WHEN last_executed_at IS NULL THEN '❌ NEVER RAN'
    WHEN last_executed_at < NOW() - INTERVAL '5 minutes' THEN '❌ NOT RUNNING'
    ELSE '✅ RUNNING'
  END as status
FROM ai_automation_rules WHERE enabled = true;
```

### **Check 2: Prince Cj Lara Status**
```sql
SELECT 
  ae.created_at,
  ae.status,
  ae.generated_message IS NOT NULL as has_message,
  ae.facebook_message_id IS NOT NULL as sent_to_facebook,
  ae.error_message,
  NOW() - ae.created_at as age
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE mc.sender_name = 'Prince Cj Lara'
ORDER BY ae.created_at DESC
LIMIT 5;
```

### **Check 3: Current Hour vs Active Hours**
```sql
SELECT 
  name,
  run_24_7,
  active_hours_start,
  active_hours_end,
  EXTRACT(HOUR FROM NOW()) as current_hour,
  CASE 
    WHEN run_24_7 THEN '✅ Will run (24/7 mode)'
    WHEN EXTRACT(HOUR FROM NOW()) >= active_hours_start 
     AND EXTRACT(HOUR FROM NOW()) < active_hours_end 
    THEN '✅ Will run (within hours)'
    ELSE '❌ WILL BE SKIPPED (outside hours) ← THIS IS THE PROBLEM'
  END as execution_status
FROM ai_automation_rules WHERE enabled = true;
```

---

## 🚀 **Quick Fix Bundle (Run All)**

```sql
-- Run all these together for comprehensive fix:

-- 1. Clear stuck records
UPDATE ai_automation_executions
SET status = 'failed', error_message = 'Cleared - was stuck', executed_at = NOW()
WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes';

-- 2. Clear old monitoring
DELETE FROM ai_automation_contact_states WHERE updated_at < NOW() - INTERVAL '10 minutes';

-- 3. Enable 24/7 mode
UPDATE ai_automation_rules SET run_24_7 = true WHERE enabled = true;

-- 4. Reset tracker
UPDATE ai_automation_rules SET last_executed_at = NULL WHERE enabled = true;

-- 5. Verify configuration
SELECT 
  name,
  enabled,
  run_24_7,
  time_interval_minutes,
  include_tag_ids,
  last_executed_at
FROM ai_automation_rules;

-- 6. Count eligible contacts
SELECT COUNT(*) as eligible_contacts
FROM messenger_conversations mc
JOIN conversation_tags ct ON mc.id = ct.conversation_id
WHERE ct.tag_id = ANY((SELECT include_tag_ids FROM ai_automation_rules WHERE enabled = true LIMIT 1))
  AND mc.last_message_time < NOW() - INTERVAL '30 minutes';
```

---

## 🎯 **Test Immediately**

After running fixes:

```bash
# Trigger cron manually
curl https://your-domain.vercel.app/api/cron/ai-automations
```

Expected response with actual processing:
```json
{
  "success": true,
  "messages_sent": 1,
  "results": [
    {
      "rule_name": "Your Rule",
      "status": "executed",
      "messages_sent": 1
    }
  ]
}
```

---

## 📋 **Checklist**

- [ ] Run Fix 1: Clear stuck records
- [ ] Run Fix 2: Clear old monitoring
- [ ] Run Fix 3: Enable 24/7 mode
- [ ] Run Fix 4: Reset tracker
- [ ] Test: Call `/api/cron/ai-automations` manually
- [ ] Check: Vercel logs show execution
- [ ] Check: Database has new execution record
- [ ] Verify: Facebook received message
- [ ] Confirm: Prince Cj Lara got message

---

## 🚨 **If Still Not Working**

Share these diagnostics:

1. **Output of debug-cron-execution.sql**
2. **Vercel logs** (screenshot or copy)
3. **Result of manual trigger** (curl response)
4. **Your automation settings** (from ai_automation_rules)

This will help identify the exact blocking issue!

