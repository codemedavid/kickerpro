-- Lead Scoring Settings Table
-- Stores user-specific scoring configuration and preferences

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

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_lead_scoring_settings_user_id ON lead_scoring_settings(user_id);

-- Enable RLS
ALTER TABLE lead_scoring_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own settings
CREATE POLICY "Users manage own scoring settings" ON lead_scoring_settings FOR ALL USING (user_id::text = auth.uid()::text);

-- Grant permissions
GRANT ALL ON lead_scoring_settings TO authenticated;

-- Insert comment
COMMENT ON TABLE lead_scoring_settings IS 'Stores user-specific lead scoring configuration and preferences';

