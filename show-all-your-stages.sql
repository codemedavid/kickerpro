-- ============================================
-- SHOW ALL YOUR STAGES
-- ============================================

-- Show all stages for your user
SELECT 
    name,
    LENGTH(analysis_prompt) as prompt_chars,
    is_default,
    is_active,
    position,
    created_at
FROM pipeline_stages
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556'
ORDER BY position;

-- Count them
SELECT 
    COUNT(*) as total_stages,
    COUNT(CASE WHEN analysis_prompt IS NOT NULL AND LENGTH(analysis_prompt) > 30 THEN 1 END) as with_good_prompts
FROM pipeline_stages
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556';

-- Show settings
SELECT 
    LENGTH(global_analysis_prompt) as prompt_chars,
    auto_analyze,
    SUBSTRING(global_analysis_prompt, 1, 100) as prompt_preview
FROM pipeline_settings
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556';





