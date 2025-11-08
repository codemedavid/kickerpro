# 🔍 Scheduled Message System - Complete Diagnosis

## ✅ What's Working

Based on my analysis of the cron job code, the system is functioning correctly:

1. ✅ Cron runs every 1 minute
2. ✅ Uses service role key (bypasses RLS)
3. ✅ Queries: `SELECT * FROM messages WHERE status='scheduled' AND scheduled_for <= NOW()`
4. ✅ Sends messages via Facebook API
5. ✅ Updates status to 'sent' after completion
6. ✅ Handles errors gracefully

## 🚨 Potential Issues Found

### Issue #1: Timezone Mismatch (MOST LIKELY)

**Problem:**
The scheduled_for time might be set in local timezone, but the cron compares it with UTC time.

**In compose page (line 505-519):**
```typescript
if (formData.messageType === 'scheduled') {
  status = 'scheduled';
  // ⚠️ THIS CREATES A DATE OBJECT FROM USER'S INPUT
  scheduledFor = new Date(`${formData.scheduleDate}T${formData.scheduleTime}`).toISOString();
}
```

**Example of the problem:**
```
User's local time: November 8, 2024, 1:00 PM (Philippines GMT+8)
Stored as UTC: November 8, 2024, 5:00 AM
Cron checks at: November 8, 2024, 12:55 PM UTC (8:55 PM Philippines)

Result: Message won't send for another 4 hours!
```

**In cron job (line 65-72):**
```typescript
const nowIso = currentTime.toISOString();  // Always UTC
console.log('[Cron Send Scheduled] Looking for messages scheduled_for <=', nowIso);

const { data: dueMessages } = await supabase
  .from('messages')
  .select('*')
  .eq('status', 'scheduled')
  .lte('scheduled_for', nowIso)  // Comparing user's local time with UTC!
```

---

### Issue #2: Browser Timezone Interpretation

