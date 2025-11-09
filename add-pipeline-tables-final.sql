-- ================================================================
-- PIPELINE SYSTEM TABLES - FINAL VERSION
-- Simple and compatible with all PostgreSQL versions
-- ================================================================

-- Add columns to messenger_conversations if they don't exist (safe approach)
ALTER TABLE messenger_conversations 
ADD COLUMN IF NOT EXISTS sender_id TEXT;

ALTER TABLE messenger_conversations 
ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Pipeline Stages Table
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    position INTEGER NOT NULL DEFAULT 0,
    analysis_prompt TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_id ON pipeline_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_position ON pipeline_stages(position);

-- Pipeline Global Settings Table
CREATE TABLE IF NOT EXISTS pipeline_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    global_analysis_prompt TEXT NOT NULL,
    auto_analyze BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_settings_user_id ON pipeline_settings(user_id);

-- Pipeline Opportunities Table
CREATE TABLE IF NOT EXISTS pipeline_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    ai_analysis_result JSONB,
    ai_analyzed_at TIMESTAMPTZ,
    ai_confidence_score DECIMAL(3, 2),
    both_prompts_agreed BOOLEAN,
    manually_assigned BOOLEAN DEFAULT false,
    manually_assigned_at TIMESTAMPTZ,
    manually_assigned_by UUID REFERENCES users(id),
    notes TEXT,
    custom_data JSONB,
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
CREATE TABLE IF NOT EXISTS pipeline_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    moved_by UUID REFERENCES users(id),
    moved_by_ai BOOLEAN DEFAULT false,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stage_history_opportunity_id ON pipeline_stage_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_history_created_at ON pipeline_stage_history(created_at DESC);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_pipeline_stages_updated_at ON pipeline_stages;
CREATE TRIGGER update_pipeline_stages_updated_at 
    BEFORE UPDATE ON pipeline_stages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pipeline_settings_updated_at ON pipeline_settings;
CREATE TRIGGER update_pipeline_settings_updated_at 
    BEFORE UPDATE ON pipeline_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pipeline_opportunities_updated_at ON pipeline_opportunities;
CREATE TRIGGER update_pipeline_opportunities_updated_at 
    BEFORE UPDATE ON pipeline_opportunities 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can create their own pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can update their own pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can delete their own pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can view their own pipeline settings" ON pipeline_settings;
DROP POLICY IF EXISTS "Users can create their own pipeline settings" ON pipeline_settings;
DROP POLICY IF EXISTS "Users can update their own pipeline settings" ON pipeline_settings;
DROP POLICY IF EXISTS "Users can view their own pipeline opportunities" ON pipeline_opportunities;
DROP POLICY IF EXISTS "Users can create their own pipeline opportunities" ON pipeline_opportunities;
DROP POLICY IF EXISTS "Users can update their own pipeline opportunities" ON pipeline_opportunities;
DROP POLICY IF EXISTS "Users can delete their own pipeline opportunities" ON pipeline_opportunities;
DROP POLICY IF EXISTS "Users can view their own pipeline stage history" ON pipeline_stage_history;
DROP POLICY IF EXISTS "Users can create their own pipeline stage history" ON pipeline_stage_history;

-- Create policies
CREATE POLICY "Users can view their own pipeline stages"
    ON pipeline_stages FOR SELECT
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can create their own pipeline stages"
    ON pipeline_stages FOR INSERT
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update their own pipeline stages"
    ON pipeline_stages FOR UPDATE
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can delete their own pipeline stages"
    ON pipeline_stages FOR DELETE
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can view their own pipeline settings"
    ON pipeline_settings FOR SELECT
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can create their own pipeline settings"
    ON pipeline_settings FOR INSERT
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update their own pipeline settings"
    ON pipeline_settings FOR UPDATE
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can view their own pipeline opportunities"
    ON pipeline_opportunities FOR SELECT
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can create their own pipeline opportunities"
    ON pipeline_opportunities FOR INSERT
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update their own pipeline opportunities"
    ON pipeline_opportunities FOR UPDATE
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can delete their own pipeline opportunities"
    ON pipeline_opportunities FOR DELETE
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can view their own pipeline stage history"
    ON pipeline_stage_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM pipeline_opportunities po
            WHERE po.id = pipeline_stage_history.opportunity_id
            AND po.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can create their own pipeline stage history"
    ON pipeline_stage_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pipeline_opportunities po
            WHERE po.id = pipeline_stage_history.opportunity_id
            AND po.user_id::text = auth.uid()::text
        )
    );

