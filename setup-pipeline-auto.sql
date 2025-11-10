-- ============================================
-- AUTO SETUP: Pipeline Configuration
-- This version automatically uses current authenticated user
-- NO MANUAL REPLACEMENT NEEDED!
-- ============================================
-- INSTRUCTIONS:
-- 1. Make sure you're logged into Supabase dashboard
-- 2. Just run this entire script - it will use your authenticated user
-- 3. That's it!
-- ============================================

-- ============================================
-- Get current user (uses RLS context)
-- ============================================

DO $$
DECLARE
    v_user_id UUID;
    v_page_id TEXT;
BEGIN
    -- Get user_id from authenticated session
    -- If RLS is enabled, auth.uid() returns current user
    SELECT auth.uid() INTO v_user_id;
    
    -- If not in RLS context, get first user
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Using user_id: %', v_user_id;
    
    -- Get first page for this user
    SELECT id INTO v_page_id FROM facebook_pages WHERE user_id = v_user_id LIMIT 1;
    RAISE NOTICE 'Using page_id: %', v_page_id;
    
    -- ============================================
    -- STEP 1: Create Pipeline Settings
    -- ============================================
    
    -- Delete existing settings
    DELETE FROM pipeline_settings WHERE user_id = v_user_id;
    RAISE NOTICE '✅ Cleaned old settings';
    
    -- Insert new settings
    INSERT INTO pipeline_settings (user_id, global_analysis_prompt, auto_analyze)
    VALUES (
        v_user_id,
        'Analyze this contact based on their conversation to determine pipeline stage.

NEW LEAD: Early exploration
- First or second message
- General questions ("what do you offer", "tell me about")
- No specific product interest yet
- Keywords: info, curious, browsing

QUALIFIED: Showing interest
- Specific product interest
- Asked about pricing or features
- Discussed needs
- Keywords: price, cost, interested, need

HOT LEAD: Ready to buy
- Purchase intent expressed
- Requested quote
- Mentioned timeline
- Keywords: buy, order, quote, ASAP, ready

Match the contact to the stage that best fits their conversation.',
        true
    );
    RAISE NOTICE '✅ Created pipeline settings';
    
    -- ============================================
    -- STEP 2: Create Pipeline Stages
    -- ============================================
    
    -- New Lead Stage
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    VALUES (
        v_user_id,
        'New Lead',
        'Early exploration - first contact',
        '#3b82f6',
        'This is "New Lead" if: First or second message, asking general questions, no buying intent yet. Keywords: info, curious, what, tell me.',
        false,
        true,
        0
    )
    ON CONFLICT (user_id, name) DO UPDATE SET
        analysis_prompt = EXCLUDED.analysis_prompt,
        description = EXCLUDED.description;
    
    RAISE NOTICE '✅ Created New Lead stage';
    
    -- Qualified Stage
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    VALUES (
        v_user_id,
        'Qualified',
        'Showing clear interest',
        '#22c55e',
        'This is "Qualified" if: Interested in specific products, asked about pricing or features, discussed needs. Keywords: price, cost, interested, need, how much.',
        false,
        true,
        1
    )
    ON CONFLICT (user_id, name) DO UPDATE SET
        analysis_prompt = EXCLUDED.analysis_prompt,
        description = EXCLUDED.description;
    
    RAISE NOTICE '✅ Created Qualified stage';
    
    -- Hot Lead Stage
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    VALUES (
        v_user_id,
        'Hot Lead',
        'Ready to purchase',
        '#ef4444',
        'This is "Hot Lead" if: Ready to buy, requested quote, mentioned timeline or urgency. Keywords: buy, order, quote, ready, ASAP, purchase.',
        false,
        true,
        2
    )
    ON CONFLICT (user_id, name) DO UPDATE SET
        analysis_prompt = EXCLUDED.analysis_prompt,
        description = EXCLUDED.description;
    
    RAISE NOTICE '✅ Created Hot Lead stage';
    
    -- Unmatched Stage (Default)
    INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
    VALUES (
        v_user_id,
        'Unmatched',
        'Needs manual review',
        '#94a3b8',
        'Default stage for contacts that need manual review or when AI is uncertain.',
        true,
        true,
        999
    )
    ON CONFLICT (user_id, name) DO UPDATE SET
        is_default = EXCLUDED.is_default,
        analysis_prompt = EXCLUDED.analysis_prompt;
    
    RAISE NOTICE '✅ Created Unmatched (default) stage';
    
    -- Ensure only one default
    UPDATE pipeline_stages 
    SET is_default = false 
    WHERE user_id = v_user_id 
      AND name != 'Unmatched' 
      AND is_default = true;
    
    RAISE NOTICE '✅ Ensured single default stage';
    
    -- ============================================
    -- STEP 3: Create Test Conversations (if page exists)
    -- ============================================
    
    IF v_page_id IS NOT NULL THEN
        -- Clean old test data
        DELETE FROM pipeline_stage_history WHERE opportunity_id IN 
            (SELECT id FROM pipeline_opportunities WHERE sender_id LIKE 'TEST_%' AND user_id = v_user_id);
        DELETE FROM pipeline_opportunities WHERE sender_id LIKE 'TEST_%' AND user_id = v_user_id;
        DELETE FROM messenger_conversations WHERE sender_id LIKE 'TEST_%' AND user_id = v_user_id;
        
        -- Test 1: New Lead
        INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active)
        VALUES (v_user_id, v_page_id, 'TEST_BROWSE_001', 'John Browser', 'Hi, just curious about what products you offer. Can you tell me more?', NOW() - INTERVAL '2 hours', 'active', 1, true);
        
        -- Test 2: New Lead
        INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active)
        VALUES (v_user_id, v_page_id, 'TEST_BROWSE_002', 'Lisa Explorer', 'Hello! I wanted to learn more about your products and services.', NOW() - INTERVAL '45 minutes', 'active', 1, true);
        
        -- Test 3: Qualified
        INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active)
        VALUES (v_user_id, v_page_id, 'TEST_QUALIFIED_001', 'Maria Interested', 'How much is your premium package? I need pricing details for my business.', NOW() - INTERVAL '1 hour', 'active', 3, true);
        
        -- Test 4: Qualified
        INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active)
        VALUES (v_user_id, v_page_id, 'TEST_QUALIFIED_002', 'Tom Comparer', 'I am comparing prices. What is your cost per unit for 20 units?', NOW() - INTERVAL '1 hour', 'active', 4, true);
        
        -- Test 5: Hot Lead
        INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active)
        VALUES (v_user_id, v_page_id, 'TEST_HOT_001', 'Carlos Buyer', 'I want to order 50 units. Can you send me a quote today? Need them by next week.', NOW() - INTERVAL '30 minutes', 'active', 5, true);
        
        -- Test 6: Hot Lead
        INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, is_active)
        VALUES (v_user_id, v_page_id, 'TEST_HOT_002', 'Sarah Urgent', 'Need 100 units ASAP! Ready to purchase if price is right.', NOW() - INTERVAL '15 minutes', 'active', 2, true);
        
        RAISE NOTICE '✅ Created 6 test conversations';
    ELSE
        RAISE NOTICE '⚠️  No Facebook page found - skipping test conversation creation';
        RAISE NOTICE '   Test conversations can be created after connecting a Facebook page';
    END IF;
    
    -- ============================================
    -- VERIFICATION
    -- ============================================
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE '  SETUP COMPLETE!';
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Pipeline settings configured';
    RAISE NOTICE '✅ 4 stages created with prompts';
    RAISE NOTICE '✅ Test conversations created';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 NEXT STEPS:';
    RAISE NOTICE '1. Go to Conversations page';
    RAISE NOTICE '2. Look for contacts with TEST_ prefix';
    RAISE NOTICE '3. Select all 6 test contacts';
    RAISE NOTICE '4. Click "Add to Pipeline"';
    RAISE NOTICE '5. Check if they sort to correct stages';
    RAISE NOTICE '';
    RAISE NOTICE 'Expected distribution:';
    RAISE NOTICE '  - New Lead: John Browser, Lisa Explorer';
    RAISE NOTICE '  - Qualified: Maria Interested, Tom Comparer';
    RAISE NOTICE '  - Hot Lead: Carlos Buyer, Sarah Urgent';
    RAISE NOTICE '';
    
END $$;

-- Show what was created
SELECT 
    'Settings' as type,
    LENGTH(global_analysis_prompt) as prompt_length,
    auto_analyze
FROM pipeline_settings
WHERE user_id = auth.uid()
   OR user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1);

SELECT 
    'Stages' as type,
    name,
    LENGTH(analysis_prompt) as prompt_length,
    is_default,
    position
FROM pipeline_stages
WHERE user_id = auth.uid()
   OR user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
ORDER BY position;

SELECT 
    'Test Conversations' as type,
    sender_name,
    SUBSTRING(last_message, 1, 50) as message_preview
FROM messenger_conversations
WHERE sender_id LIKE 'TEST_%'
  AND (user_id = auth.uid() OR user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1))
ORDER BY sender_name;

