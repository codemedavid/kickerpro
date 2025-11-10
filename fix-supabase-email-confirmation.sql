-- Fix Supabase Email Confirmation Issue
-- This ensures users can login immediately without email verification

-- Option 1: Disable email confirmation globally (recommended for this app)
-- Run this in Supabase SQL Editor:

-- Update auth config to disable email confirmation
UPDATE auth.config
SET email_confirm = false
WHERE id = 1;

-- OR if the above doesn't work, use this alternative:

-- Option 2: Manually confirm existing users who signed up via Facebook
-- This marks all Facebook users as confirmed

UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email LIKE '%@facebook.local'
  AND email_confirmed_at IS NULL;

-- Option 3: Disable email confirmation via Supabase Dashboard
-- Go to: Authentication → Settings → Email Auth
-- Toggle OFF "Enable email confirmations"






