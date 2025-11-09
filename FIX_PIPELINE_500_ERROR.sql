-- ================================================================
-- FIX: Pipeline Stages 500 Error
-- ================================================================
-- Run this in Supabase SQL Editor to fix the database schema
-- ================================================================

-- Drop old table if it exists with wrong schema
DROP TABLE IF EXISTS pipeline_opportunities CASCADE;

-- Create correct pipeline_stages table
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

-- Create correct opportunities table
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

-- Create opportunity activities table
CREATE TABLE IF NOT EXISTS opportunity_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create lead scoring settings table
CREATE TABLE IF NOT EXISTS lead_scoring_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_shopper_threshold INTEGER DEFAULT 30 CHECK (price_shopper_threshold >= 0 AND price_shopper_threshold <= 100),
  price_shopper_message_limit INTEGER DEFAULT 2 CHECK (price_shopper_message_limit >= 1),
  min_engagement_warm INTEGER DEFAULT 3 CHECK (min_engagement_warm >= 1),
  min_engagement_hot INTEGER DEFAULT 5 CHECK (min_engagement_hot >= 1),
  strict_mode BOOLEAN DEFAULT false,
  auto_score_on_sync BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create lead scores history table
CREATE TABLE IF NOT EXISTS lead_scores_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  quality TEXT NOT NULL CHECK (quality IN ('Hot', 'Warm', 'Cold', 'Unqualified')),
  has_budget BOOLEAN DEFAULT false,
  has_authority BOOLEAN DEFAULT false,
  has_need BOOLEAN DEFAULT false,
  has_timeline BOOLEAN DEFAULT false,
  engagement_level TEXT CHECK (engagement_level IN ('high', 'medium', 'low')),
  signals TEXT[],
  reasoning TEXT,
  recommended_action TEXT,
  scored_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_id ON pipeline_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_stage_order ON pipeline_stages(stage_order);
CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage_id ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_conversation_id ON opportunities(conversation_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunity_activities_opportunity_id ON opportunity_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_lead_scoring_settings_user_id ON lead_scoring_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_conversation ON lead_scores_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_user ON lead_scores_history(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_quality ON lead_scores_history(quality);
CREATE INDEX IF NOT EXISTS idx_lead_scores_scored_at ON lead_scores_history(scored_at DESC);

-- Enable RLS
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scoring_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users manage own pipeline stages" ON pipeline_stages FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users manage own opportunities" ON opportunities FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users view own activities" ON opportunity_activities FOR SELECT USING (created_by::text = auth.uid()::text);
CREATE POLICY "Users insert own activities" ON opportunity_activities FOR INSERT WITH CHECK (created_by::text = auth.uid()::text);
CREATE POLICY "Users manage own scoring settings" ON lead_scoring_settings FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users view own lead scores" ON lead_scores_history FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users insert own lead scores" ON lead_scores_history FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

-- Grant permissions
GRANT ALL ON pipeline_stages TO authenticated;
GRANT ALL ON opportunities TO authenticated;
GRANT ALL ON opportunity_activities TO authenticated;
GRANT ALL ON lead_scoring_settings TO authenticated;
GRANT SELECT, INSERT ON lead_scores_history TO authenticated;

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================
SELECT 
  '✅ All pipeline and lead scoring tables created!' as status,
  'You can now use the Pipeline and Lead Qualification features' as message;

