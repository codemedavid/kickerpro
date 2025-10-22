-- ================================================================
-- 🚀 RUN THIS SQL NOW IN SUPABASE
-- ================================================================
-- This adds all missing columns and tables for:
-- • Selected recipients
-- • Message tags  
-- • Batch processing
-- ================================================================

-- 1. Fix recipient_type constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_recipient_type_check;

ALTER TABLE messages 
ADD CONSTRAINT messages_recipient_type_check 
CHECK (recipient_type IN ('all', 'active', 'selected'));

-- 2. Add selected_recipients column (if not exists)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];

-- 3. Add message_tag column (if not exists)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_tag TEXT 
CHECK (message_tag IN ('ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE', 'HUMAN_AGENT'));

-- 4. Create message_batches table (if not exists)
CREATE TABLE IF NOT EXISTS message_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    total_batches INTEGER NOT NULL,
    recipients TEXT[] NOT NULL,
    recipient_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, batch_number)
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_message_batches_message_id ON message_batches(message_id);
CREATE INDEX IF NOT EXISTS idx_message_batches_status ON message_batches(status);

-- ================================================================
-- ✅ VERIFICATION - Check if everything worked
-- ================================================================

-- Check columns exist
SELECT 
  column_name, 
  data_type,
  CASE 
    WHEN column_name = 'selected_recipients' THEN '✅ For selected contacts'
    WHEN column_name = 'message_tag' THEN '✅ For bypassing 24h window'
    ELSE 'Other'
  END as purpose
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('selected_recipients', 'message_tag');

-- Check message_batches table exists
SELECT 
  '✅ message_batches table created' as status,
  COUNT(*) as initial_count
FROM message_batches;

-- Check constraint
SELECT 
  '✅ Constraint allows: all, active, selected' as status,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
AND conname = 'messages_recipient_type_check';

-- ================================================================
-- SALES PIPELINE TABLES
-- ================================================================

-- Pipeline Stages
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    stage_order INTEGER NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name),
    UNIQUE(user_id, stage_order)
);

-- Opportunities
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES messenger_conversations(id) ON DELETE SET NULL,
    page_id TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    value DECIMAL(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date DATE,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    lost_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_id, page_id)
);

-- Opportunity Activities
CREATE TABLE IF NOT EXISTS opportunity_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('stage_change', 'note', 'value_change', 'status_change', 'created')),
    from_value TEXT,
    to_value TEXT,
    description TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage_id ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_id ON pipeline_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_activities_opportunity_id ON opportunity_activities(opportunity_id);

-- ================================================================
-- 🎉 SUCCESS MESSAGE
-- ================================================================

SELECT 
  '🎉 ALL MIGRATIONS COMPLETE!' as message,
  'You can now:' as info,
  '• Send to selected contacts (up to 2000)' as feature_1,
  '• Use message tags (bypass 24h window)' as feature_2,
  '• Process in batches (100 per batch)' as feature_3,
  '• Track batch progress' as feature_4,
  '• Manage sales pipeline' as feature_5,
  '• Track opportunities and deals' as feature_6;

