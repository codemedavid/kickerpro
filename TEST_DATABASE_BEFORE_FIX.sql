-- ================================================================
-- TEST: Database Prerequisites Check
-- ================================================================
-- Run this FIRST to verify your database is ready
-- This checks if required tables exist before running FIX_PIPELINE_500_ERROR.sql
-- ================================================================

-- Check 1: Required tables exist
SELECT 
  '📋 Checking Required Tables...' as step;

-- Check if users table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') 
    THEN '✅ users table exists'
    ELSE '❌ ERROR: users table missing - run RUN_THIS_NOW.sql first'
  END as users_table;

-- Check if messenger_conversations table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messenger_conversations') 
    THEN '✅ messenger_conversations table exists'
    ELSE '❌ ERROR: messenger_conversations table missing - run RUN_THIS_NOW.sql first'
  END as messenger_conversations_table;

-- Check 2: See what pipeline tables currently exist
SELECT 
  '📋 Checking Existing Pipeline Tables...' as step;

SELECT 
  table_name,
  CASE 
    WHEN table_name = 'pipeline_stages' THEN '✅ Exists'
    WHEN table_name = 'pipeline_opportunities' THEN '⚠️ Old schema (will be dropped)'
    WHEN table_name = 'opportunities' THEN '✅ Exists (correct schema)'
    WHEN table_name = 'opportunity_activities' THEN '✅ Exists'
    ELSE 'Unknown'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('pipeline_stages', 'pipeline_opportunities', 'opportunities', 'opportunity_activities')
ORDER BY table_name;

-- Check 3: See what lead scoring tables currently exist
SELECT 
  '📋 Checking Lead Scoring Tables...' as step;

SELECT 
  table_name,
  '✅ Exists' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('lead_scoring_settings', 'lead_scores_history')
ORDER BY table_name;

-- Check 4: Column validation for pipeline_stages (if exists)
SELECT 
  '📋 Validating pipeline_stages Columns...' as step;

SELECT 
  column_name,
  data_type,
  CASE 
    WHEN column_name = 'stage_order' THEN '✅ Required column exists'
    WHEN column_name = 'position' THEN '⚠️ Old column name (use stage_order instead)'
    ELSE 'OK'
  END as validation
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'pipeline_stages'
  AND column_name IN ('stage_order', 'position', 'user_id', 'name', 'color', 'is_active')
ORDER BY column_name;

-- Check 5: Test if you have permissions
SELECT 
  '📋 Checking Permissions...' as step;

SELECT 
  CASE 
    WHEN current_user IN ('postgres', 'service_role') 
    THEN '✅ You have admin permissions'
    ELSE '⚠️ Running as: ' || current_user
  END as permission_check;

-- ================================================================
-- FINAL VERDICT
-- ================================================================

SELECT 
  '🎯 VERDICT:' as step,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')
      AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messenger_conversations')
    THEN '✅ SAFE TO RUN FIX_PIPELINE_500_ERROR.sql'
    ELSE '❌ MISSING REQUIRED TABLES - Run RUN_THIS_NOW.sql first'
  END as verdict;

-- ================================================================
-- INSTRUCTIONS
-- ================================================================

SELECT 
  '📝 Next Steps:' as step,
  '1. Review the checks above
2. If all ✅ green checks: Run FIX_PIPELINE_500_ERROR.sql
3. If ❌ red errors: Run RUN_THIS_NOW.sql first
4. After running, restart your dev server (npm run dev)' as instructions;

