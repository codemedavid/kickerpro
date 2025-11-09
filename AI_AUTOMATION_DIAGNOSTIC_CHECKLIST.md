# 🔍 AI Automation Not Triggering - Diagnostic Checklist

## Step 1: Verify Vercel Deployment ✅

### **Check Deployment Status:**
1. Go to Vercel Dashboard → Your Project
2. Check latest deployment status
3. Verify commit `b54a17e` deployed successfully
4. Look for: ✅ **"Deployment Ready"**

### **If Deployment Failed:**
- Share the build error logs
- We'll fix any remaining issues

---

## Step 2: Check if Cron Job is Running 🔄

### **Method 1: Vercel Logs (Real-time)**
1. Go to Vercel Dashboard → Your Project → **Logs**
2. Wait for next cron time (runs at :00, :15, :30, :45)
3. Look for these log messages:

```
✅ SHOULD SEE THIS:
[AI Automation Cron] 🚀 Starting scheduled execution at [timestamp]
[AI Automation Cron] Found X enabled rule(s)
[AI Automation Cron] ✅ Execution completed

❌ IF YOU DON'T SEE THIS:
Cron is not running at all - Need to check Vercel Cron configuration
```

### **Method 2: Manual Test**
Call the cron endpoint manually to test immediately:

```bash
# Test the endpoint directly
curl https://your-domain.vercel.app/api/cron/ai-automations
```

**Expected Response:**
```json
{
  "success": true,
  "message": "AI automations cron job executed",
  "rules_processed": 1,
  "messages_processed": 3,
  "messages_sent": 2,
  "messages_failed": 1
}
```

---

## Step 3: Verify Automation Rules Configuration 📋

### **Check Your Rules in Supabase:**

```sql
-- 1. Check if you have enabled rules
SELECT 
  id,
  name,
  enabled,
  time_interval_minutes,
  time_interval_hours,
  time_interval_days,
  active_hours_start,
  active_hours_end,
  run_24_7,
  max_messages_per_day,
  last_executed_at,
  execution_count
FROM ai_automation_rules
WHERE enabled = true
ORDER BY created_at DESC;
```

**What to Check:**
- ✅ `enabled` = `true`
- ✅ `time_interval_minutes` or `time_interval_hours` or `time_interval_days` is set
- ✅ `active_hours_start` and `active_hours_end` match current time (or `run_24_7` = `true`)
- ✅ `max_messages_per_day` > 0

**Common Issues:**
- ❌ `enabled = false` → Enable the rule
- ❌ Outside active hours → Set `run_24_7 = true` or adjust hours
- ❌ No time interval set → Set time_interval_minutes

---

## Step 4: Check Current Time vs Active Hours ⏰

### **What time is it now?**
```sql
SELECT 
  EXTRACT(HOUR FROM NOW()) as current_hour_utc,
  EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Manila') as current_hour_manila,
  NOW() as current_time_utc,
  NOW() AT TIME ZONE 'Asia/Manila' as current_time_manila;
```

### **Compare with your automation rules:**
```sql
SELECT 
  name,
  active_hours_start,
  active_hours_end,
  run_24_7,
  EXTRACT(HOUR FROM NOW()) as current_hour,
  CASE 
    WHEN run_24_7 THEN '✅ Active (24/7 mode)'
    WHEN EXTRACT(HOUR FROM NOW()) >= active_hours_start 
     AND EXTRACT(HOUR FROM NOW()) < active_hours_end 
    THEN '✅ Within active hours'
    ELSE '❌ OUTSIDE active hours - WILL BE SKIPPED'
  END as status
FROM ai_automation_rules
WHERE enabled = true;
```

**Fix if Outside Hours:**
```sql
-- Option 1: Enable 24/7 mode
UPDATE ai_automation_rules 
SET run_24_7 = true 
WHERE id = 'your-rule-id';

-- Option 2: Adjust active hours to include current time
UPDATE ai_automation_rules 
SET active_hours_start = 0, active_hours_end = 23
WHERE id = 'your-rule-id';
```

---

## Step 5: Check Daily Quota ⚡

### **How many messages sent today?**
```sql
SELECT 
  ar.name,
  ar.max_messages_per_day as quota,
  COUNT(ae.id) FILTER (WHERE ae.status = 'sent') as sent_today,
  ar.max_messages_per_day - COUNT(ae.id) FILTER (WHERE ae.status = 'sent') as remaining,
  CASE 
    WHEN COUNT(ae.id) FILTER (WHERE ae.status = 'sent') >= ar.max_messages_per_day 
    THEN '❌ QUOTA REACHED - NO MORE MESSAGES TODAY'
    ELSE '✅ Quota available'
  END as quota_status
FROM ai_automation_rules ar
LEFT JOIN ai_automation_executions ae ON ar.id = ae.rule_id 
  AND ae.created_at >= CURRENT_DATE
WHERE ar.enabled = true
GROUP BY ar.id, ar.name, ar.max_messages_per_day;
```

