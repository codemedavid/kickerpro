-- ================================================================
-- PERFORMANCE OPTIMIZATION FOR 10,000+ CONTACTS
-- Run this in your Supabase SQL Editor
-- FIXED VERSION - No immutable function errors
-- ================================================================

-- ================================================================
-- PART 1: CRITICAL INDEXES FOR MESSENGER_CONVERSATIONS
-- ================================================================

-- Composite index for user + page filtering (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_user_page 
  ON messenger_conversations(user_id, page_id);

-- Index for last_message_time filtering and sorting
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_time 
  ON messenger_conversations(last_message_time DESC);

-- Composite index for user + time range queries
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_user_time 
  ON messenger_conversations(user_id, last_message_time DESC);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_status 
  ON messenger_conversations(conversation_status);

-- Composite index for the most common query: user + page + status + time
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_common_query 
  ON messenger_conversations(user_id, page_id, conversation_status, last_message_time DESC);

-- Index for sender_id lookups
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_sender_lookup 
  ON messenger_conversations(sender_id);

-- Text search index for sender_name and last_message
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_sender_name_search 
  ON messenger_conversations USING gin(to_tsvector('english', coalesce(sender_name, '')));

CREATE INDEX IF NOT EXISTS idx_messenger_conversations_message_search 
  ON messenger_conversations USING gin(to_tsvector('english', coalesce(last_message, '')));

-- ================================================================
-- PART 2: OPTIMIZE CONTACT_TIMING_RECOMMENDATIONS
-- ================================================================

-- Composite index for user + page filtering
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_user_page 
  ON contact_timing_recommendations(user_id, conversation_id);

-- Index for active recommendations with scoring
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_active_score 
  ON contact_timing_recommendations(user_id, is_active, composite_score DESC NULLS LAST) 
  WHERE is_active = true;

-- Index for cooldown filtering (filter in query, not in index predicate)
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_cooldown 
  ON contact_timing_recommendations(user_id, cooldown_until, composite_score DESC);

-- Index for name search
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_name_search 
  ON contact_timing_recommendations USING gin(to_tsvector('english', coalesce(sender_name, '')));

-- Composite index for confidence filtering
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_confidence 
  ON contact_timing_recommendations(user_id, max_confidence, composite_score DESC);

-- ================================================================
-- PART 3: OPTIMIZE CONVERSATION_TAGS FOR FILTERING
-- ================================================================

-- Composite index for tag filtering
CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag_conv 
  ON conversation_tags(tag_id, conversation_id);

-- Reverse index for conversation -> tags lookup
CREATE INDEX IF NOT EXISTS idx_conversation_tags_conv_tag 
  ON conversation_tags(conversation_id, tag_id);

-- ================================================================
-- PART 4: OPTIMIZE CONTACT_INTERACTION_EVENTS
-- ================================================================

-- Index for conversation + timestamp (for event history)
CREATE INDEX IF NOT EXISTS idx_contact_events_conv_time 
  ON contact_interaction_events(conversation_id, event_timestamp DESC);

-- Index for user + type filtering
CREATE INDEX IF NOT EXISTS idx_contact_events_user_type 
  ON contact_interaction_events(user_id, event_type, is_success);

-- ================================================================
-- PART 5: OPTIMIZE CONTACT_TIMING_BINS
-- ================================================================

-- Index for bins by conversation with probability sorting
CREATE INDEX IF NOT EXISTS idx_timing_bins_conv_prob 
  ON contact_timing_bins(conversation_id, smoothed_probability DESC);

-- ================================================================
-- PART 6: ADD MISSING INDEXES FOR FACEBOOK_PAGES
-- ================================================================

-- Index for facebook_page_id lookups
CREATE INDEX IF NOT EXISTS idx_facebook_pages_fb_page_id 
  ON facebook_pages(facebook_page_id);

-- Composite index for user + facebook_page_id
CREATE INDEX IF NOT EXISTS idx_facebook_pages_user_fb_page 
  ON facebook_pages(user_id, facebook_page_id);

-- ================================================================
-- PART 7: VACUUM AND ANALYZE FOR QUERY PLANNER
-- ================================================================

-- Update statistics for query planner
ANALYZE messenger_conversations;
ANALYZE contact_timing_recommendations;
ANALYZE conversation_tags;
ANALYZE contact_interaction_events;
ANALYZE contact_timing_bins;
ANALYZE facebook_pages;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Check index sizes
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename IN (
    'messenger_conversations', 
    'contact_timing_recommendations',
    'conversation_tags',
    'contact_interaction_events'
  )
ORDER BY indexname;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass) as total_size,
  pg_size_pretty(pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass) as table_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'messenger_conversations', 
    'contact_timing_recommendations',
    'conversation_tags'
  )
ORDER BY tablename;

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Database performance optimization complete!';
  RAISE NOTICE '📊 All indexes created for fast querying of 10,000+ contacts';
  RAISE NOTICE '🚀 Query performance should be significantly improved';
  RAISE NOTICE '💡 Run the verification queries above to check index sizes';
END $$;

