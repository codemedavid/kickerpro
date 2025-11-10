# 🎯 EASIEST TEST - Just Copy/Paste Your ID

## The Simplest Way (2 Minutes Total)

### STEP 1: Get Your IDs (30 seconds)

**Copy and paste this in Supabase SQL Editor:**

```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
SELECT id, name FROM facebook_pages ORDER BY created_at DESC LIMIT 5;
```

**Copy these two IDs:**
- Your `user id` (from first query)
- Your `page id` (from second query)

---

### STEP 2: Run Setup (1 minute)

**Copy this ENTIRE script, then edit lines 5-6 with your IDs:**

```sql
-- ============================================
-- QUICK SETUP - Edit lines 5-6 below with your IDs
-- ============================================

-- Edit these two lines with your actual IDs:
SET user_id = 'paste-your-user-id-here';
SET page_id = 'paste-your-page-id-here';

-- Then run everything below (don't edit anything else)

-- Clean old data
DELETE FROM pipeline_settings WHERE user_id = CAST(current_setting('user_id') AS UUID);

-- Create settings
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
SELECT 
    CAST(current_setting('user_id') AS UUID),
    'Analyze contact to determine stage. NEW LEAD: browsing, general questions. QUALIFIED: specific interest, pricing. HOT LEAD: ready to buy, quote request. Pick best match.',
    true;

-- Create stages
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    CAST(current_setting('user_id') AS UUID),
    'New Lead',
    'Early exploration',
    '#3b82f6',
    'New Lead if: first message, general questions, browsing. Keywords: info, curious.',
    false,
    true,
    0;

INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    CAST(current_setting('user_id') AS UUID),
    'Qualified',
    'Showing interest',
    '#22c55e',
    'Qualified if: interested in products, asked pricing, discussed needs. Keywords: price, cost.',
    false,
    true,
    1;

INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT 
    CAST(current_setting('user_id') AS UUID),
    'Hot Lead',
    'Ready to buy',
    '#ef4444',
    'Hot Lead if: ready to buy, quote request, urgent. Keywords: buy, order, quote.',
    false,
    true,
    2;

-- Create test contacts
DELETE FROM messenger_conversations 
WHERE sender_id LIKE 'TEST_%' 
  AND user_id = CAST(current_setting('user_id') AS UUID);

INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active)
VALUES 
    (CAST(current_setting('user_id') AS UUID), CAST(current_setting('page_id') AS UUID), 'TEST_BROWSE_001', 'John Browser', 'Hi, just curious about what products you offer', NOW(), 'active', 1, true),
    (CAST(current_setting('user_id') AS UUID), CAST(current_setting('page_id') AS UUID), 'TEST_QUALIFIED_001', 'Maria Interested', 'How much is your premium package?', NOW(), 'active', 3, true),
    (CAST(current_setting('user_id') AS UUID), CAST(current_setting('page_id') AS UUID), 'TEST_HOT_001', 'Carlos Buyer', 'I want to order 50 units. Send me a quote', NOW(), 'active', 5, true);

-- Verify
SELECT 'Setup complete!' as status;
SELECT COUNT(*) as settings_count FROM pipeline_settings WHERE user_id = CAST(current_setting('user_id') AS UUID);
SELECT name FROM pipeline_stages WHERE user_id = CAST(current_setting('user_id') AS UUID) ORDER BY position;
SELECT sender_name FROM messenger_conversations WHERE sender_id LIKE 'TEST_%' AND user_id = CAST(current_setting('user_id') AS UUID);
```

**Just edit lines 5-6, then run everything!**

---

### STEP 3: Test in App (1 minute)

1. Go to Conversations page
2. Select TEST_ contacts (John, Maria, Carlos)
3. Click "Add to Pipeline"
4. Check Pipeline page - should be in different stages!

---

## Even Simpler: One-by-One Method

If the above still gives errors, do this:

### A. Get your user_id:
```sql
SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1;
```
Copy the id.

### B. Create settings (replace USER_ID below):
```sql
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES (
    'USER_ID_HERE',
    'Analyze contact for stage. NEW LEAD: browsing. QUALIFIED: pricing questions. HOT LEAD: ready to buy.',
    true
);
```

### C. Create one stage (replace USER_ID below):
```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES (
    'USER_ID_HERE',
    'New Lead',
    'Early exploration',
    '#3b82f6',
    'New Lead if: first message or general questions. Keywords: info, curious.',
    false,
    true,
    0
);
```

### D. Repeat for other stages

Change the VALUES for each stage (Qualified, Hot Lead).

---

## Why Errors Happened

1. **`MAX(boolean)` error** - SQL syntax issue in auto script
2. **`user_id null` error** - auth.uid() doesn't work in DO blocks
3. **`too many parameters in RAISE`** - Percent signs in text caused issues

**Solution:** Use simpler approach with SET variables or direct INSERT

---

## Quick Fix Right Now

**Try this single query** (edit the UUID on line 2):

```sql
-- Replace this UUID with yours:
WITH my_user AS (SELECT 'PASTE-YOUR-USER-ID-HERE'::UUID as uid)

INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
SELECT 
    uid,
    'Analyze contact for stage. NEW LEAD: browsing, general questions. QUALIFIED: pricing questions, showing interest. HOT LEAD: ready to buy, quote request. Pick best match.',
    true
FROM my_user;
```

**Then verify:**
```sql
SELECT * FROM pipeline_settings ORDER BY created_at DESC LIMIT 1;
```

Should show 1 row with your prompt!

---

## Alternative: Use Supabase Dashboard

If SQL is giving too many errors:

1. **Go to Pipeline page** in your app (http://localhost:3000/dashboard/pipeline)
2. **Look for "Settings" button**
3. **Add this global prompt:**
   ```
   Analyze contact for stage. 
   NEW LEAD: browsing, general questions. 
   QUALIFIED: pricing questions, showing interest. 
   HOT LEAD: ready to buy, quote request.
   Pick best match.
   ```
4. **Create stages** via UI if available
5. **Test** by adding contacts

---

## What to Do Now

**Easiest method:**
1. Run first query to get your user_id
2. Copy the UUID
3. Use the "Quick Fix Right Now" query above
4. Replace the UUID
5. Run it
6. Test in your app

**That's it! Settings will be created and auto-sorting will work!**

