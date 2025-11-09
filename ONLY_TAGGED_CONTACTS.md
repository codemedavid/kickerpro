# 🏷️ Process ONLY Contacts with Matching Tags

## ✅ **3-Step Setup**

### **Step 1: Create Your Tag (One Time)**

```sql
-- Create a tag for automation
INSERT INTO conversation_tags_master (name, color, user_id)
VALUES ('AI Automation', '#10B981', 'YOUR_USER_ID')
RETURNING id;

-- SAVE THE RETURNED ID! Example: 'abc-123-def-456'
```

---

### **Step 2: Configure Automation to Require Tag**

```sql
-- Set automation to ONLY process conversations with this tag
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['abc-123-def-456']  -- Use ID from Step 1
WHERE id = 'YOUR_RULE_ID';

-- Verify it's set correctly
SELECT 
  name,
  include_tag_ids,
  CASE 
    WHEN include_tag_ids IS NULL THEN '❌ ERROR: Will process ALL'
    WHEN array_length(include_tag_ids, 1) > 0 THEN '✅ CORRECT: Only tagged'
    ELSE '❌ ERROR: Empty array'
  END as status
FROM ai_automation_rules
WHERE id = 'YOUR_RULE_ID';
```

**Expected result:** Status should be `✅ CORRECT: Only tagged`

---

### **Step 3: Tag ONLY the Contacts You Want Processed**

**Option A: Using Dashboard (Recommended)**
1. Go to `/dashboard/conversations`
2. Select conversations you want automated
3. Click "Bulk Tag" button
4. Select "AI Automation" tag
5. Click "Apply Tags"

**Option B: Using SQL**
```sql
-- Tag specific contacts
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES 
  ('conversation-id-1', 'abc-123-def-456'),
  ('conversation-id-2', 'abc-123-def-456'),
  ('conversation-id-3', 'abc-123-def-456')
ON CONFLICT (conversation_id, tag_id) DO NOTHING;
```

---

## 🧪 **Test: Verify Only Tagged Contacts Are Processed**

### **Before Running Automation:**

```sql
-- See which contacts WILL be processed
SELECT 
  mc.sender_name,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_since_last,
  mc.tag_ids,
  CASE 
    WHEN mc.tag_ids @> ARRAY['abc-123-def-456']::TEXT[] THEN '✅ HAS TAG - WILL PROCESS'
    ELSE '❌ NO TAG - WILL SKIP'
  END as will_process
FROM messenger_conversations mc
WHERE mc.user_id = 'YOUR_USER_ID'
  AND mc.last_message_time < NOW() - INTERVAL '30 minutes'  -- Adjust to your interval
ORDER BY mc.last_message_time DESC
LIMIT 20;
```

### **Expected Results:**
- Contacts WITH tag show: `✅ HAS TAG - WILL PROCESS`
- Contacts WITHOUT tag show: `❌ NO TAG - WILL SKIP`

---

### **After Running Automation:**

```sql
-- Check which contacts were actually processed
SELECT 
  mc.sender_name,
  ae.created_at as processed_at,
  ae.status,
  mc.tag_ids
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ae.rule_id = 'YOUR_RULE_ID'
  AND ae.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY ae.created_at DESC;
```

**Expected:** Should ONLY show contacts that have your tag!

---

## 📊 **Count Check**

```sql
-- Compare tagged vs processed
WITH tagged_contacts AS (
  SELECT COUNT(*) as tagged_count
  FROM messenger_conversations
  WHERE user_id = 'YOUR_USER_ID'
    AND tag_ids @> ARRAY['abc-123-def-456']::TEXT[]
    AND last_message_time < NOW() - INTERVAL '30 minutes'
),
processed_contacts AS (
  SELECT COUNT(*) as processed_count
  FROM ai_automation_executions ae
  JOIN messenger_conversations mc ON ae.conversation_id = mc.id
  WHERE ae.rule_id = 'YOUR_RULE_ID'
    AND ae.created_at > NOW() - INTERVAL '10 minutes'
)
SELECT 
  tc.tagged_count as contacts_with_tag,
  pc.processed_count as contacts_processed,
  CASE 
    WHEN tc.tagged_count >= pc.processed_count THEN '✅ CORRECT'
    ELSE '❌ ERROR: Processed more than tagged!'
  END as verification
FROM tagged_contacts tc, processed_contacts pc;
```

---

## 🚫 **What Gets SKIPPED**

Contacts will be **SKIPPED** if:
- ❌ They don't have your tag
- ❌ They have a different tag
- ❌ They have NO tags at all
- ❌ Their last message is too recent
- ❌ They're in the `ai_automation_stops` table

Only contacts with **EXACTLY** the tag you specified will be processed.

---

## 🎯 **Example Workflow**

```sql
-- 1. Create tag
INSERT INTO conversation_tags_master (name, color, user_id)
VALUES ('Hot Leads', '#EF4444', 'my-user-id')
RETURNING id;
-- Returns: 'tag-hot-leads-123'

-- 2. Configure automation
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['tag-hot-leads-123']
WHERE id = 'my-rule-id';

-- 3. Tag 3 specific contacts
INSERT INTO conversation_tags (conversation_id, tag_id)
SELECT id, 'tag-hot-leads-123'
FROM messenger_conversations
WHERE sender_name IN ('John Doe', 'Jane Smith', 'Bob Wilson')
ON CONFLICT DO NOTHING;

-- 4. Verify only these 3 will be processed
SELECT COUNT(*) as will_process
FROM messenger_conversations
WHERE tag_ids @> ARRAY['tag-hot-leads-123']::TEXT[];
-- Should return: 3

-- 5. Run automation
-- Visit: /api/cron/ai-automations

-- 6. Verify only these 3 were processed
SELECT sender_name, created_at
FROM ai_automation_executions ae
JOIN messenger_conversations mc ON ae.conversation_id = mc.id
WHERE ae.rule_id = 'my-rule-id'
  AND ae.created_at > NOW() - INTERVAL '10 minutes';
-- Should show: John Doe, Jane Smith, Bob Wilson only
```

