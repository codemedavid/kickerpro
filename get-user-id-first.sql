-- ============================================
-- STEP 1: Get Your User ID
-- Run this FIRST to find your user_id
-- ============================================

-- Find your user by email
SELECT 
    '=== YOUR USER ID ===' as step,
    id as user_id,
    email,
    '👆 COPY THIS ID ABOVE 👆' as note
FROM auth.users
WHERE email LIKE '%@%'  -- Shows all users
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- INSTRUCTIONS:
-- ============================================

/*

1. Run this query above
2. Find YOUR email in the results
3. COPY the 'user_id' value (looks like: a1b2c3d4-e5f6-...)
4. Go to the next SQL file you want to run
5. Press Ctrl+H (Find and Replace)
6. Find: 'YOUR_USER_ID'
7. Replace with: 'your-copied-id-here' (keep the quotes!)
8. Click Replace All
9. Now run that SQL file

EXAMPLE:
If your user_id is: a1b2c3d4-e5f6-7890-abcd-ef1234567890

In the SQL file, change:
FROM pipeline_settings WHERE user_id = 'YOUR_USER_ID'
TO:
FROM pipeline_settings WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

*/

-- ============================================
-- ALSO GET YOUR PAGE ID
-- ============================================

-- Find your Facebook page
SELECT 
    '=== YOUR PAGE ID ===' as step,
    id as page_id,
    facebook_page_id,
    name as page_name,
    '👆 COPY THIS ID ABOVE 👆' as note
FROM facebook_pages
ORDER BY created_at DESC
LIMIT 10;

/*

For create-test-conversations.sql, you also need PAGE_ID:

1. Copy the 'page_id' from above
2. In create-test-conversations.sql, find and replace:
   'YOUR_PAGE_ID' with 'your-copied-page-id'

*/

