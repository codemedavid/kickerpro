-- ============================================
-- THREE SIMPLE INSERTS - Run All at Once
-- ============================================

-- Insert New Lead
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT id, 'New Lead', 'Browsing', '#3b82f6', 'New Lead if browsing.', false, true, 0
FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Insert Qualified
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT id, 'Qualified', 'Interested', '#22c55e', 'Qualified if pricing.', false, true, 1
FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Insert Hot Lead
INSERT INTO pipeline_stages (user_id, name, description, color, analysis_prompt, is_default, is_active, position)
SELECT id, 'Hot Lead', 'Buying', '#ef4444', 'Hot Lead if buying.', false, true, 2
FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Verify
SELECT name, LENGTH(analysis_prompt), position FROM pipeline_stages ORDER BY position;

