# 🧪 Test Pipeline Auto-Sorting

## Quick Diagnostic Test

Run these commands to identify the issue:

### Step 1: Check Environment

```bash
# In terminal at project root:
grep "OPENAI_API_KEY" .env.local
```

**Expected:** Should show your OpenAI API key  
**If not found:** Add `OPENAI_API_KEY=sk-...` to `.env.local` and restart server

---

### Step 2: Check Database Tables

Run in **Supabase SQL Editor**:

```sql
-- Check if tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'pipeline_stages',
      'pipeline_settings', 
      'pipeline_opportunities',
      'pipeline_stage_history'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'pipeline%'
ORDER BY table_name;
```

**Expected:** All 4 tables should exist  
**If missing:** Run pipeline setup SQL

---

### Step 3: Check Your Configuration

Run in **Supabase SQL Editor**:

```sql
-- Replace 'YOUR_USER_ID' with your actual user ID
-- (Get it from browser cookie or auth.users table)

-- 1. Check pipeline settings
SELECT 
  'Pipeline Settings' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ CONFIGURED'
    ELSE '❌ NOT CONFIGURED'
  END as status,
  MAX(LENGTH(global_analysis_prompt)) as prompt_length
FROM pipeline_settings
WHERE user_id = 'YOUR_USER_ID';

-- 2. Check pipeline stages
SELECT 
  'Pipeline Stages' as check_type,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ CONFIGURED (' || COUNT(*) || ' stages)'
    ELSE '❌ NEED AT LEAST 2 STAGES'
  END as status
FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID'
  AND is_active = true;

-- 3. Check if stages have analysis prompts
SELECT 
  'Stage Prompts' as check_type,
  CASE 
    WHEN COUNT(CASE WHEN analysis_prompt IS NOT NULL AND LENGTH(analysis_prompt) > 0 THEN 1 END) >= 2 
    THEN '✅ ' || COUNT(CASE WHEN analysis_prompt IS NOT NULL THEN 1 END) || ' stages have prompts'
    ELSE '❌ NEED PROMPTS FOR STAGES'
  END as status
FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID'
  AND is_active = true;

-- 4. Check for default stage
SELECT 
  'Default Stage' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ DEFAULT EXISTS: ' || MAX(name)
    ELSE '❌ NO DEFAULT STAGE'
  END as status
FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID'
  AND is_default = true
  AND is_active = true;
```

---

### Step 4: Test in Browser Console

1. **Open your app**
2. **Go to Conversations page**
3. **Open DevTools Console** (F12)
4. **Paste and run:**

```javascript
// Test 1: Check authentication
console.log('=== AUTH TEST ===');
const hasAuth = document.cookie.includes('fb-auth-user');
console.log('Authenticated:', hasAuth);

if (!hasAuth) {
  console.error('❌ NOT AUTHENTICATED - Log in first!');
} else {
  console.log('✅ Authenticated');
  
  // Test 2: Check pipeline settings
  console.log('\n=== PIPELINE SETTINGS TEST ===');
  fetch('/api/pipeline/settings')
    .then(r => {
      console.log('Settings API Status:', r.status);
      return r.json();
    })
    .then(d => {
      console.log('Settings Response:', d);
      if (d.settings && d.settings.global_analysis_prompt) {
        console.log('✅ Global prompt configured (length:', d.settings.global_analysis_prompt.length, ')');
      } else {
        console.error('❌ NO GLOBAL PROMPT - Configure in Pipeline Settings!');
      }
    })
    .catch(e => {
      console.error('❌ Settings Error:', e);
    });
  
  // Test 3: Check pipeline stages
  console.log('\n=== PIPELINE STAGES TEST ===');
  fetch('/api/pipeline/stages')
    .then(r => {
      console.log('Stages API Status:', r.status);
      return r.json();
    })
    .then(d => {
      console.log('Stages Response:', d);
      const stages = d.stages || [];
      console.log('Number of stages:', stages.length);
      
      if (stages.length < 2) {
        console.error('❌ NEED AT LEAST 2 STAGES - Create in Pipeline page!');
      } else {
        console.log('✅', stages.length, 'stages found');
        
        const stagesWithPrompts = stages.filter(s => s.analysis_prompt && s.analysis_prompt.length > 0);
        console.log('Stages with prompts:', stagesWithPrompts.length);
        
        if (stagesWithPrompts.length < 2) {
          console.error('❌ STAGES NEED ANALYSIS PROMPTS - Add prompts to stages!');
        } else {
          console.log('✅', stagesWithPrompts.length, 'stages have analysis prompts');
        }
        
        const defaultStage = stages.find(s => s.is_default);
        if (!defaultStage) {
          console.warn('⚠️  NO DEFAULT STAGE - One will be created automatically');
        } else {
          console.log('✅ Default stage:', defaultStage.name);
        }
      }
    })
    .catch(e => {
      console.error('❌ Stages Error:', e);
    });
}

// Test 4: Check OpenAI availability (will show in server console)
console.log('\n=== CHECK SERVER CONSOLE FOR OPENAI KEY ===');
console.log('Look for logs when you add contacts to pipeline');
```