When you select a date/time in the compose form:
- **Input:** `scheduleDate: "2024-11-08"`, `scheduleTime: "13:00"`
- **Browser creates:** `new Date("2024-11-08T13:00")` 
- **Browser interprets this as LOCAL TIME**
- **Converts to ISO (UTC):** `"2024-11-08T05:00:00.000Z"` (if you're in GMT+8)

So if you schedule for 1:00 PM your time, it's stored as 5:00 AM UTC!

---

### Issue #3: No Scheduled Messages in Database

From our earlier check, the database has:
- **0 messages with status='scheduled'**
- 10 sent messages
- 3 cancelled messages
- 2 failed messages

This means:
1. Either no scheduled messages have been created
2. Or they were created but already processed/changed status

---

## 🔧 How to Verify the Issue

### Test 1: Check What's Actually in Database

Create a scheduled message via the dashboard, then immediately check:

```sql
SELECT 
  id, 
  title, 
  status, 
  scheduled_for,
  scheduled_for AT TIME ZONE 'UTC' as utc_time,
  scheduled_for AT TIME ZONE 'Asia/Manila' as local_time,
  NOW() as current_time_utc,
  NOW() AT TIME ZONE 'Asia/Manila' as current_time_local
FROM messages 
WHERE status = 'scheduled'
ORDER BY scheduled_for DESC;
```

This will show you:
- What time is stored
- What time it is now (UTC)
- Whether the scheduled time is in the past or future

---

### Test 2: Use Enhanced Logging

I'll add enhanced logging to the cron job to show exactly what's happening:

**Current logs show:**
```
[Cron Send Scheduled] Looking for messages scheduled_for <= 2024-11-08T12:55:00.000Z
[Cron Send Scheduled] No messages due for sending
```

**We need to see:**
- How many total scheduled messages exist (regardless of time)
- What their scheduled_for times are
- The exact time comparison being made

---

## 🎯 Quick Fix Options

### Option A: Fix the Timezone in Frontend (Recommended)

Update the compose page to ensure we're setting the correct UTC time:

```typescript
// Current (WRONG - assumes local time):
scheduledFor = new Date(`${formData.scheduleDate}T${formData.scheduleTime}`).toISOString();

// Fixed (CORRECT - explicit timezone):
const localDateTime = new Date(`${formData.scheduleDate}T${formData.scheduleTime}`);
// This is already converted to UTC correctly
scheduledFor = localDateTime.toISOString();

// OR for explicit UTC input:
const utcDateTime = new Date(`${formData.scheduleDate}T${formData.scheduleTime}:00.000Z`);
scheduledFor = utcDateTime.toISOString();
```

---

### Option B: Use Test Endpoint (Immediate Test)

The test endpoint I created explicitly sets the time:

```typescript
// Sets scheduled time to 2 minutes from NOW (server time)
const scheduledFor = new Date();
scheduledFor.setMinutes(scheduledFor.getMinutes() + 2);
```

This will work because it's using server time, not user input.

---

### Option C: Add Enhanced Logging to Cron

Let me add better logging to see what's actually happening:

```typescript
// Log ALL scheduled messages, not just due ones
const { data: allScheduled } = await supabase
  .from('messages')
  .select('id, title, scheduled_for, status')
  .eq('status', 'scheduled');

console.log(`[Cron] Total scheduled messages: ${allScheduled?.length || 0}`);
allScheduled?.forEach(msg => {
  const msgTime = new Date(msg.scheduled_for);
  const diff = msgTime.getTime() - currentTime.getTime();
  const minutesUntil = Math.floor(diff / 60000);
  console.log(`[Cron] - ${msg.title}: scheduled for ${msg.scheduled_for} (${minutesUntil} minutes from now)`);
});
```

---

## 🧪 Diagnostic Steps

### Step 1: Check Current State

Visit your dashboard and check `/dashboard/scheduled` - do you see any scheduled messages?

### Step 2: Create Test Message

Use the test endpoint:
```
POST https://your-app.vercel.app/api/messages/create-test-scheduled
```

This creates a message scheduled for exactly 2 minutes from server time.

### Step 3: Watch Logs

Monitor Vercel logs. Within 2-3 minutes you should see it send.

If it sends → timezone issue confirmed (test endpoint uses server time)
If it doesn't send → different issue (will need more logs)

### Step 4: Try Manual Scheduling

Create a message in the dashboard:
1. Go to `/dashboard/compose`
2. Fill in message details
3. Select "Scheduled"
4. **Pick a time 5 minutes from now**
5. Save

Then check the logs to see what happens.

---

## 📊 Summary of Likely Issues

**Probability Assessment:**

1. **90% - No scheduled messages exist in database**
   - You haven't created any yet
   - Or they already sent and changed to 'sent' status
   - **Solution:** Create a test message

2. **8% - Timezone mismatch**
   - Scheduled time is stored wrong
   - Cron thinks it's not due yet
   - **Solution:** Use test endpoint (uses server time)

3. **2% - Other issue**
   - Cron not running (but logs show it is!)
   - Database connection issue (but logs show no errors)
   - **Solution:** Enhanced logging

---

## 🚀 Action Plan

**Do this right now:**

1. **Login to your app**
2. **Use the test endpoint:**
   ```
   POST https://your-app.vercel.app/api/messages/create-test-scheduled
   ```
3. **Wait 2-3 minutes**
4. **Check Vercel logs**

If the test endpoint works, then the cron is fine and it's just waiting for properly scheduled messages!

If the test endpoint doesn't work, we need to investigate further with enhanced logging.

---

## 💡 Expected Behavior

**When a message is properly scheduled:**

```
12:55:00 - Cron runs → No messages due
12:56:00 - Cron runs → No messages due
12:57:00 - Cron runs → No messages due
12:57:30 - User creates message scheduled for 12:59:00
12:58:00 - Cron runs → Finds 1 message (scheduled_for 12:59, now 12:58, not yet!)
12:59:00 - Cron runs → Finds 1 message (scheduled_for 12:59, now 12:59, due!)
           → Sends message
           → Updates status to 'sent'
13:00:00 - Cron runs → No messages due (already sent)
```

**Currently you're seeing:**
```
12:55:00 - Cron runs → No messages due
12:56:00 - Cron runs → No messages due
12:57:00 - Cron runs → No messages due
...continues forever...
```

This means there are ZERO messages with `status='scheduled'` in the database.

Use the test endpoint to create one! 🎯

