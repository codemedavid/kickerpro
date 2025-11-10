# Debug Bulk Timezone Update Issue

## 🔍 Diagnostic Steps

### Step 1: Open Browser Console
Press F12 → Console tab

### Step 2: Check What's Being Sent
Before clicking bulk update, paste this in console:
```javascript
// This will show what data is being sent
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('bulk-update-timezone')) {
    console.log('=== BULK UPDATE REQUEST ===');
    console.log('URL:', args[0]);
    if (args[1]) {
      console.log('Body:', args[1].body);
    }
  }
  return originalFetch.apply(this, args);
};
```

### Step 3: Try Bulk Update
1. Select 2 contacts (checkboxes)
2. Click "Bulk Update Timezone"
3. Select "US Eastern (New York)"
4. Click "Update & Recompute"

### Step 4: Check Console Output
Look for:
- `=== BULK UPDATE REQUEST ===`
- The conversation_ids being sent
- The timezone being sent
- `[Bulk Timezone Update]` logs
- API Response

### Step 5: Copy Everything
Copy ALL the console output and send it.

---

## 🎯 Alternative: Check Current Data

Run this in Supabase SQL Editor (one query at a time):

### Query 1: See your recommendations
```sql
SELECT id, conversation_id, timezone, timezone_source 
FROM contact_timing_recommendations 
LIMIT 5;
```

### Query 2: See your conversations
```sql
SELECT id, sender_name 
FROM messenger_conversations 
LIMIT 5;
```

### Query 3: Check if conversation_ids match
```sql
SELECT 
  r.id as rec_id,
  r.conversation_id,
  c.id as conv_id,
  c.sender_name
FROM contact_timing_recommendations r
LEFT JOIN messenger_conversations c ON c.id = r.conversation_id
LIMIT 5;
```

If conversation_id is NULL in query 3, that's the problem!

---

## 🚨 Quick Fix to Test

If nothing else works, I'll create a simpler update endpoint that logs everything.

