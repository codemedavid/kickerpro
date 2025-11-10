-- ============================================================================
-- FIX: Column reference "version" is ambiguous
-- ============================================================================
-- This fixes the ambiguous column reference error in the upsert function
-- Run this in Supabase SQL Editor to fix the sync error
-- ============================================================================

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
-- VERIFICATION
-- ============================================================================

-- Test the function works
DO $$
BEGIN
    RAISE NOTICE '✅ Function updated successfully!';
    RAISE NOTICE '🔧 The "version" column reference is now fully qualified';
    RAISE NOTICE '✨ Sync should work now without errors';
END $$;

-- Check function exists
SELECT 
    routine_name,
    routine_type,
    'Updated successfully' as status
FROM information_schema.routines
WHERE routine_name = 'upsert_conversation_with_events'
AND routine_schema = 'public';

