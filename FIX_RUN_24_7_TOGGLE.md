# Fix: Run 24/7 Toggle Not Updating

## 🐛 Problem

The "Run 24/7" toggle switch in the AI Automation UI was not updating or saving properly. When users toggled it on/off, the changes weren't being saved to the database.

## 🔍 Root Causes

### 1. Missing from API Request Body Extraction
**File**: `src/app/api/ai-automations/route.ts` (Line 61-85)

The API was not extracting these fields from the request body:
- ❌ `run_24_7` - Not extracted
- ❌ `active_hours_start_minutes` - Not extracted
- ❌ `active_hours_end_minutes` - Not extracted

### 2. Missing from Database Insert
**File**: `src/app/api/ai-automations/route.ts` (Line 128-145)

The `ruleData` object that gets inserted into the database was missing these fields, so they were never saved.

### 3. Not Loading from Database on Edit
**File**: `src/app/dashboard/ai-automations/page.tsx` (Line 363-371)

When editing an existing rule, the form was not loading the `run_24_7` value from the database. It was always defaulting to `false`.

### 4. Missing Database Columns
The database table `ai_automation_rules` was missing these columns entirely:
- `run_24_7`
- `active_hours_start_minutes`
- `active_hours_end_minutes`

## ✅ What Was Fixed

### 1. API Route - Extract Fields from Request Body
```typescript
// BEFORE (missing fields)
const {
  name,
  description,
  // ... other fields
  active_hours_start = 9,
  active_hours_end = 21,
  // ❌ run_24_7 missing
  // ❌ minutes fields missing
  max_follow_ups,
} = body;

// AFTER (fields added)
const {
  name,
  description,
  // ... other fields
  active_hours_start = 9,
  active_hours_end = 21,
  active_hours_start_minutes = 0,   // ✅ Added
  active_hours_end_minutes = 0,     // ✅ Added
  run_24_7 = false,                  // ✅ Added
  max_follow_ups,
} = body;
```

### 2. API Route - Save Fields to Database
```typescript
// BEFORE (missing fields)
const ruleData: Record<string, unknown> = {
  user_id: userId,
  name,
  // ... other fields
  active_hours_start,
  active_hours_end,
  // ❌ run_24_7 missing
  // ❌ minutes fields missing
  include_tag_ids: include_tag_ids || [],
};

// AFTER (fields added)
const ruleData: Record<string, unknown> = {
  user_id: userId,
  name,
  // ... other fields
  active_hours_start,
  active_hours_end,
  active_hours_start_minutes,  // ✅ Added
  active_hours_end_minutes,    // ✅ Added
  run_24_7,                    // ✅ Added
  include_tag_ids: include_tag_ids || [],
};
```

### 3. UI - Load Values When Editing
```typescript
// BEFORE (hardcoded defaults)
setFormData({
  // ... other fields
  active_hours_start: rule.active_hours_start || 9,
  active_hours_end: rule.active_hours_end || 21,
  active_hours_start_minutes: 0,           // ❌ Always 0
  active_hours_end_minutes: 0,             // ❌ Always 0
  run_24_7: false,                         // ❌ Always false
});

// AFTER (load from database)
setFormData({
  // ... other fields
  active_hours_start: rule.active_hours_start || 9,
  active_hours_end: rule.active_hours_end || 21,
  active_hours_start_minutes: rule.active_hours_start_minutes || 0,  // ✅ From DB
  active_hours_end_minutes: rule.active_hours_end_minutes || 0,      // ✅ From DB
  run_24_7: rule.run_24_7 || false,                                   // ✅ From DB
});
```

### 4. Database Migration Script
Created `add-run-24-7-and-minutes-columns.sql` to add the missing columns.

## 📋 How to Deploy This Fix

### Step 1: Run the SQL Migration (REQUIRED)
Open **Supabase SQL Editor** and run the contents of `add-run-24-7-and-minutes-columns.sql`:

```sql
-- Add run_24_7 column to enable 24/7 operation
ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS run_24_7 BOOLEAN DEFAULT false;

-- Add minute precision to active hours
ALTER TABLE ai_automation_rules 
ADD COLUMN IF NOT EXISTS active_hours_start_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_hours_end_minutes INTEGER DEFAULT 0;

-- Add constraints to ensure valid minute values (0-59)
ALTER TABLE ai_automation_rules
ADD CONSTRAINT IF NOT EXISTS check_start_minutes CHECK (active_hours_start_minutes >= 0 AND active_hours_start_minutes <= 59),
ADD CONSTRAINT IF NOT EXISTS check_end_minutes CHECK (active_hours_end_minutes >= 0 AND active_hours_end_minutes <= 59);

-- Update existing rules to have default values
UPDATE ai_automation_rules
SET 
  run_24_7 = false,
  active_hours_start_minutes = 0,
  active_hours_end_minutes = 0
WHERE run_24_7 IS NULL 
   OR active_hours_start_minutes IS NULL 
   OR active_hours_end_minutes IS NULL;
```

