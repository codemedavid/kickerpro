-- ================================================================
-- PERFORMANCE INDEXES ONLY - NO VERIFICATION QUERIES
-- Run this in your Supabase SQL Editor
-- ================================================================

-- ================================================================
-- MESSENGER_CONVERSATIONS INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_messenger_conversations_user_page 
  ON messenger_conversations(user_id, page_id);

CREATE INDEX IF NOT EXISTS idx_messenger_conversations_time 
  ON messenger_conversations(last_message_time DESC);

CREATE INDEX IF NOT EXISTS idx_messenger_conversations_user_time 
  ON messenger_conversations(user_id, last_message_time DESC);

CREATE INDEX IF NOT EXISTS idx_messenger_conversations_status 
  ON messenger_conversations(conversation_status);

CREATE INDEX IF NOT EXISTS idx_messenger_conversations_common_query 
  ON messenger_conversations(user_id, page_id, conversation_status, last_message_time DESC);

CREATE INDEX IF NOT EXISTS idx_messenger_conversations_sender_lookup 
  ON messenger_conversations(sender_id);

CREATE INDEX IF NOT EXISTS idx_messenger_conversations_sender_name_search 
  ON messenger_conversations USING gin(to_tsvector('english', coalesce(sender_name, '')));

CREATE INDEX IF NOT EXISTS idx_messenger_conversations_message_search 
  ON messenger_conversations USING gin(to_tsvector('english', coalesce(last_message, '')));

-- ================================================================
-- CONTACT_TIMING_RECOMMENDATIONS INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_timing_recommendations_user_page 
  ON contact_timing_recommendations(user_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_timing_recommendations_active_score 
  ON contact_timing_recommendations(user_id, is_active, composite_score DESC NULLS LAST) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_timing_recommendations_cooldown 
  ON contact_timing_recommendations(user_id, cooldown_until, composite_score DESC);

CREATE INDEX IF NOT EXISTS idx_timing_recommendations_name_search 
  ON contact_timing_recommendations USING gin(to_tsvector('english', coalesce(sender_name, '')));

CREATE INDEX IF NOT EXISTS idx_timing_recommendations_confidence 
  ON contact_timing_recommendations(user_id, max_confidence, composite_score DESC);

-- ================================================================
-- CONVERSATION_TAGS INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag_conv 
  ON conversation_tags(tag_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_tags_conv_tag 
  ON conversation_tags(conversation_id, tag_id);

-- ================================================================
-- CONTACT_INTERACTION_EVENTS INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_contact_events_conv_time 
  ON contact_interaction_events(conversation_id, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_contact_events_user_type 
  ON contact_interaction_events(user_id, event_type, is_success);

-- ================================================================
-- CONTACT_TIMING_BINS INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_timing_bins_conv_prob 
  ON contact_timing_bins(conversation_id, smoothed_probability DESC);

-- ================================================================
-- FACEBOOK_PAGES INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_facebook_pages_fb_page_id 
  ON facebook_pages(facebook_page_id);

CREATE INDEX IF NOT EXISTS idx_facebook_pages_user_fb_page 
  ON facebook_pages(user_id, facebook_page_id);

-- ================================================================
-- UPDATE STATISTICS
-- ================================================================

ANALYZE messenger_conversations;
ANALYZE contact_timing_recommendations;
ANALYZE conversation_tags;
ANALYZE contact_interaction_events;
ANALYZE contact_timing_bins;
ANALYZE facebook_pages;

-- ================================================================
-- SUCCESS!
-- ================================================================

SELECT '✅ All indexes created successfully! Performance optimized for 10,000+ contacts.' as status;

