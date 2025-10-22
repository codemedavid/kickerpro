# ⚡ URGENT: Database Update Required

## 🔍 The Error

```
"new row for relation \"messages\" violates check constraint \"messages_recipient_type_check\""
```

## ✅ The Fix (30 seconds)

Your database constraint only allows `'all'` or `'active'`, but the app now uses `'selected'` for sending to specific contacts.

### **Run This in Supabase SQL Editor:**

```sql
-- Drop the old constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_recipient_type_check;

-- Add new constraint with 'selected' option
ALTER TABLE messages 
ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));

-- Add column for selected recipients
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];
```

### **Steps:**

1. **Go to your Supabase project** (supabase.com)
2. **Click "SQL Editor"** in left sidebar
3. **Copy the SQL above**
4. **Paste and click "Run"**
5. **Wait for "Success. No rows returned"**
6. ✅ **Done!**

---

## 🧪 Test After Fix

1. **Go to** `/dashboard/compose`
2. **Fill in the form**
3. **Click "Send Message"**
4. ✅ **Should work now!**

**Console will show:**
```javascript
✅ [Messages API] Inserting message into database...
✅ [Messages API] Message created successfully: uuid
✅ Success! Message sent successfully!
```

---

## 📝 Why This Happened

When I added the "Send to Selected Contacts" feature, I updated the frontend to use `recipient_type: 'selected'`, but the database constraint wasn't updated to allow this new value.

**Database said:** "I only accept 'all' or 'active'"  
**App sent:** `recipient_type: 'selected'`  
**Result:** ❌ Constraint violation

**After fix:**  
**Database now accepts:** `'all'`, `'active'`, OR `'selected'` ✅

---

## 🚀 After This Fix

All three recipient types will work:

1. ✅ **All Followers** - `recipient_type: 'all'`
2. ✅ **Active Users Only** - `recipient_type: 'active'`
3. ✅ **Selected Contacts** - `recipient_type: 'selected'` ← NEW!

---

## 📊 What Gets Updated

**messages table:**
- ✅ Constraint updated to allow 'selected'
- ✅ New column: `selected_recipients` (TEXT[])
- ✅ Can store array of Facebook user IDs

**Example message:**
```json
{
  "recipient_type": "selected",
  "recipient_count": 15,
  "selected_recipients": ["123", "456", "789", ...]
}
```

---

## ⚠️ Important

**Run this SQL update ONCE** in Supabase, then message sending will work!

The SQL is also saved in:
- `database-update.sql` (for existing installations)
- `supabase-schema.sql` (already updated for new installations)

---

## ✅ Summary

**Error:** Database constraint violation  
**Fix:** Update constraint to allow 'selected'  
**Time:** 30 seconds  
**Where:** Supabase SQL Editor  
**Result:** Message sending works! ✅

**Run the SQL now and try sending a message again!** 🚀