**Fix if Quota Reached:**
```sql
-- Increase daily quota
UPDATE ai_automation_rules 
SET max_messages_per_day = 100 
WHERE id = 'your-rule-id';
```

---

## Step 6: Check for Eligible Conversations 👥

### **Do you have conversations that match the criteria?**

```sql
-- Replace these with your actual values:
-- YOUR_USER_ID: Your user ID
-- TIME_THRESHOLD: How long ago messages should be (e.g., 30 minutes)

-- Check conversations that should be eligible
SELECT 
  mc.id,
  mc.sender_name,
  mc.last_message_time,
  NOW() - mc.last_message_time as time_since_last_message,
  mc.tag_ids,
  CASE 
    WHEN mc.last_message_time < NOW() - INTERVAL '30 minutes' 
    THEN '✅ Eligible (inactive > 30 mins)'
    ELSE '❌ Too recent'
  END as eligibility_status
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'
  AND mc.last_message_time IS NOT NULL
ORDER BY mc.last_message_time DESC
LIMIT 20;
```

**Common Issues:**
- ❌ No conversations found → Sync conversations from Facebook
- ❌ All conversations too recent → Wait for time threshold
- ❌ Conversations don't have required tags → Add tags or remove tag filters

### **Check Tag Filters:**
```sql
-- See if tag filters are blocking conversations
SELECT 
  name,
  include_tag_ids,
  exclude_tag_ids,
  CASE 
    WHEN include_tag_ids IS NOT NULL AND array_length(include_tag_ids, 1) > 0
    THEN '⚠️ Only conversations WITH these tags will be processed'
    WHEN exclude_tag_ids IS NOT NULL AND array_length(exclude_tag_ids, 1) > 0
    THEN '⚠️ Conversations WITH these tags will be SKIPPED'
    ELSE '✅ No tag filters - all conversations eligible'
  END as tag_filter_impact
FROM ai_automation_rules
WHERE enabled = true;
```

**Fix Tag Filters:**
```sql
-- Remove tag filters (process all conversations)
UPDATE ai_automation_rules 
SET include_tag_ids = NULL, exclude_tag_ids = NULL
WHERE id = 'your-rule-id';
```

---

## Step 7: Check Recent Execution History 📊

### **Has the automation ever executed?**
```sql
SELECT 
  ar.name as rule_name,
  ae.conversation_id,
  mc.sender_name,
  ae.status,
  ae.generated_message,
  ae.error_message,
  ae.created_at,
  ae.executed_at
FROM ai_automation_executions ae
JOIN ai_automation_rules ar ON ae.rule_id = ar.id
LEFT JOIN messenger_conversations mc ON ae.conversation_id = mc.id
ORDER BY ae.created_at DESC
LIMIT 20;
```

**What to Check:**
- ✅ Rows exist → Cron has run at least once
- ❌ No rows → Cron hasn't executed yet or failed silently
- ⚠️ `status = 'failed'` → Check `error_message` column

### **Check if conversations already processed:**
```sql
-- See which conversations were processed in last 24 hours
SELECT 
  mc.sender_name,
  ae.status,
  ae.created_at as processed_at,
  NOW() - ae.created_at as time_since_processed,
  CASE 
    WHEN ae.created_at > NOW() - INTERVAL '24 hours'
    THEN '⏭️ Recently processed - will be SKIPPED until 24h pass'
    ELSE '✅ Can be processed again'
  END as reprocess_status
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ae.rule_id = 'your-rule-id'
ORDER BY ae.created_at DESC;
```

---

## Step 8: Check Facebook Pages & Tokens 🔑

### **Are Facebook pages connected?**
```sql
SELECT 
  page_name,
  page_id,
  access_token IS NOT NULL as has_token,
  LENGTH(access_token) as token_length,
  created_at
FROM facebook_pages
WHERE user_id = 'YOUR_USER_ID';
```

**Issues:**
- ❌ No pages → Connect Facebook page first
- ❌ `has_token = false` → Reconnect Facebook page
- ⚠️ `token_length < 100` → Token might be invalid

---

## Step 9: Test with Simplified Settings 🧪

### **Create a Test Rule with Guaranteed Execution:**

```sql
-- Insert test automation rule
INSERT INTO ai_automation_rules (
  user_id,
  name,
  description,
  enabled,
  time_interval_minutes,
  custom_prompt,
  message_tag,
  max_messages_per_day,
  active_hours_start,
  active_hours_end,
  run_24_7,
  include_tag_ids,
  exclude_tag_ids
) VALUES (
  'YOUR_USER_ID',
  'Test Automation - 15 Minutes',
  'Test rule that should trigger every cron run',
  true,
  15,  -- Very short interval
  'Send a quick friendly follow-up in casual English. Keep it to 1-2 sentences.',
  'ACCOUNT_UPDATE',
  50,
  0,
  23,
  true,  -- 24/7 mode
  NULL,  -- No tag filters
  NULL   -- No exclusions
);
```

