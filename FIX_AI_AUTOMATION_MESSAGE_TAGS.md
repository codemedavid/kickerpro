# Fix: AI Automation Message Tags Not Sending

## Issue Summary

AI automations were not properly sending message tags to Facebook's API, causing messages to fail or not be generated. This happened due to several bugs in the message sending code.

## Root Causes

### 1. Incorrect `messaging_type` in execute route
**File**: `src/app/api/ai-automations/execute/route.ts` (Line 246)

**Bug**:
```typescript
messaging_type: rule.message_tag || 'MESSAGE_TAG',  // ❌ WRONG
tag: rule.message_tag || 'ACCOUNT_UPDATE'
```

**Issue**: The `messaging_type` field should always be the literal string `'MESSAGE_TAG'` when using message tags. It was incorrectly using `rule.message_tag` which contains values like `'ACCOUNT_UPDATE'`, `'POST_PURCHASE_UPDATE'`, etc.

**Fix**:
```typescript
messaging_type: 'MESSAGE_TAG',  // ✅ CORRECT
tag: rule.message_tag || 'ACCOUNT_UPDATE'
```

### 2. Missing fallback for null message_tag in trigger route
**File**: `src/app/api/ai-automations/trigger/route.ts` (Line 532)

**Bug**:
```typescript
tag: rule.message_tag  // ❌ Could be null/undefined
```

**Issue**: If `rule.message_tag` was null or undefined, the API request would send `tag: null`, which Facebook rejects.

**Fix**:
```typescript
tag: rule.message_tag || 'ACCOUNT_UPDATE'  // ✅ Always has a value
```

### 3. Missing fallback when creating message record
**File**: `src/app/api/ai-automations/trigger/route.ts` (Line 486)

**Bug**:
```typescript
message_tag: rule.message_tag,  // ❌ Could be null/undefined
```

**Issue**: The message record in the database could have a null message_tag, which would be problematic for tracking and debugging.

**Fix**:
```typescript
message_tag: rule.message_tag || 'ACCOUNT_UPDATE',  // ✅ Always has a value
```

## Changes Made

### 1. Fixed execute route (`src/app/api/ai-automations/execute/route.ts`)
- ✅ Changed `messaging_type` to always use `'MESSAGE_TAG'`
- ✅ Added fallback to `'ACCOUNT_UPDATE'` for null/undefined message tags
- ✅ Added logging to show which tag is being used

### 2. Fixed trigger route (`src/app/api/ai-automations/trigger/route.ts`)
- ✅ Added fallback to `'ACCOUNT_UPDATE'` for null/undefined message tags in API call
- ✅ Added fallback to `'ACCOUNT_UPDATE'` for null/undefined message tags in database record
- ✅ Added logging to show rule configuration and tag being sent

### 3. Created database fix script (`fix-automation-message-tags.sql`)
- ✅ Updates any existing automation rules with NULL message_tag to 'ACCOUNT_UPDATE'
- ✅ Adds documentation comment to the message_tag column

## How to Deploy This Fix

### Step 1: Run the SQL Script
Execute `fix-automation-message-tags.sql` in your Supabase SQL Editor:
```sql
UPDATE ai_automation_rules
SET message_tag = 'ACCOUNT_UPDATE'
WHERE message_tag IS NULL;
```

### Step 2: Deploy the Code Changes
The following files have been updated:
- `src/app/api/ai-automations/execute/route.ts`
- `src/app/api/ai-automations/trigger/route.ts`

Deploy these changes to your production environment.

### Step 3: Test the Fix
1. Navigate to AI Automations page
2. Create or edit an automation rule
3. Verify that message_tag is set (should default to 'ACCOUNT_UPDATE')
4. Trigger the automation manually
5. Check server logs for the new debug messages:
   - `[AI Automation Trigger] Rule config - message_tag: ACCOUNT_UPDATE`
   - `[AI Automation Trigger] Sending message with tag: ACCOUNT_UPDATE to ...`

## Valid Message Tags

When creating automation rules, you can use any of these Facebook-approved message tags:

- **ACCOUNT_UPDATE** (Default) - Account updates, settings changes
- **POST_PURCHASE_UPDATE** - Order updates, shipping notifications
- **CONFIRMED_EVENT_UPDATE** - Event reminders, confirmations
- **HUMAN_AGENT** - Messages from human agents

## Debugging

With the new logging, you can now see:

```
[AI Automation Trigger] Processing rule: Follow-up Sequence
[AI Automation Trigger] Rule config - message_tag: ACCOUNT_UPDATE
[AI Automation Trigger] Sending message with tag: ACCOUNT_UPDATE to John Doe
```

This makes it easy to verify that tags are being sent correctly.

## Prevention

To prevent this issue in the future:

1. ✅ Always use fallback values for message_tag (`|| 'ACCOUNT_UPDATE'`)
2. ✅ Never use `rule.message_tag` directly for `messaging_type` (always use `'MESSAGE_TAG'`)
3. ✅ Set database default values where possible
4. ✅ Add validation in the UI to ensure message_tag is never null

## Testing Checklist

- [ ] Run SQL script in Supabase
- [ ] Deploy code changes to production
- [ ] Verify existing automation rules have message_tag set
- [ ] Create a new automation rule and verify message_tag defaults to 'ACCOUNT_UPDATE'
- [ ] Manually trigger an automation and verify it sends successfully
- [ ] Check server logs for the new debug messages
- [ ] Verify messages appear in Facebook Messenger
- [ ] Test with different message tags (ACCOUNT_UPDATE, POST_PURCHASE_UPDATE, etc.)

## Related Files

- `src/app/api/ai-automations/execute/route.ts` - Scheduled automation execution
- `src/app/api/ai-automations/trigger/route.ts` - Manual automation trigger
- `src/app/dashboard/ai-automations/page.tsx` - UI for creating/editing rules
- `fix-automation-message-tags.sql` - Database migration script

## Impact

This fix ensures that:
- ✅ All AI automation messages are sent with valid message tags
- ✅ Facebook API accepts the messages without errors
- ✅ AI message generation completes successfully
- ✅ Proper logging exists for debugging
- ✅ No null/undefined message tags in the database

