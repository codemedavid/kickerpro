-- ================================================================
-- STEP 1: Fix messenger_conversations table
-- Run this FIRST before the pipeline tables
-- WORKING VERSION - Fixed naming conflicts
-- ================================================================

-- Create a function to safely add columns (with fixed parameter names)
CREATE OR REPLACE FUNCTION add_column_if_not_exists(
    p_table_name TEXT,
    p_column_name TEXT,
    p_column_type TEXT
) RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = p_table_name
        AND column_name = p_column_name
    ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', p_table_name, p_column_name, p_column_type);
        RAISE NOTICE 'Added column % to table %', p_column_name, p_table_name;
    ELSE
        RAISE NOTICE 'Column % already exists in table %', p_column_name, p_table_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add sender_id if it doesn't exist
SELECT add_column_if_not_exists('messenger_conversations', 'sender_id', 'TEXT');

-- Add sender_name if it doesn't exist
SELECT add_column_if_not_exists('messenger_conversations', 'sender_name', 'TEXT');

-- Drop the helper function
DROP FUNCTION add_column_if_not_exists(TEXT, TEXT, TEXT);