### Step 2: Deploy the Code Changes
The following files have been updated:
- ✅ `src/app/api/ai-automations/route.ts` - API extracts and saves fields
- ✅ `src/app/dashboard/ai-automations/page.tsx` - UI loads values from DB

Push to your repository and deploy to production.

### Step 3: Test the Fix

1. **Create New Automation**
   - Go to AI Automations page
   - Click "Create New Automation"
   - Toggle "Run 24/7" ON
   - Save the automation
   - Refresh the page
   - Edit the automation - verify the toggle is still ON ✅

2. **Edit Existing Automation**
   - Edit an existing automation
   - Toggle "Run 24/7" ON
   - Save changes
   - Refresh the page
   - Edit again - verify the toggle is still ON ✅

3. **Verify Time Restrictions Work**
   - Create an automation with "Run 24/7" OFF
   - Set active hours (e.g., 9:00 AM - 5:00 PM)
   - Save and trigger the automation outside those hours
   - Verify it doesn't send (check logs) ✅

4. **Verify 24/7 Mode Works**
   - Create an automation with "Run 24/7" ON
   - Trigger it at any time (even outside normal hours)
   - Verify it sends messages ✅

## 🎯 Expected Behavior After Fix

### When Run 24/7 is OFF:
- ⏰ Shows time picker for active hours
- 🔒 Only sends messages within specified hours
- 📊 Respects hour + minute precision (e.g., 9:30 AM - 5:45 PM)

### When Run 24/7 is ON:
- 🌍 Hides time picker
- 🔓 Sends messages at any time
- 🚀 No hour restrictions

## 🔍 How to Verify It's Working

Check your automation rule in the database:

```sql
SELECT 
  id,
  name,
  run_24_7,
  active_hours_start,
  active_hours_start_minutes,
  active_hours_end,
  active_hours_end_minutes
FROM ai_automation_rules
ORDER BY created_at DESC;
```

You should see:
- `run_24_7` = `true` or `false` (not NULL)
- `active_hours_start_minutes` = 0-59
- `active_hours_end_minutes` = 0-59

## 🐛 Debugging

If the toggle still doesn't work:

1. **Check Browser Console**
   - Open browser DevTools (F12)
   - Look for errors when saving

2. **Check Server Logs**
   - Look for: `[AI Automations POST] Request body:`
   - Verify `run_24_7` is in the request

3. **Check Database**
   - Run: `SELECT * FROM ai_automation_rules;`
   - Verify the columns exist
   - Verify the values are being saved

4. **Check Network Tab**
   - Open DevTools → Network tab
   - Save an automation
   - Look at the POST request payload
   - Verify `run_24_7` is being sent

## 📁 Files Changed

### Modified:
1. ✅ `src/app/api/ai-automations/route.ts` - Extract and save run_24_7 fields
2. ✅ `src/app/dashboard/ai-automations/page.tsx` - Load run_24_7 from database

### Created:
3. ✅ `add-run-24-7-and-minutes-columns.sql` - Database migration
4. ✅ `FIX_RUN_24_7_TOGGLE.md` - This documentation

## 📊 Technical Details

### Database Schema After Migration:

```sql
CREATE TABLE ai_automation_rules (
  -- ... existing columns ...
  
  -- Active hours (hour component 0-23)
  active_hours_start INTEGER DEFAULT 9,
  active_hours_end INTEGER DEFAULT 21,
  
  -- Active hours (minute component 0-59)
  active_hours_start_minutes INTEGER DEFAULT 0,
  active_hours_end_minutes INTEGER DEFAULT 0,
  
  -- 24/7 mode (bypasses hour restrictions)
  run_24_7 BOOLEAN DEFAULT false,
  
  -- ... other columns ...
);
```

### Frontend State:

```typescript
interface FormData {
  // ... other fields ...
  active_hours_start: number;         // 0-23
  active_hours_end: number;           // 0-23
  active_hours_start_minutes: number; // 0-59
  active_hours_end_minutes: number;   // 0-59
  run_24_7: boolean;                  // true/false
}
```

## ✨ No Linting Errors

All code changes passed ESLint validation. The project is ready to deploy!

---

**Your Run 24/7 toggle is now fixed and will save properly! 🚀**

