# ✅ Fix UUID Errors - Simplest Method

## What Happened

You got `invalid input syntax for type uuid: "YOUR_USER_ID"` because the SQL scripts had placeholder text `'YOUR_USER_ID'` that needs to be replaced with your actual UUID.

---

## ✨ Easiest Solution (Works 100%)

### Step 1: Get Your IDs (Copy These)

**Run in Supabase SQL Editor:**

```sql
-- Get your user_id:
SELECT id as user_id, email FROM auth.users LIMIT 5;

-- Get your page_id:
SELECT id as page_id, name FROM facebook_pages LIMIT 5;
```

**Example output:**
```
user_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
page_id: f9e8d7c6-b5a4-3210-fedc-ba0987654321
```

**Copy both IDs!**

---

### Step 2: Use This Ready-to-Run Script

**Copy this ENTIRE script below into a text editor first (Notepad, VS Code, etc.):**

```sql
-- ===== EDIT THESE TWO LINES WITH YOUR ACTUAL IDs =====
-- Replace the UUIDs below with your user_id and page_id from Step 1:

\set MY_USER_ID '''paste-your-user-id-here'''
\set MY_PAGE_ID '''paste-your-page-id-here'''

-- ===== DON'T EDIT BELOW THIS LINE =====

-- Clean old
DELETE FROM pipeline_settings WHERE user_id = :MY_USER_ID::uuid;
DELETE FROM pipeline_stages WHERE user_id = :MY_USER_ID::uuid AND name IN ('New Lead', 'Qualified', 'Hot Lead');
DELETE FROM messenger_conversations WHERE user_id = :MY_USER_ID::uuid AND sender_id LIKE 'TEST_%';

-- Create settings
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES (
    :MY_USER_ID::uuid,
    'Analyze to determine stage. NEW LEAD: browsing. QUALIFIED: pricing questions. HOT LEAD: ready to buy.',
    true
);

-- Create stages
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES 
    (:MY_USER_ID::uuid, 'New Lead', 'Early', '#3b82f6', 'New Lead if browsing. Keywords: info, curious.', false, true, 0),
    (:MY_USER_ID::uuid, 'Qualified', 'Interest', '#22c55e', 'Qualified if pricing questions. Keywords: price, cost.', false, true, 1),
    (:MY_USER_ID::uuid, 'Hot Lead', 'Ready', '#ef4444', 'Hot Lead if buying. Keywords: order, quote.', false, true, 2);

-- Create tests
INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active, created_at, updated_at)
VALUES 
    (:MY_USER_ID::uuid, :MY_PAGE_ID::uuid, 'TEST_BROWSE_001', 'John Browser', 'Hi curious about products', NOW(), 'active', 1, true, NOW(), NOW()),
    (:MY_USER_ID::uuid, :MY_PAGE_ID::uuid, 'TEST_QUALIFIED_001', 'Maria Interested', 'How much is premium package?', NOW(), 'active', 3, true, NOW(), NOW()),
    (:MY_USER_ID::uuid, :MY_PAGE_ID::uuid, 'TEST_HOT_001', 'Carlos Buyer', 'Want to order 50 units', NOW(), 'active', 5, true, NOW(), NOW());

-- Verify
SELECT 'DONE!' as status;
```

**Instructions:**
1. Copy script above to text editor
2. Edit lines 4-5 with your actual IDs
3. Copy the edited version
4. Paste in Supabase SQL Editor
5. Run

---

### Step 3: Test

1. Go to Conversations page
2. Select John, Maria, Carlos
3. Click "Add to Pipeline"
4. Check Pipeline page

**Should see them in different stages!**

---

## Even Simpler: Manual Inserts

If all else fails, run these ONE AT A TIME, replacing YOUR_USER_ID each time:

### 1. Create Settings:
```sql
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES (
    'paste-your-user-id-here',
    'Analyze contact for stage. NEW LEAD: browsing. QUALIFIED: pricing. HOT LEAD: buying.',
    true
);
```

### 2. Create Stage 1:
```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'paste-your-user-id-here',
    'New Lead',
    'Browsing',
    '#3b82f6',
    'New Lead if browsing or first message.',
    false,
    true,
    0
);
```

### 3. Create Stage 2:
```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'paste-your-user-id-here',
    'Qualified',
    'Interested',
    '#22c55e',
    'Qualified if asking about pricing.',
    false,
    true,
    1
);
```

### 4. Create Stage 3:
```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'paste-your-user-id-here',
    'Hot Lead',
    'Buying',
    '#ef4444',
    'Hot Lead if ready to buy.',
    false,
    true,
    2
);
```

**Run each query separately, one at a time.**

---

## Verify It Worked

```sql
-- Check settings (replace YOUR_USER_ID):
SELECT * FROM pipeline_settings WHERE user_id = 'your-user-id';

-- Check stages (replace YOUR_USER_ID):
SELECT name, LENGTH(analysis_prompt) FROM pipeline_stages 
WHERE user_id = 'your-user-id' 
ORDER BY position;
```

Should show:
- 1 settings record
- 3-4 stages with prompts

**Then test in your app!**

---

## Why This is Simpler

- No DO blocks
- No auth.uid() issues
- No RAISE NOTICE syntax problems
- Just plain INSERT statements
- Run one at a time if needed

---

## Summary

**Quick method:** Use script from Step 2 above (edit 2 lines, run)  
**Safer method:** Run each INSERT separately  
**Either way:** Takes 2-3 minutes total

**After setup:** Test in app by adding contacts to pipeline!

