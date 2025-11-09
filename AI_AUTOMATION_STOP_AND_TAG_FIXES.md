# 🛑 AI Automation - Stop & Tag Management Fixes

## ✅ **Issues Fixed:**

### **1. Stop Automation Now Works** 🛑
- ✅ Cron job now checks `ai_automation_stops` table
- ✅ Stopped conversations are skipped automatically
- ✅ Won't send messages to stopped conversations

### **2. Manual Tag Control** 🏷️
- ✅ No automatic tagging from AI automations  
- ✅ You manually add tags to conversations
- ✅ Automations process only conversations with tags you assigned

### **3. Include Tags Can Be NULL** ✅
- ✅ NULL = Process ALL conversations (no tag filter)
- ✅ Can set specific tags to filter only tagged conversations

---

## 🎯 **How It Works Now:**

### **Workflow - Manual Tag Control:**

```
Step 1: You manually tag conversations
├─ Go to Conversations page
├─ Select conversations you want automated
└─ Add tag: "Needs Follow-up"

Step 2: Create automation with tag filter
├─ Go to AI Automations
├─ Create rule
├─ Set "Include Conversations with Tags" = ["Needs Follow-up"]
└─ Enable automation

Step 3: Automation runs
├─ Finds ONLY conversations with "Needs Follow-up" tag
├─ Sends AI messages to them
└─ No automatic tagging happens

Step 4: Stop automation for specific conversation
├─ Use SQL command (see below)
├─ OR wait for contact to reply (auto-stop)
└─ Automation won't process that conversation again
```

---

## 🛑 **How to Stop Automation for a Conversation**

### **Method 1: SQL Command (Instant)**

```sql
-- Stop automation for specific conversation
INSERT INTO ai_automation_stops (
  rule_id,
  conversation_id,
  sender_id,
  stopped_reason,
  follow_ups_sent
) VALUES (
  'your-rule-id',  -- Get from ai_automation_rules table
  'conversation-id',  -- Get from messenger_conversations table
  'sender-psid',  -- Facebook Page-Scoped ID
  'manual_stop',  -- Reason
  0  -- Number of follow-ups sent so far
)
ON CONFLICT (rule_id, conversation_id) 
DO UPDATE SET stopped_reason = 'manual_stop';
```

### **Method 2: Auto-Stop on Reply** (Automatic)

When contact replies to your automation:
1. ✅ Webhook detects reply
2. ✅ Automatically adds record to `ai_automation_stops`
3. ✅ Future automations skip this conversation

**Requirements:**
- Facebook webhook must be configured
- `stop_on_reply` must be enabled in rule

### **Method 3: Check Who's Stopped**

```sql
-- See all stopped automations
SELECT 
  ar.name as automation_name,
  mc.sender_name,
  aas.stopped_reason,
  aas.follow_ups_sent,
  aas.stopped_at
FROM ai_automation_stops aas
JOIN ai_automation_rules ar ON aas.rule_id = ar.id
LEFT JOIN messenger_conversations mc ON aas.conversation_id = mc.id
ORDER BY aas.stopped_at DESC;
```

---

## 🏷️ **How to Use Tags for Filtering**

### **Option 1: Process ALL Conversations** (No Tag Filter)

```sql
-- Your rule should have:
UPDATE ai_automation_rules 
SET include_tag_ids = NULL,
    exclude_tag_ids = NULL
WHERE id = 'your-rule-id';
```

Result: Processes every conversation that meets time interval criteria.

---

### **Option 2: Process ONLY Tagged Conversations** (Recommended)

**Step 1: Create a tag** (if not exists)
```sql
-- In Supabase
INSERT INTO conversation_tags_master (name, color, user_id)
VALUES ('AI Follow-up', '#3B82F6', 'your-user-id')
RETURNING id;
```

**Step 2: Manually tag conversations you want automated**
```sql
-- Tag specific conversations
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES 
  ('conv-id-1', 'tag-id-from-step-1'),
  ('conv-id-2', 'tag-id-from-step-1'),
  ('conv-id-3', 'tag-id-from-step-1');
```

**OR use the UI:**
1. Go to `/dashboard/conversations`
2. Select conversations
3. Click "Bulk Tag"
4. Choose "AI Follow-up"
5. Click "Apply Tags"

**Step 3: Configure automation to use this tag**
```sql
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['tag-id-from-step-1']
WHERE id = 'your-rule-id';
```

Result: Automation ONLY processes conversations with "AI Follow-up" tag.

---

### **Option 3: Exclude Specific Conversations**

**Tag conversations you DON'T want automated:**
```sql
-- Create "No Automation" tag
INSERT INTO conversation_tags_master (name, color, user_id)
VALUES ('No Automation', '#EF4444', 'your-user-id')
RETURNING id;

-- Configure automation to exclude this tag
UPDATE ai_automation_rules 
SET exclude_tag_ids = ARRAY['no-automation-tag-id']
WHERE id = 'your-rule-id';
```

Result: Automation processes all conversations EXCEPT those with "No Automation" tag.

---

## 📊 **Check Your Configuration**

### **See which conversations are eligible:**

```sql
-- Check eligible conversations for your rule
SELECT 
  mc.sender_name,
  mc.last_message_time,
  NOW() - mc.last_message_time as time_since_last_msg,
  mc.tag_ids,
  EXISTS (
    SELECT 1 FROM ai_automation_stops aas
    WHERE aas.rule_id = 'your-rule-id'
      AND aas.conversation_id = mc.id
  ) as is_stopped
FROM messenger_conversations mc
WHERE mc.user_id = 'your-user-id'
  AND mc.last_message_time < NOW() - INTERVAL '30 minutes'  -- Adjust to your interval
ORDER BY mc.last_message_time DESC
LIMIT 20;
```

