-- ================================================================
-- DATABASE VERIFICATION QUERIES
-- Best Time to Contact - Validate Schema and Data Integrity
-- ================================================================

-- Run these queries in Supabase SQL Editor to verify installation

\echo '============================================'
\echo 'DATABASE VERIFICATION - Best Time to Contact'
\echo '============================================'
\echo ''

-- ================================================================
-- TEST 1: Verify all tables exist
-- ================================================================

\echo '📋 TEST 1: Verify Tables Exist'
\echo '─────────────────────────────────────'

SELECT 
  CASE 
    WHEN COUNT(*) = 6 THEN '✅ PASS - All 6 tables exist'
    ELSE '❌ FAIL - Expected 6 tables, found ' || COUNT(*)
  END as result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'contact_interaction_events',
    'contact_timing_bins',
    'contact_timing_recommendations',
    'contact_timing_segment_priors',
    'contact_timing_config',
    'contact_timing_executions'
  );

-- List all tables
SELECT table_name, 
       pg_size_pretty(pg_total_relation_size(quote_ident(table_name)::regclass)) as size
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'contact_%'
ORDER BY table_name;

\echo ''

-- ================================================================
-- TEST 2: Verify RLS is enabled
-- ================================================================

\echo '🔒 TEST 2: Verify Row Level Security'
\echo '─────────────────────────────────────'

SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ Enabled'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'contact_%'
ORDER BY tablename;

\echo ''

-- ================================================================
-- TEST 3: Verify RLS policies exist
-- ================================================================

\echo '🛡️ TEST 3: Verify RLS Policies'
\echo '─────────────────────────────────────'

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'contact_%'
ORDER BY tablename, policyname;

-- Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ OK'
    ELSE '⚠️  Low policy count'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'contact_%'
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- ================================================================
-- TEST 4: Verify indexes exist
-- ================================================================

\echo '📑 TEST 4: Verify Indexes'
\echo '─────────────────────────────────────'

SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'contact_%'
ORDER BY tablename, indexname;

-- Count indexes per table
SELECT 
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'contact_%'
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- ================================================================
-- TEST 5: Verify constraints
-- ================================================================

\echo '🎯 TEST 5: Verify CHECK Constraints'
\echo '─────────────────────────────────────'

SELECT 
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name LIKE 'contact_%'
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

\echo ''

-- ================================================================
-- TEST 6: Verify foreign keys
-- ================================================================

\echo '🔗 TEST 6: Verify Foreign Keys'
\echo '─────────────────────────────────────'

SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name LIKE 'contact_%'
ORDER BY tc.table_name;

\echo ''

-- ================================================================
-- TEST 7: Verify data counts
-- ================================================================

\echo '📊 TEST 7: Data Counts'
\echo '─────────────────────────────────────'

SELECT 'contact_interaction_events' as table_name, COUNT(*) as record_count 
FROM contact_interaction_events
UNION ALL
SELECT 'contact_timing_bins', COUNT(*) 
FROM contact_timing_bins
UNION ALL
SELECT 'contact_timing_recommendations', COUNT(*) 
FROM contact_timing_recommendations
UNION ALL
SELECT 'contact_timing_segment_priors', COUNT(*) 
FROM contact_timing_segment_priors
UNION ALL
SELECT 'contact_timing_config', COUNT(*) 
FROM contact_timing_config
UNION ALL
SELECT 'contact_timing_executions', COUNT(*) 
FROM contact_timing_executions;

\echo ''

-- ================================================================
-- TEST 8: Verify test data
-- ================================================================

\echo '🧪 TEST 8: Verify Test Data'
\echo '─────────────────────────────────────'

-- Count test events
SELECT 
  COUNT(*) as test_events,
  COUNT(DISTINCT conversation_id) as test_contacts
FROM contact_interaction_events
WHERE metadata->>'test' = 'true';

-- Test event distribution
SELECT 
  event_type,
  COUNT(*) as count,
  AVG(success_weight) as avg_success_weight
