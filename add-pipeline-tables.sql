-- ================================================================
-- PIPELINE SYSTEM TABLES
-- AI-Powered Contact Pipeline with Stage Analysis
-- ================================================================

-- Pipeline Stages Table
-- Stores different stages in the sales/contact pipeline
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3b82f6', -- Tailwind blue-500
    position INTEGER NOT NULL DEFAULT 0, -- Order of stages in the pipeline
    analysis_prompt TEXT NOT NULL, -- AI prompt specific to this stage for analyzing if contact belongs here
    is_default BOOLEAN DEFAULT false, -- Mark the default/unmatched stage
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_id ON pipeline_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_position ON pipeline_stages(position);

-- Pipeline Global Settings Table
-- Stores user's global instructions for pipeline analysis
CREATE TABLE IF NOT EXISTS pipeline_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    global_analysis_prompt TEXT NOT NULL, -- Global instructions for analyzing contacts
    auto_analyze BOOLEAN DEFAULT true, -- Automatically analyze new contacts
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_settings_user_id ON pipeline_settings(user_id);

-- Pipeline Opportunities Table
-- Stores contacts/leads in the pipeline
CREATE TABLE IF NOT EXISTS pipeline_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL, -- Facebook user ID
    sender_name TEXT,
    -- AI Analysis Results
    ai_analysis_result JSONB, -- Stores the AI decision and reasoning
    ai_analyzed_at TIMESTAMPTZ,
    ai_confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
    both_prompts_agreed BOOLEAN, -- True if both global and stage-specific agreed
    -- Manual Override
    manually_assigned BOOLEAN DEFAULT false, -- True if user manually moved the contact
    manually_assigned_at TIMESTAMPTZ,
    manually_assigned_by UUID REFERENCES users(id),
    -- Metadata
    notes TEXT,
    custom_data JSONB, -- Store any custom contact data
    moved_to_stage_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_user_id ON pipeline_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_stage_id ON pipeline_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_conversation_id ON pipeline_opportunities(conversation_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_sender_id ON pipeline_opportunities(sender_id);

-- Pipeline Stage History Table
-- Track when contacts move between stages
CREATE TABLE IF NOT EXISTS pipeline_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    moved_by UUID REFERENCES users(id), -- NULL if moved by AI
    moved_by_ai BOOLEAN DEFAULT false,
    reason TEXT, -- Why the contact was moved
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stage_history_opportunity_id ON pipeline_stage_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_history_created_at ON pipeline_stage_history(created_at DESC);

-- Create default "Unmatched" stage for each user (for admin/first user as example)
-- Users will need to create their own stages via the UI
-- This is just a template - actual default stage will be created when user first accesses pipeline

COMMENT ON TABLE pipeline_stages IS 'Stores pipeline stages with AI analysis prompts for each stage';
COMMENT ON TABLE pipeline_settings IS 'Global settings and analysis instructions for the pipeline system';
COMMENT ON TABLE pipeline_opportunities IS 'Contacts/leads in the pipeline with AI analysis results';
COMMENT ON TABLE pipeline_stage_history IS 'Historical record of contacts moving between stages';
COMMENT ON COLUMN pipeline_opportunities.both_prompts_agreed IS 'True when both global and stage-specific prompts agree the contact belongs in this stage';
COMMENT ON COLUMN pipeline_opportunities.ai_confidence_score IS 'AI confidence level (0.00-1.00) that the contact belongs in this stage';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON pipeline_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipeline_settings_updated_at BEFORE UPDATE ON pipeline_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipeline_opportunities_updated_at BEFORE UPDATE ON pipeline_opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;

-- pipeline_stages policies
CREATE POLICY "Users can view their own pipeline stages"
    ON pipeline_stages FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Users can create their own pipeline stages"
    ON pipeline_stages FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Users can update their own pipeline stages"
    ON pipeline_stages FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Users can delete their own pipeline stages"
    ON pipeline_stages FOR DELETE
    USING (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

-- pipeline_settings policies
CREATE POLICY "Users can view their own pipeline settings"
    ON pipeline_settings FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Users can create their own pipeline settings"
    ON pipeline_settings FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Users can update their own pipeline settings"
    ON pipeline_settings FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

-- pipeline_opportunities policies
CREATE POLICY "Users can view their own pipeline opportunities"
    ON pipeline_opportunities FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Users can create their own pipeline opportunities"
    ON pipeline_opportunities FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Users can update their own pipeline opportunities"
    ON pipeline_opportunities FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Users can delete their own pipeline opportunities"
    ON pipeline_opportunities FOR DELETE
    USING (user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true)));

-- pipeline_stage_history policies
CREATE POLICY "Users can view their own pipeline stage history"
    ON pipeline_stage_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM pipeline_opportunities po
            WHERE po.id = pipeline_stage_history.opportunity_id
            AND po.user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true))
        )
    );

CREATE POLICY "Users can create their own pipeline stage history"
    ON pipeline_stage_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pipeline_opportunities po
            WHERE po.id = pipeline_stage_history.opportunity_id
            AND po.user_id = (SELECT id FROM users WHERE facebook_id = current_setting('request.jwt.claim.sub', true))
        )
    );

