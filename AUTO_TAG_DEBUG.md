# 🏷️ Auto-Tagging Debug Guide

## Issue Report
Auto-tagging isn't working after bulk sending - selected users aren't being tagged.

## What I Fixed

### 1. **Better Error Handling**
- Changed from `.single()` to `.maybeSingle()` to handle "no results" gracefully
- Added error checking for all database queries
- Improved error logging with full context

### 2. **Enhanced Logging**
- Added detailed logs at each step of the tagging process
- Logs now include page_id, recipient IDs, and specific error messages
- Better visibility into what's happening (or not happening)

### 3. **Potential Issues Identified**

#### **Issue 1: Auto-Tag Not Created**
If the auto-tag isn't being created when the message is sent, tagging won't work.
- **Check:** Verify in compose page that `autoTagId !== 'none'` when submitting
- **Check:** Look for logs: `[Compose] Auto-tag configured successfully`
- **Fix:** Ensure `/api/message-auto-tags` is being called

#### **Issue 2: Conversation Not Found**
Most common issue: The conversation doesn't exist in the database yet.
- **Symptom:** Logs show "No conversation found for recipient"
- **Cause:** Recipient may not have had a conversation synced yet
- **Fix:** Ensure conversations are synced before sending messages

#### **Issue 3: Page ID Mismatch**
Less likely but possible: Page ID mismatch.
- **Check:** Logs should show `page_id: "505302195998738"` (Facebook ID, not UUID)
- **Current:** Using `page.facebook_page_id` which is correct

## Debugging Steps

### Step 1: Check Auto-Tag Creation
1. Send a message with auto-tag selected
2. Check browser console for: `[Compose] Auto-tag configured successfully`
3. Check server logs for: `[Message Auto-tags API]` log entries
4. Verify in database:
```sql
SELECT * FROM message_auto_tags 
WHERE message_id = 'your-message-id';
```

### Step 2: Check Server Logs During Sending
Look for these log patterns:

**✅ Success Path:**
```
[Process Batch API] 🏷️ Starting instant tagging for recipient: ...
[Process Batch API] 🏷️ Auto-tag found: <tag-id>
[Process Batch API] 🏷️ Conversation found: <conversation-id>
[Process Batch API] 🏷️ Making auto-tag API call: ...
[Process Batch API] 🏷️ ✅ Instant tag applied successfully
```

**❌ Failure Paths:**
```
[Process Batch API] 🏷️ No auto-tag configured for message: <message-id>
→ Auto-tag wasn't created or message_id mismatch

[Process Batch API] 🏷️ No conversation found for recipient: ...
→ Conversation doesn't exist - need to sync conversations

[Process Batch API] 🏷️ Error finding conversation: ...
→ Database query error - check RLS policies

[Process Batch API] 🏷️ ❌ Instant tag failed: ...
→ Auto-tag API call failed - check API endpoint
```

### Step 3: Verify Database State

**Check if conversations exist:**
```sql
SELECT id, sender_id, page_id 
FROM messenger_conversations 
WHERE sender_id IN ('recipient-id-1', 'recipient-id-2')
AND page_id = 'facebook-page-id';
```

**Check if tags exist:**
```sql
SELECT id, name 
FROM tags 
WHERE created_by = 'your-user-id';
```

**Check if auto-tag was created:**
```sql
SELECT mat.*, t.name as tag_name
FROM message_auto_tags mat
JOIN tags t ON mat.tag_id = t.id
WHERE mat.message_id = 'your-message-id';
```

**Check if tags were applied:**
```sql
SELECT ct.*, c.sender_id, t.name as tag_name
FROM conversation_tags ct
JOIN messenger_conversations c ON ct.conversation_id = c.id
JOIN tags t ON ct.tag_id = t.id
WHERE c.sender_id IN ('recipient-id-1', 'recipient-id-2')
AND c.page_id = 'facebook-page-id';
```

## Common Fixes

### Fix 1: Sync Conversations First
If conversations don't exist:
1. Go to `/dashboard/conversations`
2. Select the page
3. Click "Sync from Facebook"
4. Wait for sync to complete
5. Then send message with auto-tag

### Fix 2: Check Auto-Tag API
Test the auto-tag API directly:
```javascript
// In browser console
fetch('/api/message-auto-tags', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message_id: 'your-message-id',
    tag_id: 'your-tag-id'
  })
}).then(r => r.json()).then(console.log);
```

### Fix 3: Test Auto-Tag API Endpoint
Test the conversation tagging endpoint:
```javascript
// In browser console
fetch('/api/conversations/auto-tag', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationIds: ['conversation-id'],
    tagIds: ['tag-id']
  })
}).then(r => r.json()).then(console.log);
```

## Next Steps After This Fix

1. **Test with a small batch** (10 recipients)
2. **Check server logs** for detailed error messages
3. **Verify conversations exist** before sending
4. **Check that auto-tag is created** when message is sent

## Expected Behavior

After sending a message with auto-tag:
1. ✅ Auto-tag record created in `message_auto_tags`
2. ✅ Each successful send triggers `instantTagRecipient()`
3. ✅ Conversation is found in database
4. ✅ Tag is applied via `/api/conversations/auto-tag`
5. ✅ Tag appears in `conversation_tags` table
6. ✅ Tag shows up in conversations UI

If any step fails, the enhanced logging will now show exactly where and why.

