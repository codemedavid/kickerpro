# ✅ EXACT STEPS - With Real Example

## The Problem

You need to **replace the placeholder text** with your actual UUID before running the query.

---

## STEP 1: Get Your UUID (Run This)

**In Supabase SQL Editor, run this:**

```sql
SELECT id, email FROM auth.users LIMIT 3;
```

**Example output:**
```
id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
email: yourname@example.com
```

**Copy that id value!** (The long text that looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

---

## STEP 2: Edit the Query BEFORE Running

### ❌ WRONG - Don't run this as-is:
```sql
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES ('PASTE-YOUR-USER-ID-HERE', 'Analyze for stage...', true);
```

### ✅ CORRECT - Replace the text first:

**If your user_id from Step 1 was:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Then change the query to look like this:**
```sql
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Analyze for stage. NEW LEAD: browsing. QUALIFIED: pricing. HOT LEAD: buying.', true);
```

**See the difference?** The placeholder text is **replaced** with the actual UUID!

---

## STEP 3: Run Your Edited Query

**Copy this template, then edit it:**

```sql
-- 🔽 EDIT LINE 2: Replace XXXXX with your actual user_id from Step 1

INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES ('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', 'Analyze for stage. NEW LEAD: browsing. QUALIFIED: pricing. HOT LEAD: buying.', true);
```

**How to edit:**
1. Copy the query above
2. Replace `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX` with your actual user_id
3. Then run it in Supabase

---

## STEP 4: Create Stages (Same Process)

**Copy this, replace the XXXXXs, then run:**

```sql
-- 🔽 EDIT: Replace all 3 XXXXX with your actual user_id

INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position) VALUES
('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', 'New Lead', 'Browsing', '#3b82f6', 'New Lead if first message or browsing.', false, true, 0),
('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', 'Qualified', 'Interested', '#22c55e', 'Qualified if pricing questions.', false, true, 1),
('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', 'Hot Lead', 'Buying', '#ef4444', 'Hot Lead if ready to buy.', false, true, 2);
```

---

## STEP 5: Test in Your App

1. Go to Conversations page
2. Select any 1-2 contacts
3. Click "Add to Pipeline"
4. Check if they sort to New Lead, Qualified, or Hot Lead (not Unmatched)

---

## Real Example (For Reference)

**Let's say your user_id is:** `12345678-abcd-efgh-ijkl-mnopqrstuvwx`

**Then your settings query should look EXACTLY like this:**

```sql
INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
VALUES ('12345678-abcd-efgh-ijkl-mnopqrstuvwx', 'Analyze for stage. NEW LEAD: browsing. QUALIFIED: pricing. HOT LEAD: buying.', true);
```

**And your stages query should look EXACTLY like this:**

```sql
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position) VALUES
('12345678-abcd-efgh-ijkl-mnopqrstuvwx', 'New Lead', 'Browsing', '#3b82f6', 'New Lead if browsing.', false, true, 0),
('12345678-abcd-efgh-ijkl-mnopqrstuvwx', 'Qualified', 'Interested', '#22c55e', 'Qualified if pricing.', false, true, 1),
('12345678-abcd-efgh-ijkl-mnopqrstuvwx', 'Hot Lead', 'Buying', '#ef4444', 'Hot Lead if buying.', false, true, 2);
```

**See?** The placeholder is **completely replaced** with the actual UUID!

---

## Common Mistakes

### ❌ Mistake 1: Running without replacing
```sql
VALUES ('PASTE-YOUR-USER-ID-HERE', ...
```
**Error:** `invalid input syntax for type uuid`

### ❌ Mistake 2: Forgetting quotes
```sql
VALUES (a1b2c3d4-e5f6-7890-abcd-ef1234567890, ...
```
**Error:** Column does not exist

### ✅ Correct:
```sql
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', ...
```
**With quotes around the UUID!**

---

## Alternative: Just Tell Me Your Email

If you share your email address, I can generate the EXACT queries ready to run (you'd just need to paste them in Supabase).

Or give me your user_id if you have it, and I'll generate ready-to-run SQL for you.

---

## Summary

1. **Get user_id:** Run `SELECT id FROM auth.users LIMIT 1;`
2. **Copy the id**
3. **Edit the queries** by replacing placeholder text with your id
4. **Run the edited queries**
5. **Test in app**

**The key:** You MUST replace the placeholder text before running!

