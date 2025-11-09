-- ================================================================
-- BEST TIME TO CONTACT - Database Schema (SAFE VERSION)
-- Run this in your Supabase SQL Editor
-- This version drops existing policies before recreating them
-- ================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own contact events" ON contact_interaction_events;
DROP POLICY IF EXISTS "Users can insert their own contact events" ON contact_interaction_events;
DROP POLICY IF EXISTS "Users can view their own timing bins" ON contact_timing_bins;
DROP POLICY IF EXISTS "Users can manage their own timing bins" ON contact_timing_bins;
DROP POLICY IF EXISTS "Users can view their own recommendations" ON contact_timing_recommendations;
DROP POLICY IF EXISTS "Users can manage their own recommendations" ON contact_timing_recommendations;
DROP POLICY IF EXISTS "Users can view their own segment priors" ON contact_timing_segment_priors;
DROP POLICY IF EXISTS "Users can manage their own segment priors" ON contact_timing_segment_priors;
DROP POLICY IF EXISTS "Users can view their own config" ON contact_timing_config;
DROP POLICY IF EXISTS "Users can manage their own config" ON contact_timing_config;
DROP POLICY IF EXISTS "Users can view their own executions" ON contact_timing_executions;
DROP POLICY IF EXISTS "Users can manage their own executions" ON contact_timing_executions;

-- Contact interaction events table (tracks all touchpoints)
CREATE TABLE IF NOT EXISTS contact_interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'message_sent',      -- Outbound message sent
    'message_delivered', -- Message delivered
    'message_opened',    -- Message opened/read
    'message_clicked',   -- Link clicked
    'message_replied',   -- Recipient replied
    'call_initiated',    -- Call started
    'call_completed',    -- Call answered
    'meeting_scheduled', -- Meeting booked
    'meeting_attended'   -- Meeting happened
  )),
  
  -- Timing
  event_timestamp TIMESTAMPTZ NOT NULL,
  response_timestamp TIMESTAMPTZ,
  response_latency_hours NUMERIC,
  
  -- Context
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'messenger' CHECK (channel IN ('messenger', 'email', 'call', 'sms', 'meeting')),
  is_outbound BOOLEAN NOT NULL DEFAULT true,
  is_success BOOLEAN NOT NULL DEFAULT false,
  success_weight NUMERIC DEFAULT 0.0,
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_events_user 
  ON contact_interaction_events(user_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_contact_events_conversation 
  ON contact_interaction_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_contact_events_timestamp 
  ON contact_interaction_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contact_events_type 
  ON contact_interaction_events(event_type, is_success);

-- Hour-of-week bins table
CREATE TABLE IF NOT EXISTS contact_timing_bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  hour_of_week SMALLINT NOT NULL CHECK (hour_of_week >= 0 AND hour_of_week < 168),
  trials_count NUMERIC DEFAULT 0.0,
  success_count NUMERIC DEFAULT 0.0,
  raw_probability NUMERIC DEFAULT 0.0,
  smoothed_probability NUMERIC DEFAULT 0.0,
  calibrated_probability NUMERIC DEFAULT 0.0,
  last_sample NUMERIC DEFAULT 0.0,
  exploration_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, hour_of_week)
);

CREATE INDEX IF NOT EXISTS idx_timing_bins_conversation 
  ON contact_timing_bins(conversation_id, hour_of_week);
CREATE INDEX IF NOT EXISTS idx_timing_bins_probability 
  ON contact_timing_bins(conversation_id, smoothed_probability DESC);

-- Contact timing recommendations table
CREATE TABLE IF NOT EXISTS contact_timing_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  timezone_confidence TEXT DEFAULT 'low' CHECK (timezone_confidence IN ('low', 'medium', 'high')),
  timezone_source TEXT,
  recommended_windows JSONB NOT NULL DEFAULT '[]',
  max_confidence NUMERIC DEFAULT 0.0,
  recency_score NUMERIC DEFAULT 0.0,
  priority_score NUMERIC DEFAULT 0.0,
  composite_score NUMERIC DEFAULT 0.0,
  last_positive_signal_at TIMESTAMPTZ,
  last_contact_attempt_at TIMESTAMPTZ,
  total_attempts INTEGER DEFAULT 0,
  total_successes INTEGER DEFAULT 0,
  overall_response_rate NUMERIC DEFAULT 0.0,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  preferred_days INTEGER[],
  daily_attempt_cap INTEGER DEFAULT 2,
  weekly_attempt_cap INTEGER DEFAULT 5,
  min_spacing_hours INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  cooldown_until TIMESTAMPTZ,
  notes TEXT,
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  computation_duration_ms INTEGER,
  algorithm_version TEXT DEFAULT 'v1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_timing_recommendations_user 
  ON contact_timing_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_score 
  ON contact_timing_recommendations(composite_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_active 
  ON contact_timing_recommendations(is_active, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_cooldown 
  ON contact_timing_recommendations(cooldown_until) WHERE cooldown_until IS NOT NULL;

-- Segment-level priors table
CREATE TABLE IF NOT EXISTS contact_timing_segment_priors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL CHECK (segment_type IN ('global', 'industry', 'role', 'region', 'channel')),
  segment_value TEXT NOT NULL DEFAULT 'all',
  hour_of_week SMALLINT NOT NULL CHECK (hour_of_week >= 0 AND hour_of_week < 168),
  trials_count NUMERIC DEFAULT 0.0,
  success_count NUMERIC DEFAULT 0.0,
  response_rate NUMERIC DEFAULT 0.0,
  contact_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, segment_type, segment_value, hour_of_week)
);