This test rule:
- ✅ Runs 24/7
- ✅ 15-minute interval (catches recent conversations)
- ✅ No tag filters (processes all conversations)
- ✅ High quota (50/day)
- ✅ Simple prompt

Wait 15 minutes and check if it executes.

---

## Step 10: Check Environment Variables 🔐

### **Required Environment Variables:**
```bash
# Check these are set in Vercel:
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # CRITICAL for cron
GOOGLE_AI_API_KEY=AIzaSy...  # For AI generation

# Optional:
CRON_SECRET=your-secret  # If set, cron needs Authorization header
```

**Critical:**
- ❌ Missing `SUPABASE_SERVICE_ROLE_KEY` → Cron can't access database
- ❌ Missing `GOOGLE_AI_API_KEY` → Can't generate messages
- ⚠️ `CRON_SECRET` set → May block Vercel Cron

**To Check in Vercel:**
1. Go to Project Settings → Environment Variables
2. Verify all variables are set for **Production**

---

## Quick Diagnostic Script 🚀

Run this in Supabase SQL Editor to get a complete diagnostic:

```sql
-- ===== DIAGNOSTIC REPORT =====
SELECT '1. ENABLED RULES' as section;
SELECT 
  name,
  enabled,
  run_24_7,
  time_interval_minutes,
  EXTRACT(HOUR FROM NOW()) as current_hour,
  active_hours_start || '-' || active_hours_end as active_window,
  max_messages_per_day as quota,
  last_executed_at
FROM ai_automation_rules
WHERE enabled = true;

SELECT '2. DAILY QUOTA USAGE' as section;
SELECT 
  ar.name,
  COUNT(*) FILTER (WHERE ae.created_at >= CURRENT_DATE AND ae.status = 'sent') as used_today,
  ar.max_messages_per_day as total_quota,
  ar.max_messages_per_day - COUNT(*) FILTER (WHERE ae.created_at >= CURRENT_DATE AND ae.status = 'sent') as remaining
FROM ai_automation_rules ar
LEFT JOIN ai_automation_executions ae ON ar.id = ae.rule_id
WHERE ar.enabled = true
GROUP BY ar.id, ar.name, ar.max_messages_per_day;

SELECT '3. ELIGIBLE CONVERSATIONS (last 30 mins)' as section;
SELECT 
  COUNT(*) as total_conversations,
  COUNT(*) FILTER (WHERE last_message_time < NOW() - INTERVAL '30 minutes') as eligible_30min,
  COUNT(*) FILTER (WHERE last_message_time < NOW() - INTERVAL '1 hour') as eligible_1hour,
  COUNT(*) FILTER (WHERE last_message_time < NOW() - INTERVAL '24 hours') as eligible_24hour
FROM messenger_conversations;

SELECT '4. RECENT EXECUTIONS' as section;
SELECT 
  ar.name,
  ae.status,
  ae.error_message,
  ae.created_at
FROM ai_automation_executions ae
JOIN ai_automation_rules ar ON ae.rule_id = ar.id
WHERE ae.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY ae.created_at DESC
LIMIT 10;

SELECT '5. FACEBOOK PAGES' as section;
SELECT 
  page_name,
  access_token IS NOT NULL as has_token
FROM facebook_pages;
```

---

## Common Solutions 💡

### **Issue: Cron runs but no messages sent**

**Solution 1: Enable 24/7 mode**
```sql
UPDATE ai_automation_rules 
SET run_24_7 = true 
WHERE enabled = true;
```

**Solution 2: Reduce time interval**
```sql
UPDATE ai_automation_rules 
SET time_interval_minutes = 15  -- Very short for testing
WHERE enabled = true;
```

**Solution 3: Remove tag filters**
```sql
UPDATE ai_automation_rules 
SET include_tag_ids = NULL, exclude_tag_ids = NULL
WHERE enabled = true;
```

### **Issue: Cron doesn't run at all**

**Solution: Verify Vercel Cron Config**
Check `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/ai-automations",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Redeploy if missing.

---

## Need Help? Share These Results 📋

Please share:
1. ✅ Vercel deployment status (success/failed)
2. ✅ Output of diagnostic SQL script above
3. ✅ Screenshot of Vercel logs around :00, :15, :30, or :45
4. ✅ Your automation rule settings (enabled, hours, interval)
5. ✅ Number of conversations you have

This will help identify the exact issue!

