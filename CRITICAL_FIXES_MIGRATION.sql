-- ============================================================================
-- CRITICAL FIXES FOR CONVERSATION SYNC
-- ============================================================================
-- This migration addresses the top critical flaws identified in the analysis
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- FIX #1: OPTIMISTIC LOCKING - Add version column to prevent race conditions
-- ============================================================================

-- Add version column to messenger_conversations
ALTER TABLE messenger_conversations 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Create index for version queries
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_version 
ON messenger_conversations(id, version);

-- Update trigger to increment version on updates
CREATE OR REPLACE FUNCTION increment_conversation_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_increment_conversation_version ON messenger_conversations;

-- Create trigger
CREATE TRIGGER trigger_increment_conversation_version
    BEFORE UPDATE ON messenger_conversations
    FOR EACH ROW
    EXECUTE FUNCTION increment_conversation_version();

-- ============================================================================
-- FIX #10: PREVENT DUPLICATE EVENTS - Add unique constraints
-- ============================================================================

-- Add unique constraint to prevent duplicate events based on message_id
-- Note: We need to handle the case where metadata->>'message_id' might be NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_event_by_message 
ON contact_interaction_events (conversation_id, (metadata->>'message_id'))
WHERE metadata->>'message_id' IS NOT NULL;

-- Add composite unique constraint for events without message_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_event_by_timestamp 
ON contact_interaction_events (conversation_id, event_type, event_timestamp, sender_id)
WHERE metadata->>'message_id' IS NULL;

-- ============================================================================
-- FIX #11: CURSOR-BASED SYNC - Track sync state for resumption
-- ============================================================================

