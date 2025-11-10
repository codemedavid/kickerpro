-- ============================================
-- DIAGNOSE: Why Pipeline Auto-Sorting Didn't Work
-- Run this in Supabase SQL Editor
-- ============================================

-- Replace 'YOUR_USER_ID' with your actual user ID
-- (Get it from browser cookie or auth.users table)

-- Step 1: Check if pipeline_settings exists and has data
SELECT 
    '=== PIPELINE SETTINGS CHECK ===' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ NO SETTINGS FOUND - This is the problem!'
        ELSE '✅ Settings exist (' || COUNT(*) || ')'
    END as status,
    MAX(LENGTH(global_analysis_prompt)) as prompt_length,
    MAX(SUBSTRING(global_analysis_prompt, 1, 100)) as prompt_preview
FROM pipeline_settings
WHERE user_id = 'YOUR_USER_ID';

-- Step 2: Check pipeline stages
SELECT 
    '=== PIPELINE STAGES CHECK ===' as check_type,
    name,
    is_active,
    is_default,
    CASE 
        WHEN analysis_prompt IS NULL OR LENGTH(analysis_prompt) = 0 
        THEN '❌ NO PROMPT'
        ELSE '✅ Has prompt (' || LENGTH(analysis_prompt) || ' chars)'
    END as prompt_status,
    SUBSTRING(analysis_prompt, 1, 80) as prompt_preview
FROM pipeline_stages
WHERE user_id = 'YOUR_USER_ID'
ORDER BY position;

-- Step 3: Check recent pipeline opportunities (last 10 added)
SELECT 
    '=== RECENT CONTACTS ADDED ===' as check_type,
    po.sender_name,
    ps.name as current_stage,
    ps.is_default as is_in_default_stage,
    po.ai_confidence_score,
    po.both_prompts_agreed,
    po.manually_assigned,
    po.ai_analyzed_at,
    po.created_at,
    CASE 
        WHEN po.ai_analyzed_at IS NULL THEN '❌ NOT ANALYZED'
        WHEN po.both_prompts_agreed = false THEN '⚠️  AI DISAGREED (moved to default)'
        WHEN po.both_prompts_agreed = true THEN '✅ AI AGREED'
        ELSE '❓ Unknown'
    END as analysis_status
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
ORDER BY po.created_at DESC
LIMIT 10;

-- Step 4: Check AI analysis results (if they exist)
SELECT 
    '=== AI ANALYSIS DETAILS ===' as check_type,
    po.sender_name,
    po.ai_analysis_result->>'global_analysis' as global_recommendation,
    po.ai_confidence_score,
    po.both_prompts_agreed,
    po.ai_analyzed_at
FROM pipeline_opportunities po
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.ai_analysis_result IS NOT NULL
ORDER BY po.created_at DESC
LIMIT 5;

-- Step 5: Check for error patterns
SELECT 
    '=== SUMMARY ===' as summary_type,
    COUNT(*) as total_opportunities,
    COUNT(CASE WHEN ai_analyzed_at IS NOT NULL THEN 1 END) as analyzed_count,
    COUNT(CASE WHEN ai_analyzed_at IS NULL THEN 1 END) as not_analyzed_count,
    COUNT(CASE WHEN both_prompts_agreed = true THEN 1 END) as high_confidence,
    COUNT(CASE WHEN both_prompts_agreed = false THEN 1 END) as low_confidence,
    COUNT(CASE WHEN ps.is_default = true THEN 1 END) as in_default_stage
FROM pipeline_opportunities po
JOIN pipeline_stages ps ON po.stage_id = ps.id
WHERE po.user_id = 'YOUR_USER_ID'
  AND po.created_at > NOW() - INTERVAL '24 hours';

-- ============================================
-- COMMON ISSUES AND SOLUTIONS
-- ============================================

/*

ISSUE 1: "❌ NO SETTINGS FOUND"
─────────────────────────────────────────────
Problem: No pipeline settings configured
Solution: 
  1. Go to Pipeline page in your app
  2. Click Settings
  3. Add global analysis prompt
  4. Save

ISSUE 2: Stages show "❌ NO PROMPT"
─────────────────────────────────────────────
Problem: Stages don't have analysis_prompt
Solution:
  1. Go to Pipeline page
  2. Edit each stage
  3. Add analysis_prompt (criteria for that stage)
  4. Save

ISSUE 3: All contacts show "❌ NOT ANALYZED"
─────────────────────────────────────────────
Problem: AI analysis didn't run
Possible causes:
  - Gemini API quota exceeded (wait 24 hours)
  - All 9 API keys hit rate limit
  - Error in analysis code

Check server console logs for errors like:
  [Pipeline Analyze] Error: ...

ISSUE 4: All contacts show "⚠️ AI DISAGREED"
─────────────────────────────────────────────
Problem: Global AI and stage-specific AI disagreed
Solution:
  - Stage prompts might be too strict
  - Make criteria more general
  - Add more keyword examples
  - Review AI reasoning in the analysis_result field

Example: Make prompts less strict
  ❌ Too strict: "Must have asked about pricing AND delivery AND timeline"
  ✅ Better: "Asked about pricing OR delivery OR other purchase details"

ISSUE 5: analysis_status shows "❓ Unknown"
─────────────────────────────────────────────
Problem: AI analysis data is missing or corrupted
Solution:
  - Re-run analysis on those contacts
  - Check if Gemini API returned valid responses

*/

-- ============================================
-- QUICK FIX: Re-analyze specific contacts
-- ============================================

/*

If you want to re-analyze contacts, you can call the API from your app:

In browser console on Conversations page:
```javascript
// Get opportunity IDs
fetch('/api/pipeline/opportunities')
  .then(r => r.json())
  .then(d => {
    const oppIds = d.opportunities.slice(0, 5).map(o => o.id);
    
    // Re-analyze them
    return fetch('/api/pipeline/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity_ids: oppIds })
    });
  })
  .then(r => r.json())
  .then(d => console.log('Re-analysis complete:', d));
```

*/

