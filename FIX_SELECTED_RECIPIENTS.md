# ⚡ FIX: "Could not find 'selected_recipients' column"

## ❌ Your Error:

```
"Could not find the 'selected_recipients' column of 'messages' in the schema cache"
Code: PGRST204
```

**This means:** The database column doesn't exist yet!

---

## ✅ SOLUTION (2 Minutes)

### **Step 1: Run SQL in Supabase** ⚡ (30 seconds)

1. **Go to:** [supabase.com](https://supabase.com) → Your Project
2. **Click:** "SQL Editor" (left sidebar)
3. **Click:** "New Query"
4. **Paste this:**

```sql
-- Add the missing column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];

-- Update constraint to allow 'selected' type
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_recipient_type_check;

ALTER TABLE messages 
ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));

-- Verify it worked
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name = 'selected_recipients';
```

5. **Click:** "Run" (or Ctrl+Enter)
6. **Wait for:** Success message
7. **Verify:** Should show `selected_recipients | ARRAY | YES`

### **Step 2: Clear Schema Cache** (10 seconds)

**Important!** Supabase caches the database schema.

**Do this:**
1. Close the SQL Editor tab
2. Wait 5 seconds
3. Refresh your Supabase dashboard (F5)
4. Open a new SQL Editor tab
5. Run the verify query again to confirm

---

## 🧪 **Test Sending to Your User**

### **Test Data:**
- **Page ID (UUID):** `a430e86c-3f86-44fa-9148-1f10f45a5ccc`
- **Page ID (Facebook):** `505302195998738`
- **Recipient:** `24934311549542539`

### **Method 1: Browser Console Test** (Recommended)

1. **Open your app:** `http://localhost:3000`
2. **Login** with Facebook
3. **Open console:** Press `F12` → Console tab
4. **Paste this:**

```javascript
// Test creating message (as draft, won't actually send)
fetch('http://localhost:3000/api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Test Message',
    content: 'Hello! This is a test message.',
    page_id: 'a430e86c-3f86-44fa-9148-1f10f45a5ccc',
    recipient_type: 'selected',
    recipient_count: 1,
    status: 'draft',
    scheduled_for: null,
    selected_recipients: ['24934311549542539']
  })
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('✅ Response:', data);
  
  if (data.success && data.message?.id) {
    console.log('🎉 SUCCESS! Message created:', data.message.id);
    console.log('Selected recipients:', data.message.selected_recipients);
    
    // To actually SEND it (uncomment to test):
    // return fetch(`http://localhost:3000/api/messages/${data.message.id}/send`, { 
    //   method: 'POST' 
    // })
    // .then(r => r.json())
    // .then(result => console.log('📨 Send result:', result));
  }
})
.catch(err => console.error('❌ Error:', err));
```

5. **Press Enter**
6. **Check response**

**Expected Success:**
```javascript
✅ Response: {
  success: true,
  message: {
    id: "some-uuid",
    title: "Test Message",
    selected_recipients: ["24934311549542539"],
    status: "draft"
  }
}
🎉 SUCCESS! Message created: some-uuid
Selected recipients: ["24934311549542539"]
```

### **Method 2: Use the App UI**

1. **Go to:** `/dashboard/conversations`
2. **Select page:** Your page (Facebook ID: 505302195998738)
3. **Click:** "Sync from Facebook"
4. **Find recipient:** `24934311549542539`
5. **Check the box** next to that contact
6. **Click:** "Send to 1 Selected"
7. **Fill form** and click "Send Message"
8. ✅ **Should work!**

---

## 🔍 **Verify Database Update**

Run this in Supabase SQL Editor to confirm:

```sql
-- Check column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('selected_recipients');

-- Check constraint allows 'selected'
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
AND conname = 'messages_recipient_type_check';

