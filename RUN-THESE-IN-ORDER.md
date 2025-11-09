    # 🚀 Pipeline Setup - Run These SQL Files in Order

    ## The Problem
    Your `messenger_conversations` table is missing the `sender_id` and `sender_name` columns. We need to add them first before creating the pipeline tables.

    ## ✅ Solution: Run 2 SQL Files in Order

    ### Step 1: Fix messenger_conversations Table
    Run this file **FIRST** in Supabase SQL Editor:

    **File: `fix-messenger-conversations-first.sql`**

    This will:
    - ✅ Add `sender_id` column if missing
    - ✅ Add `sender_name` column if missing
    - ✅ Show you which columns were added

    **Expected Output:**
    ```
    Added column sender_id to table messenger_conversations
    Added column sender_name to table messenger_conversations
    ```

    or

    ```
    Column sender_id already exists in table messenger_conversations
    Column sender_name already exists in table messenger_conversations
    ```

    ---

    ### Step 2: Create Pipeline Tables
    After Step 1 succeeds, run this file **SECOND**:

    **File: `add-pipeline-simple.sql`**

    This will:
    - ✅ Create `pipeline_stages` table
    - ✅ Create `pipeline_settings` table
    - ✅ Create `pipeline_opportunities` table
    - ✅ Create `pipeline_stage_history` table
    - ✅ Set up all indexes and RLS policies

    ---

    ## 📋 Quick Checklist

    - [ ] 1. Open Supabase Dashboard
    - [ ] 2. Go to SQL Editor
    - [ ] 3. Click "New Query"
    - [ ] 4. Copy content of `fix-messenger-conversations-first.sql`
    - [ ] 5. Paste and Run
    - [ ] 6. Wait for success ✅
    - [ ] 7. Click "New Query" again
    - [ ] 8. Copy content of `add-pipeline-simple.sql`
    - [ ] 9. Paste and Run
    - [ ] 10. Done! 🎉

    ---

    ## 🎯 After Success

    Once both files run successfully:

    1. Visit your app: `Dashboard → Sales Pipeline`
    2. Default "Unmatched" stage will auto-create
    3. Start adding contacts from Conversations page!

    ---

    ## ❓ If You Get Errors

    **Error in Step 1:** 
    - Make sure you're running `fix-messenger-conversations-first.sql`
    - Check that `messenger_conversations` table exists

    **Error in Step 2:**
    - Make sure Step 1 completed successfully first
    - Don't skip Step 1!

    ---

    ## 🎉 That's It!

    The two-step approach ensures everything works perfectly regardless of your current database state.


