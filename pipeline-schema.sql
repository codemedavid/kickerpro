-- ================================================================
-- SALES PIPELINE & OPPORTUNITY TRACKING
-- ================================================================
-- Adds CRM features to track customer journey and opportunities
-- ================================================================

-- Pipeline Stages table
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

-- Opportunities table (tracks each lead through the pipeline)
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES messenger_conversations(id) ON DELETE SET NULL,
    page_id TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_id TEXT NOT NULL, -- Facebook PSID
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

-- Opportunity Activity Log (track stage changes and notes)
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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage_id ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id ON opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_id ON pipeline_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages(user_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_opportunity_activities_opportunity_id ON opportunity_activities(opportunity_id);

-- Triggers
CREATE OR REPLACE FUNCTION update_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_opportunities_updated_at();

CREATE OR REPLACE FUNCTION update_pipeline_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pipeline_stages_updated_at
    BEFORE UPDATE ON pipeline_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_stages_updated_at();

-- Function to log opportunity stage changes
CREATE OR REPLACE FUNCTION log_opportunity_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.stage_id != NEW.stage_id THEN
        INSERT INTO opportunity_activities (
            opportunity_id,
            activity_type,
            from_value,
            to_value,
            description
        ) VALUES (
            NEW.id,
            'stage_change',
            OLD.stage_id::TEXT,
            NEW.stage_id::TEXT,
            'Stage changed'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunity_stage_change_log
    AFTER UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION log_opportunity_stage_change();

-- Insert default pipeline stages for new users
-- (You can run this manually or trigger on user creation)
CREATE OR REPLACE FUNCTION create_default_pipeline_stages(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO pipeline_stages (user_id, name, description, stage_order, color) VALUES
    (p_user_id, 'New Lead', 'Fresh leads from Facebook Messenger', 1, '#6366f1'),
    (p_user_id, 'Contacted', 'Initial contact made', 2, '#3b82f6'),
    (p_user_id, 'Qualified', 'Lead is qualified and interested', 3, '#06b6d4'),
    (p_user_id, 'Proposal Sent', 'Proposal or quote sent', 4, '#8b5cf6'),
    (p_user_id, 'Negotiation', 'In negotiation phase', 5, '#f59e0b'),
    (p_user_id, 'Closed Won', 'Successfully closed deal', 6, '#10b981'),
    (p_user_id, 'Closed Lost', 'Lost the opportunity', 7, '#ef4444')
    ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE pipeline_stages IS 'Sales pipeline stages for tracking customer journey';
COMMENT ON TABLE opportunities IS 'Individual sales opportunities with stage tracking';
COMMENT ON TABLE opportunity_activities IS 'Activity log for opportunities (stage changes, notes, etc.)';
COMMENT ON COLUMN opportunities.value IS 'Estimated deal value/revenue';
COMMENT ON COLUMN opportunities.probability IS 'Win probability percentage (0-100)';
COMMENT ON COLUMN opportunities.status IS 'open = active, won = closed successfully, lost = deal lost';

-- Verification
SELECT 
    '✅ Pipeline tables created successfully!' as status,
    'Run this to create default stages for a user:' as next_step,
    'SELECT create_default_pipeline_stages(''your-user-id'');' as example;

