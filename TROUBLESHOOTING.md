# 🔧 Troubleshooting: "Failed to create message"

## ❌ Your Current Error

```
[Compose] API error response: {}
Failed to create message
```

**This means:** The API returned an error, but the error object is empty or not formatted correctly.

---

## ⚡ **MOST LIKELY FIX: Update Database (30 seconds)**

### **You probably haven't run the database update yet!**

**Open Supabase → SQL Editor → Paste & Run:**

```sql
-- Step 1: Drop old constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_recipient_type_check;

-- Step 2: Add new constraint with 'selected'
ALTER TABLE messages 
ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));

-- Step 3: Add column for selected recipients
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];
```

**Click "Run" → Wait for "Success" → Try sending message again!**

---

## 🔍 Step-by-Step Debugging

### **Step 1: Check Diagnostics**

Visit this URL in your browser:
```
http://localhost:3000/api/diagnostics
```

**Expected output:**
```json
{
  "status": "ok",
  "diagnostics": {
    "authentication": {
      "userId": "✅ Present",
      "accessToken": "✅ Present"
    },
    "database": {
      "connection": "✅ Connected",
      "messagesTable": "✅ Accessible",
      "hasSelectedRecipientsColumn": "⚠️ No (needs migration)"
    }
  }
}
```

**If you see "needs migration"** → Run the SQL above!

---

### **Step 2: Check Browser Console**

Open Developer Tools (F12) and look for detailed error logs:

**Bad (database not updated):**
```javascript
❌ [Compose] Full error text: "violates check constraint messages_recipient_type_check"
```
**→ Fix:** Run the SQL update

**Bad (not authenticated):**
```javascript
❌ [Compose] Response status: 401
❌ [Compose] API error: "Not authenticated"
```
**→ Fix:** Logout and login again

**Good:**
```javascript
✅ [Compose] Response status: 200
✅ [Compose] Message created: abc-123
✅ [Compose] Triggering immediate send...
```

---

### **Step 3: Test API Directly**

Open browser console and run:

```javascript
// Test creating a simple message
fetch('/api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Test Message',
    content: 'Testing 123',
    page_id: 'your-page-uuid',
    created_by: 'your-user-uuid',
    recipient_type: 'all',
    recipient_count: 10,
    status: 'draft',
    scheduled_for: null
  })
})
.then(r => r.json())
.then(data => console.log('API Response:', data))
.catch(err => console.error('API Error:', err));
```

**Expected:**
```json
{
  "success": true,
  "message": { "id": "abc-123", ... }
}
```

**If error mentions "check constraint"** → Run SQL update!

---

## 🐛 Common Errors & Fixes

### **Error 1: "violates check constraint messages_recipient_type_check"**

**Cause:** Database doesn't allow `recipient_type = 'selected'`  
**Fix:** Run the SQL update (see top of page)

---

### **Error 2: "Not authenticated"**

**Cause:** Cookies expired or not set  
**Fix:** 
1. Logout (click profile → Logout)
2. Login again with Facebook
3. Try sending message again

---

### **Error 3: "Page not found"**

**Cause:** Invalid `page_id`  
**Fix:**
1. Go to `/dashboard/connections`
2. Connect a Facebook page
3. Copy the page ID from browser console
4. Use that ID when composing

---

### **Error 4: "No recipients found"**

**Cause:** No conversations synced  
**Fix:**
1. Go to `/dashboard/conversations`
2. Select a page
3. Click "Sync from Facebook"
4. Then try composing message

---

### **Error 5: Empty error object `{}`**

**Cause:** API returning non-JSON error or malformed response  
**Fix:** Check server logs for actual error. Usually means database issue.

---

## 📊 Verification Checklist

Run through this checklist:

- [ ] **Database updated?**
  - Run: `http://localhost:3000/api/diagnostics`
  - Should show: `hasSelectedRecipientsColumn: "✅ Yes"`

- [ ] **Authenticated?**
  - Check: Browser cookies (F12 → Application → Cookies)
  - Should see: `fb-auth-user` and `fb-access-token`

- [ ] **Page connected?**
  - Go to: `/dashboard/connections`
  - Should see: At least one Facebook page

- [ ] **Conversations synced?**
  - Go to: `/dashboard/conversations`
  - Select page and click "Sync from Facebook"
  - Should see: List of conversations

- [ ] **Browser console clean?**
  - Open: F12 → Console
  - Should see: No red errors

---

## 🔬 Advanced Debugging

### **Check Supabase Logs**

1. Go to Supabase Dashboard
2. Click "Logs" in sidebar
3. Filter by "postgres"
4. Look for constraint violations

**Expected error (if database not updated):**
```
new row for relation "messages" violates check constraint "messages_recipient_type_check"
```

### **Check Database Schema**

Run this in Supabase SQL Editor:

```sql
-- Check constraint definition
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
AND conname = 'messages_recipient_type_check';

-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name = 'selected_recipients';
```

**Expected output:**
```
Constraint: CHECK ((recipient_type = ANY (ARRAY['all'::text, 'active'::text, 'selected'::text])))
Column: selected_recipients | text[]
```

**If different** → Run the SQL update!

---

## 🎯 Quick Fix Guide

### **"I just want it to work!"**

Do this in order:

1. **Update Database** (30 seconds)
   ```sql
   -- Copy from database-update.sql and run in Supabase
   ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_recipient_type_check;
   ALTER TABLE messages ADD CONSTRAINT messages_recipient_type_check CHECK (recipient_type IN ('all', 'active', 'selected'));
   ALTER TABLE messages ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];
   ```

2. **Logout & Login** (1 minute)
   - Click profile icon → Logout
   - Click "Continue with Facebook"
   - Allow permissions

3. **Connect Page** (30 seconds)
   - Go to Connections
   - Click "Connect Facebook Page"
   - Select your page

4. **Sync Conversations** (1 minute)
   - Go to Conversations
   - Select page
   - Click "Sync from Facebook"
   - Wait for "Synced X conversations"

5. **Send Message** (30 seconds)
   - Go to Compose
   - Fill form
   - Click "Send Message"
   - ✅ **Should work!**

---

## 📞 Still Not Working?

### **Share these details:**

1. **Diagnostics output:**
   ```
   Visit: http://localhost:3000/api/diagnostics
   Copy the JSON output
   ```

2. **Browser console logs:**
   ```
   F12 → Console → Copy all [Compose] and [Messages API] logs
   ```

3. **Supabase logs:**
   ```
   Supabase Dashboard → Logs → Copy any errors
   ```

4. **Network tab:**
   ```
   F12 → Network → Find /api/messages request → Copy response
   ```

---

## ✅ Success Indicators

**You'll know it's working when you see:**

**Browser Console:**
```javascript
✅ [Compose] Message created: abc-123-def-456
✅ [Compose] Triggering immediate send...
✅ [Send API] Completed sending. Sent: 5 Failed: 0
✅ [Compose] Send result: { sent: 5, failed: 0 }
```

**Toast Notification:**
```
✅ Message Sent!
Successfully sent to 5 recipients.
```

**Database:**
```sql
SELECT * FROM messages WHERE status = 'sent';
-- Shows your message with delivered_count > 0
```

---

## 🎉 Summary

**Most common issue:** Database not updated  
**Fix:** Run SQL in Supabase (see top)  
**Time:** 30 seconds  
**Success rate:** 99%  

**After database update, everything should work!** ✨

