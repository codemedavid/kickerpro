# 🔧 Scheduled Messages - Complete Troubleshooting Guide

## ✅ Good News: Cron Job is Working!

Your logs show:
```
GET 200 /api/cron/send-scheduled
[Cron Send Scheduled] No messages due for sending
```

**This means:**
- ✅ Cron job is running successfully (200 OK)
- ✅ No more authorization errors (401 fixed!)
- ✅ Checking database every 1 minute
- ⚠️ But finding ZERO scheduled messages to send

## 🎯 The Issue

The cron job works perfectly, but there are **no messages in the database with status='scheduled'**.

This could mean:
1. You haven't created any scheduled messages yet
2. You created messages but they're in 'draft' status (not 'scheduled')
3. You created scheduled messages but they already sent
4. The scheduled time is in the future (not due yet)

## 🧪 How to Test the Scheduled Message System

### Option 1: Use the Test API (Fastest)

I've created an API endpoint that creates a test scheduled message for you.

**In your browser or Postman, send a POST request to:**
```
https://your-app.vercel.app/api/messages/create-test-scheduled
```

**Or use curl:**
```bash
curl -X POST https://your-app.vercel.app/api/messages/create-test-scheduled \
  -H "Cookie: fb-user-id=YOUR_USER_ID"
```

This will:
- ✅ Create a test message
- ✅ Set status to 'scheduled'
- ✅ Schedule it for 2 minutes from now
- ✅ Use your first Facebook page
- ✅ Send to your first 5 conversations

Then watch your Vercel logs - within 2-3 minutes you should see:
```
[Cron Send Scheduled] Found 1 message(s) due for sending
[Cron Send Scheduled] ✅ Successfully sent message: Test Scheduled Message
```

---

### Option 2: Create via Dashboard

1. **Go to your app:** `https://your-app.vercel.app/dashboard/compose`

2. **Fill in the message:**
   - Title: "Test Scheduled Message"
   - Content: "Hello! This is a test."
   - Select your Facebook page
   - Choose some recipients

3. **IMPORTANT - Set these fields correctly:**
   ```
   Status: scheduled  ← MUST be "scheduled" not "draft"
   Scheduled For: [Pick a time 3 minutes from now]
   ```

4. **Save the message**

5. **Wait 3-5 minutes** (for the scheduled time to pass)

6. **Check Vercel logs** - you should see the cron send it

---

## 🔍 Verify What's in Your Database

To see what messages actually exist in your database, run this query in your diagnostic tool:

```
GET /api/messages/check-scheduled
```

This will show you:
- All messages with status='scheduled'
- Which ones are due for sending
- Which ones are scheduled for the future
- Why they might not be sending

---

## 📊 Common Mistakes

### Mistake 1: Status is 'draft' instead of 'scheduled'

```json
{
  "title": "My Message",
  "status": "draft",  ❌ WRONG
  "scheduled_for": "2024-01-01T10:00:00Z"
}
```

The cron job **ONLY** looks for messages with `status='scheduled'`.

**Fix:** Change status to 'scheduled'
```json
{
  "title": "My Message",
  "status": "scheduled",  ✅ CORRECT
  "scheduled_for": "2024-01-01T10:00:00Z"
}
```

---

### Mistake 2: scheduled_for is in the future

```json
{
  "title": "My Message",
  "status": "scheduled",
  "scheduled_for": "2024-12-31T10:00:00Z"  ❌ Too far in future
}
```

The cron only sends messages where `scheduled_for <= current_time`.

**Fix:** Set scheduled_for to a time 2-3 minutes from now for testing.

---

### Mistake 3: No recipients selected

```json
{
  "title": "My Message",
  "status": "scheduled",
  "scheduled_for": "2024-01-01T10:00:00Z",
  "selected_recipients": []  ❌ Empty array
}
```

**Fix:** Make sure you have recipients selected.

---

## 🚀 Quick Test Right Now

Follow these steps to test immediately:

**Step 1: Check if you have any scheduled messages**
```
Visit: https://your-app.vercel.app/api/messages/check-scheduled
```

You'll see if any messages exist.

**Step 2: Create a test message**
```
POST to: https://your-app.vercel.app/api/messages/create-test-scheduled
```

This creates a message scheduled for 2 minutes from now.

**Step 3: Watch the logs**
```
Go to: Vercel Dashboard → Functions → /api/cron/send-scheduled
Refresh the page every 30 seconds
```

After 2-3 minutes, you should see:
```
✅ [Cron Send Scheduled] Found 1 message(s) due for sending
✅ [Cron Send Scheduled] Processing message: Test Scheduled Message
✅ [Cron Send Scheduled] ✅ Successfully sent
```

**Step 4: Verify it sent**
```
Check: https://your-app.vercel.app/api/messages
```

The message status should now be 'sent' instead of 'scheduled'.

---

## 📋 Checklist for Scheduled Messages to Work

- [x] Cron job is running (✅ DONE - you see 200 OK logs)
- [x] Cron job has access to database (✅ DONE - using service role key)
- [ ] Message exists in database
- [ ] Message has status='scheduled' (not 'draft' or 'sent')
- [ ] Message has scheduled_for <= current time
- [ ] Message has recipients selected
- [ ] Facebook page has valid access token

If all checkmarks are checked, scheduled messages will send automatically! 🎉

---

## 🎯 Summary

**What's Working:**
- ✅ Cron job runs every minute
- ✅ Cron job queries database correctly
- ✅ No authorization errors

**What's Missing:**
- ❌ No messages with status='scheduled' in database
- ❌ Need to create a test scheduled message

**Next Step:**
Use the test API endpoint to create a scheduled message and watch it send automatically! 🚀

```
POST https://your-app.vercel.app/api/messages/create-test-scheduled
```

Then check Vercel logs in 2-3 minutes to see the magic happen! ✨

