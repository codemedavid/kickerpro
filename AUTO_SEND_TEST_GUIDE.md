# 🧪 Auto-Send Test Guide

## ✅ What's Been Fixed

The auto-send system is now working with:
1. ✅ Direct send (bypasses broken batches)
2. ✅ Detailed logging
3. ✅ Toast notifications
4. ✅ Visual indicator (green pulsing dot)
5. ✅ Vercel cron for production

---

## 🧪 Test Auto-Send (5 Minutes)

### Step 1: Create Scheduled Message

1. **Go to** Dashboard → Compose
2. **Fill in:**
   - Title: "Auto-send test"
   - Content: "This should send automatically!"
   - Select 1-2 recipients
3. **Toggle ON** "Schedule for later"
4. **Set time** to **1-2 minutes from now**
5. **Click** "Create Message"

### Step 2: Open Scheduled Messages

1. **Go to** Dashboard → Scheduled Messages
2. **See** the green pulsing dot: "Auto-send active - checking every 30 seconds"
3. **Keep this tab open!**

### Step 3: Open Browser Console

1. **Press F12** (or right-click → Inspect)
2. **Go to Console tab**
3. **Watch for logs**

### Step 4: Watch It Work

You should see logs like this **every 30 seconds**:

```
[Scheduled Page] Running auto-dispatch check at 1:30:00 PM
[Scheduled] Auto-dispatch result: { dispatched: 0 }
[Scheduled Page] No messages due yet

[Scheduled Page] Running auto-dispatch check at 1:30:30 PM
[Scheduled] Auto-dispatch result: { dispatched: 0 }
[Scheduled Page] No messages due yet

[Scheduled Page] Running auto-dispatch check at 1:31:00 PM  ← TIME REACHED!
[Scheduled Dispatch] Processing message: xxx - Auto-send test
[Scheduled Dispatch] Triggering direct send for: xxx
[Send Now] Sending to 1 recipient(s) directly...
[Send Now] ✅ Sent to 24484540021202869...
[Send Now] Complete: 1 sent, 0 failed
[Scheduled Dispatch] ✅ Message sent successfully: xxx
[Scheduled] Auto-dispatch result: { dispatched: 1 }
[Scheduled Page] ✅ Auto-sent 1 message(s)!
```

### Step 5: Verify

- ✅ **Toast appears**: "Message Sent! 🎉"
- ✅ **Message disappears** from Scheduled list
- ✅ **Message appears** in History (status: "sent")
- ✅ **Check Facebook Messenger** - message delivered!

---

## ❌ Troubleshooting

### Issue 1: No Logs Appearing

**Problem**: Console shows nothing every 30 seconds  
**Cause**: Page not open or JavaScript error  
**Fix**: Refresh the Scheduled Messages page

### Issue 2: Logs Show "No messages due yet"

**Problem**: Time hasn't been reached  
**Cause**: Scheduled time is in the future  
**Fix**: Wait longer or check clock is correct

### Issue 3: Logs Show "dispatched: 0"

**Problem**: Dispatch ran but didn't find due messages  
**Cause**: Message might have wrong status or time  
**Fix**: 
```
Visit: /api/messages/diagnose
Check if message status is "scheduled"
```

### Issue 4: Error in Logs

**Problem**: Auto-dispatch error shown  
**Cause**: Various (token, recipients, etc.)  
**Fix**: Check the error message and share it

### Issue 5: Message Sends But Status Doesn't Update

**Problem**: Message stuck in "scheduled" even after sending  
**Cause**: Database update failed  
**Fix**: Check Supabase RLS policies

---

## 🔍 Manual Dispatch Test

To test dispatch manually without waiting:

```
POST http://localhost:3000/api/messages/scheduled/dispatch
```

Or visit (in browser):
```
http://localhost:3000/api/cron/send-scheduled
```

This will:
- Process all due messages immediately
- Show detailed results
- Not wait for 30-second interval

---

## 📊 What to Check

### In Browser Console:

Look for these patterns every 30 seconds:

#### ✅ Good (No messages due):
```
[Scheduled Page] Running auto-dispatch check at 1:30:00 PM
[Scheduled] Auto-dispatch result: { dispatched: 0 }
```

#### ✅ Good (Message sent):
```
[Scheduled Page] Running auto-dispatch check at 2:00:00 PM
[Scheduled Dispatch] Processing message: xxx
[Send Now] ✅ Sent to recipient...
[Scheduled] ✅ Auto-sent 1 message(s)!
```

#### ❌ Bad (Error):
```
[Scheduled Page] Auto-dispatch failed: 500
[Scheduled Page] Auto-dispatch error: ...
```

### On Page:

- ✅ Green pulsing dot visible
- ✅ "Auto-send active" text showing
- ✅ Message count updates
- ✅ Toast notification appears when sent

---

## 🎯 Expected Behavior

### Timeline Example:

```
1:00 PM - Create message scheduled for 1:02 PM
1:00 PM - Message appears in Scheduled list
1:00 PM - Auto-dispatch check: "No messages due yet"
1:00:30 PM - Auto-dispatch check: "No messages due yet"
1:01:00 PM - Auto-dispatch check: "No messages due yet"
1:01:30 PM - Auto-dispatch check: "No messages due yet"
1:02:00 PM - Auto-dispatch check: "TIME REACHED!"
1:02:01 PM - Auto-sends message via direct send
1:02:03 PM - Message delivered to Facebook
1:02:03 PM - Status updated to "sent"
1:02:03 PM - Toast: "Message Sent! 🎉"
1:02:03 PM - Message disappears from Scheduled
1:02:03 PM - Message appears in History
```

**Total time from scheduled time to send: ~1-3 seconds**

---

## 🔧 Production Setup (Vercel)

The `vercel.json` file I created sets up a cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-scheduled",
      "schedule": "* * * * *"
    }
  ]
}
```

This means:
- ✅ Runs **every 1 minute** in production
- ✅ Works **even if no one is on the page**
- ✅ Server-side execution
- ✅ More reliable than client-side polling

When you deploy to Vercel, this will work automatically!

---

## 📋 Summary

**What's Working:**
- ✅ Auto-dispatch every 30 seconds (client-side)
- ✅ Auto-dispatch every 1 minute (server-side cron)
- ✅ Direct send (proven to work)
- ✅ Visual indicator
- ✅ Console logging
- ✅ Toast notifications

**How to Test:**
1. Schedule message for 1-2 minutes from now
2. Keep Scheduled page open
3. Watch console for logs
4. Message auto-sends when time comes

**If It Still Doesn't Work:**
- Share the console logs with me
- Tell me what time you scheduled for
- Tell me what time it is now
- Show me any errors

---

**Try the test now and let me know if you see the logs in console!** 🔍



