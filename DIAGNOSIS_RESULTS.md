# Pipeline Sorting Diagnosis

## How to Run Diagnosis

### Step 1: Get Your User ID

Run in Supabase SQL Editor:
```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
```

Copy your user ID.

### Step 2: Run Diagnostic

1. Open `diagnose-current-state.sql`
2. Replace `'YOUR_USER_ID'` with your actual user ID (in 3 places)
3. Run the entire script in Supabase SQL Editor

### Step 3: Review Results

The script will show:
- Pipeline settings status
- Stage configuration
- Recent contacts and their analysis status
- Primary issue diagnosis

## Common Issues and What They Mean

### Issue 1: "NO SETTINGS FOUND"
**Meaning:** The pipeline_settings table has no record for your user
**Impact:** AI analysis will not run at all
**Fix:** Need to create pipeline settings with global analysis prompt

### Issue 2: "Stages missing analysis prompts"
**Meaning:** Your stages exist but don't have analysis_prompt filled
**Impact:** Stage-specific AI cannot validate, all contacts go to default
**Fix:** Add analysis_prompt to each stage

### Issue 3: "AI analysis did not run"
**Meaning:** ai_analyzed_at is NULL for contacts
**Possible causes:**
- Gemini API quota exceeded
- Error in analysis code
- Settings exist but analysis failed
**Check:** Server console logs for errors

### Issue 4: "Most contacts disagreed"
**Meaning:** AI analysis ran but prompts didn't agree
**Impact:** Contacts moved to default for manual review
**Fix:** Make stage prompts less strict, add more keywords

## Server Log Patterns

### Pattern 1: Not Configured
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] No global analysis prompt configured
[Pipeline Bulk API] AI analysis failed or not configured: Pipeline settings not configured
```
**Root Cause:** No pipeline_settings record
**Fix Phase:** 2.1, 2.2

### Pattern 2: API Quota Exceeded
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] Error: You exceeded your current quota
[Pipeline Analyze] Key #1 rate limited, trying next key...
[Pipeline Analyze] All 9 API keys failed
```
**Root Cause:** Gemini free tier limit reached
**Fix Phase:** 2.3 (wait for reset)

### Pattern 3: Prompts Disagreed
```
[Pipeline Bulk API] Triggering automatic AI analysis for 2 new contacts
[Pipeline Analyze] ✅ Analyzed Contact 1: Disagreed, confidence: 0
[Pipeline Analyze] ✅ Analyzed Contact 2: Disagreed, confidence: 0
```
**Root Cause:** Stage criteria too strict or mismatched
**Fix Phase:** 2.1 (adjust prompts)

### Pattern 4: Missing Stage Prompts
```
[Pipeline Analyze] Warning: Stage "New Lead" has no analysis_prompt, skipping
```
**Root Cause:** Stages created without analysis_prompt
**Fix Phase:** 2.2

## Next Steps Based on Diagnosis

After running the diagnostic, proceed to:
- If "NO SETTINGS" → Phase 2.1 (setup script)
- If "Missing prompts" → Phase 2.2 (fix configuration)
- If "API quota" → Phase 2.3 (wait for reset, continue with test setup)
- If "Disagreed" → Phase 2.1 (better prompts)

