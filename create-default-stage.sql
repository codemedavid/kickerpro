-- Create a default "Unmatched" stage
-- Replace 'YOUR_USER_ID' with your actual user ID from the users table

-- First, let's check your user ID (run this first to get your user_id)
SELECT id, email FROM users LIMIT 1;

-- Then use that ID in the INSERT below (replace the USER_ID)
-- Example: INSERT INTO pipeline_stages (user_id, name, ...) VALUES ('your-actual-uuid-here', 'Unmatched', ...);

INSERT INTO pipeline_stages (
    user_id,
    name,
    description,
    color,
    analysis_prompt,
    is_default,
    is_active,
    position
) VALUES (
    (SELECT id FROM users LIMIT 1),  -- This automatically gets your user ID
    'Unmatched',
    'Contacts that need manual review or AI analysis',
    '#94a3b8',
    'Review this contact manually to determine the appropriate stage. Consider their engagement level, conversation history, and intent.',
    true,
    true,
    999
);

-- Verify the stage was created
SELECT * FROM pipeline_stages;



