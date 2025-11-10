-- ============================================
-- READY TO RUN - Your Test Contacts
-- ============================================
-- Just copy and paste and run (no editing needed!)
-- ============================================

-- First, get your page_id
SELECT id as page_id, facebook_page_id, name 
FROM facebook_pages 
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556'
LIMIT 1;

-- ============================================
-- AFTER RUNNING ABOVE: Copy the 'facebook_page_id' value
-- Then run the section below, replacing YOUR_PAGE_ID
-- ============================================

-- Delete old test data
DELETE FROM messenger_conversations 
WHERE user_id = 'a3c2696c-1248-4603-9dfb-141879987556' 
  AND sender_id LIKE 'TEST_%';

-- Create test conversations
-- 🔽 EDIT ONLY THE PAGE_ID VALUES BELOW (6 places marked with YOUR_PAGE_ID)

INSERT INTO messenger_conversations (user_id, page_id, sender_id, sender_name, last_message, last_message_time, conversation_status, message_count, created_at, updated_at)
VALUES 
    ('a3c2696c-1248-4603-9dfb-141879987556', 'YOUR_PAGE_ID', 'TEST_NEW_001', 'Alex Curious', 'Hi what products do you have?', NOW() - INTERVAL '2 hours', 'active', 1, NOW(), NOW()),
    ('a3c2696c-1248-4603-9dfb-141879987556', 'YOUR_PAGE_ID', 'TEST_NEW_002', 'Beth Browser', 'Tell me about your business', NOW() - INTERVAL '1 hour', 'active', 1, NOW(), NOW()),
    ('a3c2696c-1248-4603-9dfb-141879987556', 'YOUR_PAGE_ID', 'TEST_QUAL_001', 'Chris Interested', 'How much is premium package?', NOW() - INTERVAL '45 minutes', 'active', 3, NOW(), NOW()),
    ('a3c2696c-1248-4603-9dfb-141879987556', 'YOUR_PAGE_ID', 'TEST_QUAL_002', 'Diana Shopper', 'Need 20 units what is price?', NOW() - INTERVAL '30 minutes', 'active', 2, NOW(), NOW()),
    ('a3c2696c-1248-4603-9dfb-141879987556', 'YOUR_PAGE_ID', 'TEST_HOT_001', 'Eric Buyer', 'Ready to order 50 units', NOW() - INTERVAL '20 minutes', 'active', 4, NOW(), NOW()),
    ('a3c2696c-1248-4603-9dfb-141879987556', 'YOUR_PAGE_ID', 'TEST_HOT_002', 'Fiona Urgent', 'Need 100 ASAP', NOW() - INTERVAL '15 minutes', 'active', 3, NOW(), NOW());

-- Verify
SELECT sender_name, last_message, sender_id
FROM messenger_conversations
WHERE sender_id LIKE 'TEST_%'
ORDER BY sender_name;