Expected columns:
- `sender_name`: Contact name
- `time_since_last_msg`: How long since they messaged
- `tag_ids`: What tags they have (array)
- `is_stopped`: `true` if automation stopped for them

---

## 🔧 **Common Scenarios**

### **Scenario 1: "I want to process everyone"**
```sql
UPDATE ai_automation_rules 
SET include_tag_ids = NULL,
    exclude_tag_ids = NULL
WHERE enabled = true;
```

### **Scenario 2: "Only process people I tagged"**
```sql
-- First tag conversations manually (UI or SQL)
-- Then:
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['your-tag-id']
WHERE enabled = true;
```

### **Scenario 3: "Process everyone except VIPs"**
```sql
-- Tag VIPs manually
-- Then:
UPDATE ai_automation_rules 
SET exclude_tag_ids = ARRAY['vip-tag-id']
WHERE enabled = true;
```

### **Scenario 4: "Stop automation for angry customer"**
```sql
-- Find conversation ID first
SELECT id, sender_name FROM messenger_conversations WHERE sender_name LIKE '%John%';

-- Then stop automation
INSERT INTO ai_automation_stops (rule_id, conversation_id, sender_id, stopped_reason)
VALUES ('rule-id', 'conv-id', 'psid', 'customer_request');
```

---

## 🧪 **Testing the Stop Feature**

### **Test 1: Manual Stop**

```sql
-- 1. Check what conversations will be processed
SELECT id, sender_name FROM messenger_conversations
WHERE last_message_time < NOW() - INTERVAL '30 minutes'
LIMIT 5;

-- 2. Stop one conversation
INSERT INTO ai_automation_stops (rule_id, conversation_id, sender_id, stopped_reason)
VALUES ('your-rule-id', 'test-conv-id', 'test-psid', 'manual_stop_test');

-- 3. Trigger automation (or wait for cron)
-- Visit: /api/cron/ai-automations

-- 4. Check logs - should show "Skipped - automation stopped"

-- 5. Verify in database
SELECT * FROM ai_automation_executions 
WHERE conversation_id = 'test-conv-id'
ORDER BY created_at DESC;
-- Should NOT have new execution after stop
```

### **Test 2: Tag Filtering**

```sql
-- 1. Create test tag
INSERT INTO conversation_tags_master (name, color, user_id)
VALUES ('Test Tag', '#FF0000', 'your-user-id')
RETURNING id;

-- 2. Tag one conversation
INSERT INTO conversation_tags (conversation_id, tag_id)
VALUES ('test-conv-id', 'test-tag-id');

-- 3. Configure automation for this tag
UPDATE ai_automation_rules 
SET include_tag_ids = ARRAY['test-tag-id']
WHERE id = 'your-rule-id';

-- 4. Trigger automation
-- Only the tagged conversation should be processed

-- 5. Verify
SELECT COUNT(*) FROM ai_automation_executions
WHERE rule_id = 'your-rule-id'
  AND created_at > NOW() - INTERVAL '5 minutes';
-- Should be 1 (only the tagged conversation)
```

---

## 📋 **Quick Reference Commands**

### **Stop automation for conversation:**
```sql
INSERT INTO ai_automation_stops (rule_id, conversation_id, sender_id, stopped_reason)
VALUES ('rule-id', 'conv-id', 'psid', 'manual_stop');
```

### **Resume automation (un-stop):**
```sql
DELETE FROM ai_automation_stops 
WHERE rule_id = 'rule-id' AND conversation_id = 'conv-id';
```

### **See all stopped:**
```sql
SELECT * FROM ai_automation_stops ORDER BY stopped_at DESC;
```

### **Process ALL conversations:**
```sql
UPDATE ai_automation_rules SET include_tag_ids = NULL, exclude_tag_ids = NULL;
```

### **Process ONLY tagged:**
```sql
UPDATE ai_automation_rules SET include_tag_ids = ARRAY['tag-id'];
```

### **Exclude specific tag:**
```sql
UPDATE ai_automation_rules SET exclude_tag_ids = ARRAY['tag-id'];
```

---

## ⚠️ **Important Notes**

### **About Automatic Tagging:**
- ✅ AI automations do NOT automatically add tags
- ✅ You must manually tag conversations
- ✅ Only regular "Compose & Send" messages can auto-tag (if configured)

### **About Stop Feature:**
- ✅ Once stopped, conversation stays stopped until you manually resume
- ✅ Reply detection requires Facebook webhook setup
- ✅ Manual stop is instant via SQL command

### **About Tag Filters:**
- ✅ `include_tag_ids = NULL` means process all conversations
- ✅ `include_tag_ids = ARRAY['tag1']` means ONLY process conversations with tag1
- ✅ Can combine include and exclude filters
- ⚠️ If conversation has NO tags and you use include filter → Won't be processed

---

## 🚀 **Recommended Workflow**

1. **Create Tag**: "AI Follow-up Ready"
2. **Tag Conversations**: Manually select conversations in UI
3. **Create Automation**: Set `include_tag_ids` to your tag
4. **Let it Run**: Automation processes only tagged conversations
5. **Stop if Needed**: Use SQL command or wait for reply
6. **Monitor**: Check logs and execution records

---

**✅ Stop automation now works and you have full manual control over tags!**