---

### Step 5: Test the Flow

1. **Select 1 contact** in Conversations
2. **Click "Add to Pipeline"**
3. **Watch the console logs**
4. **Check the toast notification**
5. **Go to Pipeline page and verify**

---

## 🔍 Interpreting Results

### ✅ ALL GOOD - Should See:

**Browser Console:**
```
=== AUTH TEST ===
✅ Authenticated
=== PIPELINE SETTINGS TEST ===
Settings API Status: 200
✅ Global prompt configured (length: 245)
=== PIPELINE STAGES TEST ===
Stages API Status: 200
Number of stages: 3
✅ 3 stages found
Stages with prompts: 3
✅ 3 stages have analysis prompts
✅ Default stage: Unmatched
```

**Server Console (when adding to pipeline):**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 1 new contacts
[Pipeline Analyze] ✅ Analyzed Contact Name: Agreed, confidence: 0.85
[Pipeline Bulk API] ✅ AI analysis completed: 1 contacts analyzed
```

**Toast:**
```
✨ Added & Sorted!
1 contact added and automatically sorted to appropriate stages!
```

---

### ❌ MISSING CONFIG - Will See:

**Browser Console:**
```
❌ NO GLOBAL PROMPT - Configure in Pipeline Settings!
```

**Server Console:**
```
[Pipeline Bulk API] Triggering automatic AI analysis for 1 new contacts
[Pipeline Analyze] No global analysis prompt configured
[Pipeline Bulk API] AI analysis failed or not configured: Pipeline settings not configured
```

**Toast:**
```
Added to Pipeline
1 contact added to pipeline. Set up pipeline settings to enable automatic stage sorting.
```

**Fix:** Go to Pipeline → Settings → Add global analysis prompt

---

### ❌ NO STAGES - Will See:

**Browser Console:**
```
❌ NEED AT LEAST 2 STAGES - Create in Pipeline page!
```

**Fix:** Go to Pipeline → Create Stage (create 2-3 stages with prompts)

---

### ❌ NO AUTH - Will See:

**Browser Console:**
```
❌ NOT AUTHENTICATED - Log in first!
```

**Fix:** Log into the application

---

## 🛠️ Quick Fixes

### Fix 1: No Global Prompt

```typescript
// In Pipeline Settings page, add:
"Analyze this contact's conversation to determine their pipeline stage.
Consider: interest level, purchase intent, conversation stage, urgency.
Recommend the most appropriate stage."
```

### Fix 2: No Stage Prompts

For each stage, add an analysis prompt like:

**New Lead:**
```
This contact is a "New Lead" if they are in early exploration stage,
asking general questions, with no clear buying intent yet.
```

### Fix 3: No Default Stage

One stage should have `is_default: true`. Run in Supabase:

```sql
UPDATE pipeline_stages 
SET is_default = true 
WHERE user_id = 'YOUR_USER_ID' 
  AND name = 'Unmatched';
```

---

## 📊 Expected Behavior

### Scenario 1: Everything Configured

1. Add contacts → AI analyzes → Sorts to stages → Toast confirms
2. Check Pipeline page → Contacts in appropriate stages
3. Click contact → See AI reasoning and confidence score

### Scenario 2: Not Configured

1. Add contacts → Skips AI analysis → All go to "Unmatched" → Toast says to configure
2. Check Pipeline page → All in "Unmatched" stage
3. Configure settings → Try again

---

## 🆘 Still Not Working?

**Share these details:**

1. **Browser console output** from Step 4
2. **Server console logs** when adding to pipeline
3. **Toast notification** text
4. **Supabase query results** from Step 3

This will help identify the exact issue!

---

## ✅ Success Checklist

- [ ] OpenAI API key in .env.local
- [ ] Dev server restarted
- [ ] Logged into app
- [ ] Pipeline settings table exists
- [ ] Global analysis prompt configured
- [ ] At least 2 pipeline stages exist
- [ ] Stages have analysis_prompt filled
- [ ] One stage is marked is_default: true
- [ ] Can see conversations in Conversations page
- [ ] Browser console shows no errors

If all checked → Auto-sorting should work! 🎉

