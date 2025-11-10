# ✅ COPY THIS - Simplest Possible Setup

## Instructions (2 Minutes)

### Step 1: Get Your IDs

**Run this in Supabase:**
```sql
SELECT id, email FROM auth.users LIMIT 3;
```

Find YOUR email, copy the `id` value.

**Then run:**
```sql
SELECT id, name FROM facebook_pages LIMIT 3;
```

Copy the `id` value.

---

### Step 2: Copy This and Edit

**Copy the text between the lines below:**

```
────────────── COPY FROM HERE ──────────────

-- Create Pipeline Settings
-- 🔽 Edit this line - paste your user_id:
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES ('PASTE_YOUR_USER_ID_HERE', 'Analyze for stage. NEW LEAD: browsing. QUALIFIED: pricing. HOT LEAD: buying.', true);

-- Create Stages
-- 🔽 Edit these lines - paste your user_id:
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position) VALUES
('PASTE_YOUR_USER_ID_HERE', 'New Lead', 'Browsing', '#3b82f6', 'New Lead if browsing.', false, true, 0),
('PASTE_YOUR_USER_ID_HERE', 'Qualified', 'Interested', '#22c55e', 'Qualified if pricing questions.', false, true, 1),
('PASTE_YOUR_USER_ID_HERE', 'Hot Lead', 'Buying', '#ef4444', 'Hot Lead if ready to buy.', false, true, 2);

-- Create Test Contact 1
-- 🔽 Edit these lines - paste your user_id AND page_id:
INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active, created_at, updated_at)
VALUES ('PASTE_YOUR_USER_ID_HERE', 'PASTE_YOUR_PAGE_ID_HERE', 'TEST_BROWSE_001', 'John Browser', 'Hi curious about products', NOW(), 'active', 1, true, NOW(), NOW());

-- Create Test Contact 2
INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active, created_at, updated_at)
VALUES ('PASTE_YOUR_USER_ID_HERE', 'PASTE_YOUR_PAGE_ID_HERE', 'TEST_QUALIFIED_001', 'Maria Interested', 'How much is premium package?', NOW(), 'active', 3, true, NOW(), NOW());

-- Create Test Contact 3
INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active, created_at, updated_at)
VALUES ('PASTE_YOUR_USER_ID_HERE', 'PASTE_YOUR_PAGE_ID_HERE', 'TEST_HOT_001', 'Carlos Buyer', 'Want to order 50 units', NOW(), 'active', 5, true, NOW(), NOW());

────────────── COPY TO HERE ──────────────
```

---

### Step 3: Edit in Text Editor

1. **Paste** the copied text into Notepad or any text editor
2. **Press Ctrl+H** (Find & Replace)
3. **Find:** `PASTE_YOUR_USER_ID_HERE`
4. **Replace with:** Your actual user_id (paste it)
5. **Replace All**
6. **Find:** `PASTE_YOUR_PAGE_ID_HERE`  
7. **Replace with:** Your actual page_id (paste it)
8. **Replace All**

---

### Step 4: Run in Supabase

1. **Copy** the edited SQL from your text editor
2. **Paste** in Supabase SQL Editor
3. **Click Run**

Should complete without errors!

---

### Step 5: Test

1. Go to Conversations page
2. Select John, Maria, Carlos
3. Click "Add to Pipeline"
4. Check Pipeline page

**Should sort to different stages!**

---

## If You Still Get Errors

Run each INSERT **one at a time**, replacing the ID in each:

### Query 1 (Settings):
```sql
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES ('paste-your-user-id', 'Analyze for stage. NEW LEAD: browsing. QUALIFIED: pricing. HOT LEAD: buying.', true);
```

### Query 2 (New Lead Stage):
```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES ('paste-your-user-id', 'New Lead', 'Browsing', '#3b82f6', 'New Lead if browsing.', false, true, 0);
```

### Query 3 (Qualified Stage):
```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES ('paste-your-user-id', 'Qualified', 'Interested', '#22c55e', 'Qualified if pricing.', false, true, 1);
```

### Query 4 (Hot Lead Stage):
```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES ('paste-your-user-id', 'Hot Lead', 'Buying', '#ef4444', 'Hot Lead if buying.', false, true, 2);
```

**Run each separately in Supabase. Replace paste-your-user-id with your actual id.**

---

## Verify It Worked

```sql
-- Check (replace with your user_id):
SELECT * FROM pipeline_settings WHERE user_id = 'your-user-id';
SELECT name FROM pipeline_stages WHERE user_id = 'your-user-id';
```

Should show 1 setting and 3+ stages.

**Then test in your app!**