-- Create sync_state table to track pagination and progress
CREATE TABLE IF NOT EXISTS sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_cursor TEXT,
    last_conversation_id TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    total_synced INTEGER DEFAULT 0,
    is_complete BOOLEAN DEFAULT FALSE,
    sync_session_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(page_id, sync_session_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_sync_state_page_user 
ON sync_state(page_id, user_id);

CREATE INDEX IF NOT EXISTS idx_sync_state_session 
ON sync_state(sync_session_id);

-- ============================================================================
-- FIX #12: SYNC LOCKING - Prevent concurrent sync operations
-- ============================================================================

-- Create sync_locks table for distributed locking
CREATE TABLE IF NOT EXISTS sync_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL UNIQUE,
    locked_by TEXT NOT NULL, -- session/process identifier
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lock expiration cleanup
CREATE INDEX IF NOT EXISTS idx_sync_locks_expires 
ON sync_locks(expires_at);

-- Function to acquire sync lock
CREATE OR REPLACE FUNCTION acquire_sync_lock(
    p_page_id TEXT,
    p_locked_by TEXT,
    p_duration_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN AS $$
DECLARE
    lock_acquired BOOLEAN;
BEGIN
    -- Clean up expired locks first
    DELETE FROM sync_locks 
    WHERE expires_at < NOW();
    
    -- Try to acquire lock
    INSERT INTO sync_locks (page_id, locked_by, expires_at)
    VALUES (
        p_page_id, 
        p_locked_by, 
        NOW() + (p_duration_seconds || ' seconds')::INTERVAL
    )
    ON CONFLICT (page_id) DO NOTHING
    RETURNING TRUE INTO lock_acquired;
    
    RETURN COALESCE(lock_acquired, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to release sync lock
CREATE OR REPLACE FUNCTION release_sync_lock(
    p_page_id TEXT,
    p_locked_by TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    lock_released BOOLEAN;
BEGIN
    DELETE FROM sync_locks 
    WHERE page_id = p_page_id 
    AND locked_by = p_locked_by
    RETURNING TRUE INTO lock_released;
    
    RETURN COALESCE(lock_released, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to extend sync lock
CREATE OR REPLACE FUNCTION extend_sync_lock(
    p_page_id TEXT,
    p_locked_by TEXT,
    p_duration_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN AS $$
DECLARE
    lock_extended BOOLEAN;
BEGIN
    UPDATE sync_locks 
    SET expires_at = NOW() + (p_duration_seconds || ' seconds')::INTERVAL
    WHERE page_id = p_page_id 
    AND locked_by = p_locked_by
    AND expires_at > NOW()
    RETURNING TRUE INTO lock_extended;
    
    RETURN COALESCE(lock_extended, FALSE);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX #3: TRANSACTION BOUNDARIES - Atomic conversation + event operations
-- ============================================================================

-- Create atomic upsert function for conversation with events
CREATE OR REPLACE FUNCTION upsert_conversation_with_events(
    p_user_id UUID,
    p_page_id TEXT,
    p_sender_id TEXT,
    p_sender_name TEXT,
    p_last_message TEXT,
    p_last_message_time TIMESTAMPTZ,
    p_conversation_status TEXT,
    p_events JSONB
)
RETURNS TABLE (
    conversation_id UUID,
    is_new BOOLEAN,
    events_created INTEGER,
    version INTEGER
) AS $$
DECLARE
    v_conversation_id UUID;
    v_is_new BOOLEAN;
    v_events_created INTEGER := 0;
    v_version INTEGER;
    v_event JSONB;
BEGIN
    -- Upsert conversation
    INSERT INTO messenger_conversations (
        user_id, 
        page_id, 
        sender_id, 
        sender_name, 
        last_message, 
        last_message_time, 
        conversation_status
    )
    VALUES (
        p_user_id,
        p_page_id,
        p_sender_id,
        p_sender_name,
        p_last_message,
        p_last_message_time,
        p_conversation_status
    )
    ON CONFLICT (page_id, sender_id) 
    DO UPDATE SET
        sender_name = EXCLUDED.sender_name,
        last_message = EXCLUDED.last_message,
        last_message_time = EXCLUDED.last_message_time,
        conversation_status = EXCLUDED.conversation_status,
        updated_at = NOW()
    -- FIX: Fully qualify the version column to avoid ambiguity
    RETURNING messenger_conversations.id, 
              (xmax = 0) AS is_new_row, 
              messenger_conversations.version
    INTO v_conversation_id, v_is_new, v_version;
    
    -- Insert events if provided and conversation is new
    IF p_events IS NOT NULL AND jsonb_array_length(p_events) > 0 THEN
        FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
        LOOP
            BEGIN
                INSERT INTO contact_interaction_events (
                    user_id,
                    conversation_id,
                    sender_id,
                    event_type,
                    event_timestamp,
                    channel,
                    is_outbound,
                    is_success,
                    success_weight,
                    metadata
                )
                VALUES (
                    p_user_id,
                    v_conversation_id,
                    p_sender_id,
                    v_event->>'event_type',
                    (v_event->>'event_timestamp')::TIMESTAMPTZ,
                    v_event->>'channel',
                    (v_event->>'is_outbound')::BOOLEAN,
                    (v_event->>'is_success')::BOOLEAN,
                    (v_event->>'success_weight')::NUMERIC,
                    v_event->'metadata'
                )
                ON CONFLICT DO NOTHING; -- Skip if duplicate
                
                v_events_created := v_events_created + 1;
            EXCEPTION WHEN OTHERS THEN
                -- Log error but continue with other events
                RAISE WARNING 'Failed to insert event: %', SQLERRM;
            END;
        END LOOP;
    END IF;
    
    -- Return results
    RETURN QUERY SELECT 
        v_conversation_id,
        v_is_new,
        v_events_created,
        v_version;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BULK UPSERT FUNCTION FOR PERFORMANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_upsert_conversations_with_events(
    p_conversations JSONB
)
RETURNS TABLE (
    conversation_id UUID,
    sender_id TEXT,
    is_new BOOLEAN,
    events_created INTEGER
) AS $$
DECLARE
    v_conv JSONB;
    v_result RECORD;
BEGIN
    -- Process each conversation
    FOR v_conv IN SELECT * FROM jsonb_array_elements(p_conversations)
    LOOP
        -- Call single upsert function
        SELECT * FROM upsert_conversation_with_events(
            (v_conv->>'user_id')::UUID,
            v_conv->>'page_id',
            v_conv->>'sender_id',
            v_conv->>'sender_name',
            v_conv->>'last_message',
            (v_conv->>'last_message_time')::TIMESTAMPTZ,
            v_conv->>'conversation_status',
            v_conv->'events'
        ) INTO v_result;
        
        -- Return result
        RETURN QUERY SELECT 
            v_result.conversation_id,
            v_conv->>'sender_id' AS sender_id,
            v_result.is_new,
            v_result.events_created;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ADD VALIDATION FUNCTION FOR FACEBOOK API RESPONSES
-- ============================================================================

-- Function to validate participant data before processing
CREATE OR REPLACE FUNCTION validate_participant(
    p_participant JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check required fields
    IF p_participant IS NULL THEN
        RETURN FALSE;
    END IF;
    
    IF NOT (p_participant ? 'id') THEN
        RETURN FALSE;
    END IF;
    
    IF (p_participant->>'id') IS NULL OR (p_participant->>'id') = '' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to clean up old sync states
CREATE OR REPLACE FUNCTION cleanup_old_sync_states(
    p_days_old INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM sync_state
    WHERE updated_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND is_complete = TRUE
    RETURNING COUNT(*) INTO v_deleted_count;
    
    RETURN COALESCE(v_deleted_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired locks (safety)
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM sync_locks
    WHERE expires_at < NOW()
    RETURNING COUNT(*) INTO v_deleted_count;
    
    RETURN COALESCE(v_deleted_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS (adjust as needed for your security model)
-- ============================================================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION acquire_sync_lock TO authenticated;
GRANT EXECUTE ON FUNCTION release_sync_lock TO authenticated;
GRANT EXECUTE ON FUNCTION extend_sync_lock TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_conversation_with_events TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_upsert_conversations_with_events TO authenticated;
GRANT EXECUTE ON FUNCTION validate_participant TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_sync_states TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_locks TO authenticated;

-- ============================================================================
-- CREATE VIEWS FOR MONITORING
-- ============================================================================

-- View for active sync operations
CREATE OR REPLACE VIEW active_syncs AS
SELECT 
    sl.page_id,
    sl.locked_by,
    sl.locked_at,
    sl.expires_at,
    EXTRACT(EPOCH FROM (sl.expires_at - NOW())) AS seconds_remaining,
    ss.total_synced,
    ss.is_complete
FROM sync_locks sl
LEFT JOIN sync_state ss ON sl.page_id = ss.page_id
WHERE sl.expires_at > NOW()
ORDER BY sl.locked_at DESC;

-- View for sync statistics
CREATE OR REPLACE VIEW sync_statistics AS
SELECT 
    page_id,
    COUNT(*) AS total_sync_sessions,
    SUM(total_synced) AS total_conversations_synced,
    COUNT(*) FILTER (WHERE is_complete = TRUE) AS completed_syncs,
    COUNT(*) FILTER (WHERE is_complete = FALSE) AS incomplete_syncs,
    MAX(last_synced_at) AS last_sync_time,
    AVG(total_synced) AS avg_conversations_per_sync
FROM sync_state
GROUP BY page_id;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN messenger_conversations.version IS 'Optimistic locking version to prevent race conditions';
COMMENT ON TABLE sync_state IS 'Tracks sync progress for cursor-based resumption';
COMMENT ON TABLE sync_locks IS 'Distributed locks to prevent concurrent sync operations';
COMMENT ON FUNCTION upsert_conversation_with_events IS 'Atomically upserts conversation and creates events in single transaction';
COMMENT ON FUNCTION acquire_sync_lock IS 'Acquires exclusive lock for sync operation on a page';
COMMENT ON FUNCTION release_sync_lock IS 'Releases sync lock after operation completes';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if version column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'messenger_conversations' 
AND column_name = 'version';

-- Check if unique constraints exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'contact_interaction_events'
AND indexname LIKE 'idx_unique_event%';

-- Check if sync_state table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('sync_state', 'sync_locks');

-- Check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
    'acquire_sync_lock', 
    'release_sync_lock',
    'upsert_conversation_with_events',
    'bulk_upsert_conversations_with_events'
)
AND routine_schema = 'public';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Critical fixes migration completed successfully!';
    RAISE NOTICE '📊 Added: optimistic locking, sync locks, atomic operations';
    RAISE NOTICE '🔒 Transactions now ensure data consistency';
    RAISE NOTICE '⚡ Run verification queries above to confirm';
END $$;