CREATE INDEX IF NOT EXISTS idx_segment_priors_lookup 
  ON contact_timing_segment_priors(user_id, segment_type, segment_value, hour_of_week);

-- Algorithm configuration table
CREATE TABLE IF NOT EXISTS contact_timing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lambda_fast NUMERIC DEFAULT 0.05,
  lambda_slow NUMERIC DEFAULT 0.01,
  alpha_prior NUMERIC DEFAULT 1.0,
  beta_prior NUMERIC DEFAULT 1.0,
  hierarchical_kappa NUMERIC DEFAULT 5.0,
  epsilon_exploration NUMERIC DEFAULT 0.08,
  success_weight_reply NUMERIC DEFAULT 1.0,
  success_weight_click NUMERIC DEFAULT 0.5,
  success_weight_open NUMERIC DEFAULT 0.25,
  survival_gamma NUMERIC DEFAULT 0.05,
  top_k_windows INTEGER DEFAULT 6,
  min_spacing_hours INTEGER DEFAULT 4,
  daily_attempt_cap INTEGER DEFAULT 2,
  weekly_attempt_cap INTEGER DEFAULT 5,
  success_window_hours INTEGER DEFAULT 24,
  w1_confidence NUMERIC DEFAULT 0.6,
  w2_recency NUMERIC DEFAULT 0.2,
  w3_priority NUMERIC DEFAULT 0.2,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Contact timing execution log
CREATE TABLE IF NOT EXISTS contact_timing_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES contact_timing_recommendations(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  window_dow TEXT,
  window_hour INTEGER,
  hour_of_week SMALLINT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'executed', 'skipped', 'failed')),
  outcome TEXT CHECK (outcome IN ('success', 'no_response', 'failed', 'opted_out')),
  response_received_at TIMESTAMPTZ,
  response_latency_hours NUMERIC,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  channel TEXT DEFAULT 'messenger',
  execution_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timing_executions_conversation 
  ON contact_timing_executions(conversation_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_timing_executions_scheduled 
  ON contact_timing_executions(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_timing_executions_outcome 
  ON contact_timing_executions(outcome, executed_at DESC);

-- Enable RLS
ALTER TABLE contact_interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_segment_priors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_executions ENABLE ROW LEVEL SECURITY;

-- Create policies (they were dropped at the start, so safe to recreate)
CREATE POLICY "Users can view their own contact events"
  ON contact_interaction_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contact events"
  ON contact_interaction_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own timing bins"
  ON contact_timing_bins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own timing bins"
  ON contact_timing_bins FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own recommendations"
  ON contact_timing_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own recommendations"
  ON contact_timing_recommendations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own segment priors"
  ON contact_timing_segment_priors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own segment priors"
  ON contact_timing_segment_priors FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own config"
  ON contact_timing_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own config"
  ON contact_timing_config FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own executions"
  ON contact_timing_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own executions"
  ON contact_timing_executions FOR ALL
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_timing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_contact_timing_recommendations_updated_at ON contact_timing_recommendations;
DROP TRIGGER IF EXISTS update_contact_timing_config_updated_at ON contact_timing_config;
DROP TRIGGER IF EXISTS update_contact_timing_executions_updated_at ON contact_timing_executions;

-- Create triggers
CREATE TRIGGER update_contact_timing_recommendations_updated_at
  BEFORE UPDATE ON contact_timing_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_timing_updated_at();

CREATE TRIGGER update_contact_timing_config_updated_at
  BEFORE UPDATE ON contact_timing_config
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_timing_updated_at();

CREATE TRIGGER update_contact_timing_executions_updated_at
  BEFORE UPDATE ON contact_timing_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_timing_updated_at();

-- Comments
COMMENT ON TABLE contact_interaction_events IS 'Tracks all contact interaction events for best-time-to-contact learning';
COMMENT ON TABLE contact_timing_bins IS 'Stores 168 hour-of-week bins per contact with Beta-Binomial statistics';
COMMENT ON TABLE contact_timing_recommendations IS 'Computed best contact times and rankings for each contact';
COMMENT ON TABLE contact_timing_segment_priors IS 'Hierarchical priors for segment-level pooling';
COMMENT ON TABLE contact_timing_config IS 'Algorithm hyperparameters per user';
COMMENT ON TABLE contact_timing_executions IS 'Log of scheduled and executed contact attempts';