---

## ⚠️ **Common Issues**

### **Issue: "Automation processing everyone, not just tagged"**

**Check 1: Is tag filter set?**
```sql
SELECT include_tag_ids FROM ai_automation_rules WHERE id = 'YOUR_RULE_ID';
```
- If `NULL` → ❌ NO FILTER! Set it:
  ```sql
  UPDATE ai_automation_rules SET include_tag_ids = ARRAY['tag-id'] WHERE id = 'YOUR_RULE_ID';
  ```

**Check 2: Is it an empty array?**
```sql
SELECT 
  include_tag_ids,
  array_length(include_tag_ids, 1) as tag_count
FROM ai_automation_rules WHERE id = 'YOUR_RULE_ID';
```
- If `tag_count` is `NULL` → ❌ Empty! Add a tag ID.

---

### **Issue: "Tagged contact not being processed"**

**Check 1: Does conversation have the tag?**
```sql
SELECT 
  sender_name,
  tag_ids,
  tag_ids @> ARRAY['your-tag-id']::TEXT[] as has_tag
FROM messenger_conversations
WHERE id = 'conversation-id';
```

**Check 2: Is conversation old enough?**
```sql
SELECT 
  sender_name,
  last_message_time,
  EXTRACT(EPOCH FROM (NOW() - last_message_time))/60 as minutes_ago
FROM messenger_conversations
WHERE id = 'conversation-id';
-- Should be older than your time_interval_minutes
```

**Check 3: Is conversation stopped?**
```sql
SELECT * FROM ai_automation_stops 
WHERE conversation_id = 'conversation-id'
  AND rule_id = 'YOUR_RULE_ID';
-- Should be empty if not stopped
```

---

## 🔒 **Safety Verification**

Run this to ensure your setup is correct:

```sql
DO $$
DECLARE
  rule_record RECORD;
  tagged_count INTEGER;
  untagged_count INTEGER;
BEGIN
  SELECT * INTO rule_record
  FROM ai_automation_rules
  WHERE id = 'YOUR_RULE_ID';
  
  IF rule_record.include_tag_ids IS NULL OR array_length(rule_record.include_tag_ids, 1) IS NULL THEN
    RAISE WARNING '❌ DANGER: No tag filter! Will process ALL conversations!';
    RAISE WARNING 'FIX: UPDATE ai_automation_rules SET include_tag_ids = ARRAY[''tag-id''] WHERE id = ''%'';', rule_record.id;
  ELSE
    SELECT COUNT(*) INTO tagged_count
    FROM messenger_conversations
    WHERE user_id = rule_record.user_id
      AND tag_ids && rule_record.include_tag_ids;
    
    SELECT COUNT(*) INTO untagged_count
    FROM messenger_conversations
    WHERE user_id = rule_record.user_id
      AND NOT (tag_ids && rule_record.include_tag_ids);
    
    RAISE NOTICE '✅ Tag filter active: %', rule_record.include_tag_ids;
    RAISE NOTICE '📊 Contacts WITH tag: %', tagged_count;
    RAISE NOTICE '📊 Contacts WITHOUT tag: % (will be SKIPPED)', untagged_count;
  END IF;
END $$;
```

---

## 📋 **Quick Reference**

```sql
-- Set tag requirement
UPDATE ai_automation_rules SET include_tag_ids = ARRAY['tag-id'] WHERE id = 'rule-id';

-- Tag one contact
INSERT INTO conversation_tags (conversation_id, tag_id) VALUES ('conv-id', 'tag-id');

-- See tagged contacts
SELECT sender_name FROM messenger_conversations WHERE tag_ids @> ARRAY['tag-id']::TEXT[];

-- Count tagged contacts
SELECT COUNT(*) FROM messenger_conversations WHERE tag_ids @> ARRAY['tag-id']::TEXT[];

-- Remove tag (stop processing)
DELETE FROM conversation_tags WHERE conversation_id = 'conv-id' AND tag_id = 'tag-id';

-- Check automation config
SELECT name, include_tag_ids FROM ai_automation_rules WHERE id = 'rule-id';
```

---

## ✅ **Final Checklist**

Before enabling automation:

- [ ] Tag is created in `conversation_tags_master`
- [ ] Automation has `include_tag_ids = ARRAY['tag-id']` (NOT NULL!)
- [ ] Specific contacts are tagged manually
- [ ] Verified only tagged contacts show as "WILL PROCESS"
- [ ] Tested with 1-2 contacts first
- [ ] Checked execution records show only tagged contacts

---

## 🎯 **Summary**

**To process ONLY contacts with matching tags:**

1. ✅ Set `include_tag_ids` in your automation rule
2. ✅ Manually tag ONLY the contacts you want processed
3. ✅ Automation will SKIP all untagged contacts
4. ✅ Remove tag to stop processing a contact

**Guarantee:** The code filters conversations using:
```sql
WHERE tag_ids @> include_tag_ids
```
This means **only contacts with your specified tag(s) are included**.

---

**✅ Only contacts with matching tags will be processed!** 🏷️

