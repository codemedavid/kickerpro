-- Lead Scores History Table
-- Tracks all lead scoring events and their results

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
  signals TEXT[], -- Array of buying signals detected
  reasoning TEXT,
  recommended_action TEXT,
  scored_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_lead_scores_conversation ON lead_scores_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_user ON lead_scores_history(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_quality ON lead_scores_history(quality);
CREATE INDEX IF NOT EXISTS idx_lead_scores_scored_at ON lead_scores_history(scored_at DESC);

-- Enable RLS
ALTER TABLE lead_scores_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own scoring history
CREATE POLICY "Users view own lead scores" ON lead_scores_history FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users insert own lead scores" ON lead_scores_history FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

-- Grant permissions
GRANT SELECT, INSERT ON lead_scores_history TO authenticated;

-- Insert comment
COMMENT ON TABLE lead_scores_history IS 'Historical record of all lead scoring events with BANT qualification data';

