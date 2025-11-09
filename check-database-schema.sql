-- ================================================================
-- DIAGNOSTIC: Check Database Schema
-- Run this first to see your actual table structure
-- ================================================================

-- Check if messenger_conversations table exists and what columns it has
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'messenger_conversations'
ORDER BY 
    ordinal_position;

-- Check if the table exists at all
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'messenger_conversations'
) as table_exists;

