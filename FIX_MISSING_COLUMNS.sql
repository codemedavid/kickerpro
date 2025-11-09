-- Fix missing columns in ai_automation_executions table
-- Run this in Supabase SQL Editor if you get "column does not exist" errors

-- Check if facebook_message_id column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ai_automation_executions' 
        AND column_name = 'facebook_message_id'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE ai_automation_executions 
        ADD COLUMN facebook_message_id TEXT;
        
        RAISE NOTICE 'Added facebook_message_id column';
    ELSE
        RAISE NOTICE 'facebook_message_id column already exists';
    END IF;
END $$;

-- Check if other important columns exist
DO $$ 
BEGIN
    -- Add user_id if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ai_automation_executions' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE ai_automation_executions 
        ADD COLUMN user_id UUID;
        
        RAISE NOTICE 'Added user_id column';
    END IF;
    
    -- Add page_id if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ai_automation_executions' 
        AND column_name = 'page_id'
    ) THEN
        ALTER TABLE ai_automation_executions 
        ADD COLUMN page_id UUID;
        
        RAISE NOTICE 'Added page_id column';
    END IF;
END $$;

-- List all columns in the table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_automation_executions'
ORDER BY ordinal_position;

