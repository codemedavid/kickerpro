# ✅ Run These ONE AT A TIME - Foolproof Method

## First: Get Your User ID

**Run this:**
```sql
SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1;
```

**Copy the id value.** Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

## Then: Run Each Query Below (Replace YOUR_USER_ID)

### Query 1: Delete Old Stages

```sql
DELETE FROM pipeline_stages;
```

**Run this first to start fresh.**

---

### Query 2: Create New Lead Stage

**Before running: Replace YOUR_USER_ID with your actual user_id from above!**

```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES ('YOUR_USER_ID', 'New Lead', 'Early exploration', '#3b82f6', 'New Lead if first message or browsing. Keywords: info, curious.', false, true, 0);
```

**Wait for "Success" message, then continue to Query 3.**

---

### Query 3: Create Qualified Stage

**Replace YOUR_USER_ID with your actual user_id!**

```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES ('YOUR_USER_ID', 'Qualified', 'Showing interest', '#22c55e', 'Qualified if pricing questions or showing interest. Keywords: price, cost, need.', false, true, 1);
```

**Wait for "Success", then continue to Query 4.**

---

### Query 4: Create Hot Lead Stage

**Replace YOUR_USER_ID with your actual user_id!**

```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES ('YOUR_USER_ID', 'Hot Lead', 'Ready to buy', '#ef4444', 'Hot Lead if ready to buy or requesting quote. Keywords: buy, order, quote.', false, true, 2);
```

**Wait for "Success", then continue to Query 5.**

---

### Query 5: Create Unmatched Stage (Default)

**Replace YOUR_USER_ID with your actual user_id!**

```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES ('YOUR_USER_ID', 'Unmatched', 'Needs review', '#94a3b8', 'Default for uncertain cases.', true, true, 999);
```

**Wait for "Success".**

---

## Verify: Check What Was Created

```sql
SELECT name, LENGTH(analysis_prompt), is_default, position 
FROM pipeline_stages 
ORDER BY position;
```

**Should show:**
```
New Lead    | 60+ | false | 0
Qualified   | 80+ | false | 1  
Hot Lead    | 70+ | false | 2
Unmatched   | 30+ | true  | 999
```

**If you see this → Stages are correct!** ✅

---

## Then: Test in Your App

1. Go to Conversations page
2. Select 1-2 contacts
3. Click "Add to Pipeline"
4. Check Pipeline page - should see contacts in different stages!

---

## Example with Real UUID

**If your user_id is:** `12345678-1234-1234-1234-123456789abc`

**Then Query 2 should look like this:**

```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
VALUES ('12345678-1234-1234-1234-123456789abc', 'New Lead', 'Early exploration', '#3b82f6', 'New Lead if first message or browsing. Keywords: info, curious.', false, true, 0);
```

**See?** `YOUR_USER_ID` is completely replaced with the actual UUID (including the quotes).

---

**Run Query 1 now to delete the old stages, then run Queries 2-5 one at a time!**

