-- Add missing sync and token expiration fields to tables
-- Run this in Supabase SQL Editor

-- Add fields to facebook_pages table
DO $$
BEGIN
  -- Add last_synced_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facebook_pages' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE facebook_pages ADD COLUMN last_synced_at TIMESTAMPTZ;
    RAISE NOTICE 'Added last_synced_at column to facebook_pages';
  ELSE
    RAISE NOTICE 'last_synced_at column already exists in facebook_pages';
  END IF;

  -- Add access_token_expires_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facebook_pages' AND column_name = 'access_token_expires_at'
  ) THEN
    ALTER TABLE facebook_pages ADD COLUMN access_token_expires_at TIMESTAMPTZ;
    RAISE NOTICE 'Added access_token_expires_at column to facebook_pages';
  ELSE
    RAISE NOTICE 'access_token_expires_at column already exists in facebook_pages';
  END IF;
END $$;

-- Add fields to users table
DO $$
BEGIN
  -- Add facebook_access_token column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'facebook_access_token'
  ) THEN
    ALTER TABLE users ADD COLUMN facebook_access_token TEXT;
    RAISE NOTICE 'Added facebook_access_token column to users';
  ELSE
    RAISE NOTICE 'facebook_access_token column already exists in users';
  END IF;

  -- Add facebook_token_expires_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'facebook_token_expires_at'
  ) THEN
    ALTER TABLE users ADD COLUMN facebook_token_expires_at TIMESTAMPTZ;
    RAISE NOTICE 'Added facebook_token_expires_at column to users';
  ELSE
    RAISE NOTICE 'facebook_token_expires_at column already exists in users';
  END IF;

  -- Add facebook_token_updated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'facebook_token_updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN facebook_token_updated_at TIMESTAMPTZ;
    RAISE NOTICE 'Added facebook_token_updated_at column to users';
  ELSE
    RAISE NOTICE 'facebook_token_updated_at column already exists in users';
  END IF;
END $$;

-- Create index for last_synced_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_facebook_pages_last_synced 
ON facebook_pages(last_synced_at);

-- Create index for token expiration queries
CREATE INDEX IF NOT EXISTS idx_facebook_pages_token_expires 
ON facebook_pages(access_token_expires_at) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_users_token_expires 
ON users(facebook_token_expires_at);

SELECT '✅ Database migration completed successfully!' as status;

