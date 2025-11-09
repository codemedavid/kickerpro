# 🛑 Stop Automation & Manual Tags - QUICK START

## ✅ **What Was Fixed:**

1. ✅ **Stop automation now works** - Cron checks stopped conversations
2. ✅ **No auto-tagging** - You manually control all tags
3. ✅ **NULL tags is OK** - Means "process all conversations"

---

## 🚀 **Quick Actions**

### **Stop Automation for One Conversation:**

```sql
-- Step 1: Find conversation ID
SELECT id, sender_name, sender_id 
FROM messenger_conversations 
WHERE sender_name LIKE '%Customer Name%';

-- Step 2: Stop it
INSERT INTO ai_automation_stops (rule_id, conversation_id, sender_id, stopped_reason)
VALUES (
  'your-rule-id',  -- From ai_automation_rules table
  'conversation-id',  -- From step 1
  'sender-psid',  -- From step 1 (sender_id)
  'manual_stop'
);
```

### **Resume (Un-stop) a Conversation:**

```sql
DELETE FROM ai_automation_stops 
WHERE rule_id = 'your-rule-id' 
  AND conversation_id = 'conversation-id';
```

### **See All Stopped Conversations:**

```sql
SELECT 
  ar.name as automation,
  mc.sender_name,
  aas.stopped_reason,
  aas.stopped_at
FROM ai_automation_stops aas
JOIN ai_automation_rules ar ON aas.rule_id = ar.id
LEFT JOIN messenger_conversations mc ON aas.conversation_id = mc.id
ORDER BY aas.stopped_at DESC;
```

---

## 🏷️ **Tag Management Workflow**

### **Option 1: Process ALL Conversations (No Filter)**

```sql
UPDATE ai_automation_rules 
SET include_tag_ids = NULL,
    exclude_tag_ids = NULL
WHERE id = 'your-rule-id';
```

Result: Automation processes **every** conversation meeting time criteria.

---

### **Option 2: Process ONLY Tagged Conversations** (Recommended)

**Step 1: Create tag** (one time)
```sql
INSERT INTO conversation_tags_master (name, color, user_id)
VALUES ('AI Follow-up', '#3B82F6', 'your-user-id')
RETURNING id;
-- Save the returned ID!
```

**Step 2: Tag conversations manually**

In the UI:
1. Go to `/dashboard/conversations`
2. Select conversations you want automated
3. Click "Bulk Tag"
4. Select "AI Follow-up"
5. Apply

Or in SQL:
```sql
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES 
  ('conv-id-1', 'tag-id-from-step-1'),
  ('conv-id-2', 'tag-id-from-step-1');
```

**Step 3: Configure automation**
```sql
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['tag-id-from-step-1']
WHERE id = 'your-rule-id';
```

Result: Automation processes **ONLY** conversations you tagged.

---

### **Option 3: Exclude Specific Conversations**

```sql
-- Tag VIPs or sensitive customers
-- Then exclude them from automation:
UPDATE ai_automation_rules 
SET exclude_tag_ids = ARRAY['vip-tag-id']
WHERE id = 'your-rule-id';
```

---

## 📊 **Check What Will Be Processed**

```sql
SELECT 
  mc.sender_name,
  mc.last_message_time,
  EXTRACT(EPOCH FROM (NOW() - mc.last_message_time))/60 as minutes_ago,
  EXISTS (
    SELECT 1 FROM ai_automation_stops aas
    WHERE aas.conversation_id = mc.id
      AND aas.rule_id = 'your-rule-id'
  ) as is_stopped,
  CASE 
    WHEN EXISTS (SELECT 1 FROM ai_automation_stops aas WHERE aas.conversation_id = mc.id AND aas.rule_id = 'your-rule-id')
    THEN '🛑 STOPPED'
    ELSE '✅ WILL PROCESS'
  END as status
FROM messenger_conversations mc
WHERE mc.user_id = 'your-user-id'
  AND mc.last_message_time < NOW() - INTERVAL '30 minutes'  -- Adjust to your interval
ORDER BY mc.last_message_time DESC
LIMIT 20;
```

---

## 🎯 **Common Use Cases**

### **"Process everyone except people I mark"**
1. Create "No Automation" tag
2. Tag customers you want to exclude
3. Set `exclude_tag_ids` in automation rule

### **"Only process warm leads I manually select"**
1. Create "Warm Lead" tag  
2. Manually tag promising conversations
3. Set `include_tag_ids` in automation rule

### **"Stop annoying an angry customer"**
1. Run stop command with their conversation ID
2. Automation skips them forever (until you resume)

### **"Test on a few conversations first"**
1. Create "Test" tag
2. Tag 3-5 conversations
3. Set `include_tag_ids` to "Test" tag
4. Let automation run
5. Check results
6. If good, remove tag filter or tag more conversations

---

## 📁 **Files Created**

1. **`AI_AUTOMATION_STOP_AND_TAG_FIXES.md`** - Full documentation
2. **`stop-automation-helper.sql`** - All SQL commands you need
3. **`AUTOMATION_STOP_QUICK_START.md`** - This file (quick reference)

---

## ⚠️ **Important Notes**

- ✅ Stopping is **permanent** until you manually resume
- ✅ `include_tag_ids = NULL` is **normal** (means process all)
- ✅ Tags must be manually added (no auto-tagging from AI automation)
- ✅ Regular "Compose & Send" messages can still auto-tag if configured
- ✅ Stopped conversations show in logs: `"🛑 Skipped - automation stopped"`

---

## 🧪 **Quick Test**

1. Stop one conversation (use SQL above)
2. Trigger automation: Visit `/api/cron/ai-automations`  
3. Check Vercel logs
4. Should see: `"🛑 Skipped - automation stopped (reason: manual_stop)"`
5. ✅ Success! Stop feature is working

---

**For complete documentation, see `AI_AUTOMATION_STOP_AND_TAG_FIXES.md`**  
**For all SQL commands, see `stop-automation-helper.sql`**

