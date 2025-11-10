# 🔧 Restart Dev Server and Test Auto-Send

## ⚠️ **IMPORTANT: Code Changes Don't Take Effect Until Restart!**

The bug fix I applied (changing cookie name from `fb-auth-user` to `fb-user-id`) won't work until you restart your development server.

---

## 🚀 **Step-by-Step Instructions:**

### **Step 1: Stop the Dev Server**

In your terminal where `npm run dev` is running:
1. **Press** `Ctrl+C` to stop the server
2. **Wait** for it to fully stop

### **Step 2: Start the Dev Server**

In the same terminal:
```bash
npm run dev
```

Wait for:
```
✓ Ready in Xms
○ Local: http://localhost:3000
```

### **Step 3: Test the Fix**

**Option A: Use Test Page (Easiest)**

Visit:
```
http://localhost:3000/test-dispatch.html
```

Click **"Test Dispatch Endpoint"** button

You'll see one of these:

✅ **If working:**
```
✅ SUCCESS!
Status: 200 OK

Response:
{
  "success": true,
  "dispatched": 0
}
```

❌ **If still broken:**
```
❌ FAILED!
Status: 500 Internal Server Error

Response:
{
  "error": "...",
  "details": "..."
}
```

**Copy the entire output** and show me!

---

**Option B: Use Scheduled Messages Page**

1. Go to: http://localhost:3000/dashboard/scheduled
2. Press F12 to open console
3. Look for logs (should appear every 30 seconds):

✅ **If working:**
```
[Scheduled Dispatch] ========== START ==========
[Scheduled Dispatch] ✅ Authenticated, user: a3c2696c...
[Scheduled Dispatch] Supabase client created
[Scheduled Dispatch] No messages due for sending
[Scheduled Dispatch] ========== COMPLETE ==========
[Scheduled] Auto-dispatch result: { success: true, dispatched: 0 }
```

❌ **If still broken:**
```
[Scheduled] Auto-dispatch failed: 500
[Scheduled] Error details: { error: "...", details: "..." }
```

---

## 🎯 **After Restart Works, Test Auto-Send:**

1. **Create a scheduled message:**
   - Go to Compose
   - Create message
   - Select recipients
   - Schedule for 1-2 minutes from now

2. **Go to Scheduled Messages page**
3. **Keep page open**
4. **Watch console** (F12)
5. **Wait for scheduled time**
6. **See it auto-send!**

---

## 📋 **What the Logs Should Show:**

Every 30 seconds:
```
[Scheduled Page] Running auto-dispatch check at 5:30:00 PM
[Scheduled Dispatch] ========== START ==========
[Scheduled Dispatch] Time: 2025-11-07T17:30:00.000Z
[Scheduled Dispatch] Checking cookies...
[Scheduled Dispatch] User ID from cookie: a3c2696c-1248-4603-9dfb-141879987556
[Scheduled Dispatch] ✅ Authenticated, user: a3c2696c...
[Scheduled Dispatch] Supabase client created
[Scheduled Dispatch] No messages due for sending
[Scheduled Dispatch] ========== COMPLETE ==========
[Scheduled] Auto-dispatch result: { success: true, dispatched: 0 }
```

When message sends:
```
[Scheduled Page] Running auto-dispatch check at 5:32:00 PM
[Scheduled Dispatch] Found 1 message(s) due for sending
[Scheduled Dispatch] Processing message: xxx
[Scheduled Dispatch] Triggering direct send for: xxx
[Send Now] Sending to 1 recipient(s) directly...
[Send Now] ✅ Sent to recipient...
[Scheduled Dispatch] ✅ Message sent successfully: xxx
[Scheduled] ✅ Auto-sent 1 message(s)!
```

---

## 🔍 **If Still Getting 500 Error After Restart:**

The new logging will show the exact error. Look for:
```
[Scheduled Dispatch] ========== ERROR ==========
[Scheduled Dispatch] Fatal error: [Error details here]
[Scheduled Dispatch] Error message: [Specific message]
```

Share that error message with me and I'll fix it!

---

## 📝 **Summary:**

**Current Status:** Code fixed but not applied  
**Action Required:** Restart dev server  
**Test Tool:** http://localhost:3000/test-dispatch.html  
**Expected:** Should work after restart  

---

**Restart your dev server now and test!** 🚀