-- Try inserting a test record
INSERT INTO messages (
  title, 
  content, 
  page_id, 
  created_by, 
  recipient_type, 
  recipient_count, 
  status,
  selected_recipients
) VALUES (
  'Database Test',
  'Testing selected_recipients column',
  'a430e86c-3f86-44fa-9148-1f10f45a5ccc',
  (SELECT id FROM users LIMIT 1),
  'selected',
  1,
  'draft',
  ARRAY['24934311549542539']
) RETURNING id, selected_recipients;

-- Clean up test
-- DELETE FROM messages WHERE title = 'Database Test';
```

**Expected Results:**

1. **Column exists:** `selected_recipients | ARRAY | YES`
2. **Constraint allows:** `CHECK (recipient_type IN ('all', 'active', 'selected'))`
3. **Insert works:** Returns the ID and `{24934311549542539}`

---

## ❌ **Still Getting Errors?**

### **Error: "PGRST204 - Could not find column"**

**Cause:** Schema cache not refreshed  
**Fix:**
1. Refresh Supabase dashboard (F5)
2. Wait 30 seconds
3. Try again
4. If still failing, restart your Next.js app:
   ```bash
   # Kill and restart
   lsof -ti:3000 | xargs kill
   cd nextjs-app && npm run dev
   ```

### **Error: "violates check constraint"**

**Cause:** Constraint not updated  
**Fix:** Re-run the constraint update SQL:
```sql
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_recipient_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));
```

### **Error: "column already exists"**

**Good!** This means the migration already ran. Try the test again.

---

## 📊 **What the SQL Does**

```sql
-- 1. Adds column for storing selected recipient IDs
ALTER TABLE messages ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];
-- Creates: TEXT[] (array of strings)
-- Stores: ['recipient1_id', 'recipient2_id', ...]

-- 2. Removes old constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_recipient_type_check;

-- 3. Adds new constraint that allows 'selected'
ALTER TABLE messages ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));
-- Before: Only 'all' or 'active' allowed
-- After: 'all', 'active', OR 'selected' allowed ✅
```

---

## 🎉 **Success Indicators**

**You'll know it worked when:**

### **1. SQL Query Returns:**
```
column_name: selected_recipients
data_type: ARRAY
is_nullable: YES
```

### **2. Browser Console Shows:**
```javascript
✅ Response: { success: true, message: { ... } }
🎉 SUCCESS! Message created: uuid-here
Selected recipients: ["24934311549542539"]
```

### **3. Database Has Record:**
```sql
SELECT * FROM messages WHERE selected_recipients IS NOT NULL;
-- Shows your test message with the recipient array
```

### **4. UI Works:**
- No more "Failed to create message" errors
- Toast shows "Message sent successfully"
- Dashboard shows message in history

---

## 📁 **Files Created**

- ✅ `test-send-message.js` - Node test script
- ✅ `FIX_SELECTED_RECIPIENTS.md` - This guide
- ✅ `TROUBLESHOOTING.md` - Full debug guide
- ✅ `database-update.sql` - SQL commands

---

## 🚀 **Quick Checklist**

- [ ] Run SQL in Supabase SQL Editor
- [ ] Verify column exists (run verify query)
- [ ] Refresh Supabase dashboard
- [ ] Test in browser console (paste fetch command)
- [ ] Check for success message
- [ ] Try sending via UI
- [ ] ✅ **DONE!**

---

## 📞 **Still Stuck?**

1. **Check Supabase logs:**
   - Supabase Dashboard → Logs → Filter by "postgres"
   - Look for errors

2. **Check browser console:**
   - F12 → Console → Look for red errors
   - Share the full `[Compose]` and `[Messages API]` logs

3. **Verify column exists:**
   ```sql
   \d messages;  -- Shows all columns
   ```

4. **Check app is running:**
   ```bash
   curl http://localhost:3000/api/diagnostics
   ```

---

## ✅ Summary

**Problem:** Database missing `selected_recipients` column  
**Cause:** Migration not run yet  
**Fix:** Run SQL in Supabase (30 seconds)  
**Test:** Use browser console fetch command  
**Result:** Message sending works! ✨

**Run the SQL now and test!** 🚀

