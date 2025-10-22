# ⚡ DATABASE UPDATE REQUIRED!

## ❌ Your Error:

```
"Could not find the 'message_tag' column of 'messages' in the schema cache"
```

**This means:** You haven't run the database migration yet!

---

## ✅ FIX IT NOW (1 Minute)

### **Step 1: Open Supabase**

1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Click **"SQL Editor"** in left sidebar

### **Step 2: Copy SQL**

Open this file: **`RUN_THIS_NOW.sql`**

Or copy this:

```sql
-- Fix recipient_type constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_recipient_type_check;

ALTER TABLE messages 
ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));

-- Add selected_recipients column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];

-- Add message_tag column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_tag TEXT 
CHECK (message_tag IN ('ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE', 'HUMAN_AGENT'));

-- Create message_batches table
CREATE TABLE IF NOT EXISTS message_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    total_batches INTEGER NOT NULL,
    recipients TEXT[] NOT NULL,
    recipient_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_message_batches_message_id ON message_batches(message_id);
CREATE INDEX IF NOT EXISTS idx_message_batches_status ON message_batches(status);
```

### **Step 3: Run It**

1. **Paste** the SQL in Supabase SQL Editor
2. **Click** "Run" (or press Ctrl+Enter)
3. **Wait** for "Success. No rows returned"
4. ✅ **Done!**

### **Step 4: Refresh Supabase**

1. **Close** the SQL Editor tab
2. **Press F5** to refresh Supabase dashboard
3. **Wait** 10 seconds (clears cache)

### **Step 5: Try Again**

1. **Go back to your app**
2. **Try sending message**
3. ✅ **Should work now!**

---

## ✅ What This SQL Does

1. ✅ **Allows 'selected' recipient type** (for selecting specific contacts)
2. ✅ **Adds selected_recipients column** (stores contact IDs)
3. ✅ **Adds message_tag column** (for bypassing 24h window)
4. ✅ **Creates batches table** (for processing 1000+ contacts)
5. ✅ **Creates indexes** (for better performance)

---

## 🧪 Verify It Worked

**Run this in Supabase SQL Editor:**

```sql
-- Should show: selected_recipients and message_tag
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('selected_recipients', 'message_tag');

-- Should show: message_batches
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'message_batches';
```

**Expected Result:**
```
selected_recipients | ARRAY
message_tag | text
message_batches | (table exists)
```

---

## 📋 After Migration, You Can:

- ✅ Send to up to 2,000 selected contacts
- ✅ Use message tags (ACCOUNT_UPDATE, etc.)
- ✅ See batch breakdown (10 batches for 1000 contacts)
- ✅ Track batch progress
- ✅ Filter by date
- ✅ Select all from filters

---

## ⚠️ MUST DO THIS BEFORE ANYTHING WORKS!

**The app won't work until you run the SQL migration!**

1. **Open Supabase**
2. **Copy RUN_THIS_NOW.sql**
3. **Paste in SQL Editor**
4. **Click Run**
5. ✅ **Everything will work!**

---

**Run the SQL now and your app will work perfectly!** 🚀