FROM contact_interaction_events
WHERE metadata->>'test' = 'true'
GROUP BY event_type
ORDER BY count DESC;

\echo ''

-- ================================================================
-- TEST 9: Verify probability constraints
-- ================================================================

\echo '✓ TEST 9: Verify Probability Ranges (0-1)'
\echo '─────────────────────────────────────'

SELECT 
  'contact_timing_bins' as table_name,
  COUNT(*) as total_bins,
  SUM(CASE WHEN raw_probability < 0 OR raw_probability > 1 THEN 1 ELSE 0 END) as invalid_raw,
  SUM(CASE WHEN smoothed_probability < 0 OR smoothed_probability > 1 THEN 1 ELSE 0 END) as invalid_smoothed,
  CASE 
    WHEN SUM(CASE WHEN raw_probability < 0 OR raw_probability > 1 THEN 1 ELSE 0 END) = 0 
     AND SUM(CASE WHEN smoothed_probability < 0 OR smoothed_probability > 1 THEN 1 ELSE 0 END) = 0
    THEN '✅ PASS - All probabilities valid'
    ELSE '❌ FAIL - Found invalid probabilities'
  END as status
FROM contact_timing_bins;

SELECT 
  'contact_timing_recommendations' as table_name,
  COUNT(*) as total_recommendations,
  SUM(CASE WHEN max_confidence < 0 OR max_confidence > 1 THEN 1 ELSE 0 END) as invalid_confidence,
  SUM(CASE WHEN composite_score < 0 OR composite_score > 1 THEN 1 ELSE 0 END) as invalid_score,
  CASE 
    WHEN SUM(CASE WHEN max_confidence < 0 OR max_confidence > 1 THEN 1 ELSE 0 END) = 0 
     AND SUM(CASE WHEN composite_score < 0 OR composite_score > 1 THEN 1 ELSE 0 END) = 0
    THEN '✅ PASS - All scores valid'
    ELSE '❌ FAIL - Found invalid scores'
  END as status
FROM contact_timing_recommendations;

\echo ''

-- ================================================================
-- TEST 10: Verify recommended windows
-- ================================================================

\echo '🪟 TEST 10: Verify Recommended Windows'
\echo '─────────────────────────────────────'

SELECT 
  sender_name,
  jsonb_array_length(recommended_windows) as window_count,
  recommended_windows->0->>'dow' as top_day,
  recommended_windows->0->>'start' as top_time,
  (recommended_windows->0->>'confidence')::numeric as top_confidence
FROM contact_timing_recommendations
WHERE recommended_windows != '[]'::jsonb
LIMIT 10;

\echo ''

-- ================================================================
-- TEST 11: Verify 168 bins per contact
-- ================================================================

\echo '📦 TEST 11: Verify 168 Bins Per Contact'
\echo '─────────────────────────────────────'

SELECT 
  conversation_id,
  COUNT(*) as bin_count,
  CASE 
    WHEN COUNT(*) = 168 THEN '✅ Complete'
    WHEN COUNT(*) < 168 THEN '⚠️  Partial (' || COUNT(*) || ' bins)'
    ELSE '❌ Too many (' || COUNT(*) || ' bins)'
  END as status
FROM contact_timing_bins
GROUP BY conversation_id
ORDER BY bin_count DESC
LIMIT 10;

\echo ''

-- ================================================================
-- TEST 12: Verify triggers exist
-- ================================================================

\echo '⚙️  TEST 12: Verify Triggers'
\echo '─────────────────────────────────────'

SELECT 
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table LIKE 'contact_%'
ORDER BY event_object_table, trigger_name;

\echo ''

-- ================================================================
-- SUMMARY
-- ================================================================

\echo '═══════════════════════════════════════'
\echo 'VERIFICATION COMPLETE'
\echo '═══════════════════════════════════════'
\echo ''
\echo 'Review results above. All tests should show ✅ PASS'
\echo ''
