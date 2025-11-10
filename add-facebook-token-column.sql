-- Add Facebook access token columns to users table
-- Run this in your Supabase SQL editor

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS facebook_access_token TEXT,
ADD COLUMN IF NOT EXISTS facebook_token_updated_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON public.users(facebook_id);

-- Comment the columns
COMMENT ON COLUMN public.users.facebook_access_token IS 'Long-lived Facebook access token for API calls';
COMMENT ON COLUMN public.users.facebook_token_updated_at IS 'Timestamp when the Facebook token was last updated';









