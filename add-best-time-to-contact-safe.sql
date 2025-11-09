-- ================================================================
-- BEST TIME TO CONTACT - Database Schema (SAFE VERSION)
-- ================================================================
-- 
-- This migration creates all tables, indexes, policies, and triggers
-- needed for the AI-powered Best Time to Contact feature.
--
-- SAFE TO RUN MULTIPLE TIMES - Uses IF NOT EXISTS and DROP IF EXISTS
--
-- Run this in your Supabase SQL Editor
-- ================================================================

-- ================================================================
-- STEP 1: DROP EXISTING POLICIES (Safe cleanup)
-- ================================================================

DO $$ 
BEGIN
    -- Drop policies for contact_interaction_events
    DROP POLICY IF EXISTS "Users can view their own contact events" ON contact_interaction_events;
    DROP POLICY IF EXISTS "Users can insert their own contact events" ON contact_interaction_events;
    DROP POLICY IF EXISTS "Users can update their own contact events" ON contact_interaction_events;
    DROP POLICY IF EXISTS "Users can delete their own contact events" ON contact_interaction_events;
    
    -- Drop policies for contact_timing_bins
    DROP POLICY IF EXISTS "Users can view their own timing bins" ON contact_timing_bins;
    DROP POLICY IF EXISTS "Users can manage their own timing bins" ON contact_timing_bins;
    DROP POLICY IF EXISTS "Users can insert their own timing bins" ON contact_timing_bins;
    DROP POLICY IF EXISTS "Users can update their own timing bins" ON contact_timing_bins;
    DROP POLICY IF EXISTS "Users can delete their own timing bins" ON contact_timing_bins;
    
    -- Drop policies for contact_timing_recommendations
    DROP POLICY IF EXISTS "Users can view their own recommendations" ON contact_timing_recommendations;
    DROP POLICY IF EXISTS "Users can manage their own recommendations" ON contact_timing_recommendations;
    DROP POLICY IF EXISTS "Users can insert their own recommendations" ON contact_timing_recommendations;
    DROP POLICY IF EXISTS "Users can update their own recommendations" ON contact_timing_recommendations;
    DROP POLICY IF EXISTS "Users can delete their own recommendations" ON contact_timing_recommendations;
    
    -- Drop policies for contact_timing_segment_priors
    DROP POLICY IF EXISTS "Users can view their own segment priors" ON contact_timing_segment_priors;
    DROP POLICY IF EXISTS "Users can manage their own segment priors" ON contact_timing_segment_priors;
    DROP POLICY IF EXISTS "Users can insert their own segment priors" ON contact_timing_segment_priors;
    DROP POLICY IF EXISTS "Users can update their own segment priors" ON contact_timing_segment_priors;
    DROP POLICY IF EXISTS "Users can delete their own segment priors" ON contact_timing_segment_priors;
    
    -- Drop policies for contact_timing_config
    DROP POLICY IF EXISTS "Users can view their own config" ON contact_timing_config;
    DROP POLICY IF EXISTS "Users can manage their own config" ON contact_timing_config;
    DROP POLICY IF EXISTS "Users can insert their own config" ON contact_timing_config;
    DROP POLICY IF EXISTS "Users can update their own config" ON contact_timing_config;
    DROP POLICY IF EXISTS "Users can delete their own config" ON contact_timing_config;
    
    -- Drop policies for contact_timing_executions
    DROP POLICY IF EXISTS "Users can view their own executions" ON contact_timing_executions;
    DROP POLICY IF EXISTS "Users can manage their own executions" ON contact_timing_executions;
    DROP POLICY IF EXISTS "Users can insert their own executions" ON contact_timing_executions;
    DROP POLICY IF EXISTS "Users can update their own executions" ON contact_timing_executions;
    DROP POLICY IF EXISTS "Users can delete their own executions" ON contact_timing_executions;
    
    RAISE NOTICE 'Existing policies dropped successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping policies (this is ok if tables do not exist): %', SQLERRM;
END $$;

-- ================================================================
-- STEP 2: CREATE TABLES
-- ================================================================

-- Table 1: Contact Interaction Events
-- Tracks all contact touchpoints (messages, calls, meetings, etc.)
CREATE TABLE IF NOT EXISTS contact_interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  
  -- Event classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'message_sent',      -- Outbound message sent
    'message_delivered', -- Message delivered to recipient
    'message_opened',    -- Message read by recipient
    'message_clicked',   -- Link in message clicked
    'message_replied',   -- Recipient sent reply
    'call_initiated',    -- Outbound call started
    'call_completed',    -- Call connected/answered
    'meeting_scheduled', -- Meeting booked
    'meeting_attended'   -- Meeting completed
  )),
  
  -- Timing information
  event_timestamp TIMESTAMPTZ NOT NULL,
  response_timestamp TIMESTAMPTZ,
  response_latency_hours NUMERIC,
  
  -- Context
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'messenger' CHECK (channel IN ('messenger', 'email', 'call', 'sms', 'meeting')),
  is_outbound BOOLEAN NOT NULL DEFAULT true,
  is_success BOOLEAN NOT NULL DEFAULT false,
  success_weight NUMERIC DEFAULT 0.0 CHECK (success_weight >= 0 AND success_weight <= 1),
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: Contact Timing Bins
-- Stores 168 hour-of-week bins per contact (Beta-Binomial statistics)
CREATE TABLE IF NOT EXISTS contact_timing_bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  
  -- Hour-of-week: 0-167 (Sun 00:00 = 0, Sat 23:00 = 167)
  hour_of_week SMALLINT NOT NULL CHECK (hour_of_week >= 0 AND hour_of_week < 168),
  
  -- Beta-Binomial statistics
  trials_count NUMERIC DEFAULT 0.0 CHECK (trials_count >= 0),
  success_count NUMERIC DEFAULT 0.0 CHECK (success_count >= 0),
  
  -- Computed probabilities
  raw_probability NUMERIC DEFAULT 0.0 CHECK (raw_probability >= 0 AND raw_probability <= 1),
  smoothed_probability NUMERIC DEFAULT 0.0 CHECK (smoothed_probability >= 0 AND smoothed_probability <= 1),
  calibrated_probability NUMERIC DEFAULT 0.0 CHECK (calibrated_probability >= 0 AND calibrated_probability <= 1),
  
  -- Thompson Sampling
  last_sample NUMERIC DEFAULT 0.0,
  exploration_count INTEGER DEFAULT 0 CHECK (exploration_count >= 0),
  
  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(conversation_id, hour_of_week)
);

-- Table 3: Contact Timing Recommendations
-- Final computed recommendations with scoring
CREATE TABLE IF NOT EXISTS contact_timing_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  
  -- Timezone information
  timezone TEXT NOT NULL DEFAULT 'UTC',
  timezone_confidence TEXT DEFAULT 'low' CHECK (timezone_confidence IN ('low', 'medium', 'high')),
  timezone_source TEXT,
  
  -- Recommended windows (JSONB array)
  -- Format: [{ dow: "Tue", start: "10:00", end: "11:00", confidence: 0.42, hour_of_week: 34 }]
  recommended_windows JSONB NOT NULL DEFAULT '[]',
  
  -- Scoring metrics
  max_confidence NUMERIC DEFAULT 0.0 CHECK (max_confidence >= 0 AND max_confidence <= 1),
  recency_score NUMERIC DEFAULT 0.0 CHECK (recency_score >= 0 AND recency_score <= 1),
  priority_score NUMERIC DEFAULT 0.0 CHECK (priority_score >= 0 AND priority_score <= 1),
  composite_score NUMERIC DEFAULT 0.0 CHECK (composite_score >= 0 AND composite_score <= 1),
  
  -- Contact history
  last_positive_signal_at TIMESTAMPTZ,
  last_contact_attempt_at TIMESTAMPTZ,
  total_attempts INTEGER DEFAULT 0 CHECK (total_attempts >= 0),
  total_successes INTEGER DEFAULT 0 CHECK (total_successes >= 0),
  overall_response_rate NUMERIC DEFAULT 0.0 CHECK (overall_response_rate >= 0 AND overall_response_rate <= 1),
  
  -- Contact preferences
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  preferred_days INTEGER[] CHECK (preferred_days IS NULL OR (SELECT bool_and(day >= 0 AND day <= 6) FROM unnest(preferred_days) AS day)),
  daily_attempt_cap INTEGER DEFAULT 2 CHECK (daily_attempt_cap > 0),
  weekly_attempt_cap INTEGER DEFAULT 5 CHECK (weekly_attempt_cap > 0),
  min_spacing_hours INTEGER DEFAULT 4 CHECK (min_spacing_hours > 0),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  cooldown_until TIMESTAMPTZ,
  notes TEXT,
  
  -- Computation metadata
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  computation_duration_ms INTEGER CHECK (computation_duration_ms >= 0),
  algorithm_version TEXT DEFAULT 'v1.0',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(conversation_id)
);

-- Table 4: Segment-Level Priors
-- Hierarchical Bayesian pooling for cold-start problem
CREATE TABLE IF NOT EXISTS contact_timing_segment_priors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Segment definition
  segment_type TEXT NOT NULL CHECK (segment_type IN ('global', 'industry', 'role', 'region', 'channel')),
  segment_value TEXT NOT NULL DEFAULT 'all',
  
  -- Hour-of-week
  hour_of_week SMALLINT NOT NULL CHECK (hour_of_week >= 0 AND hour_of_week < 168),
  
  -- Aggregated statistics
  trials_count NUMERIC DEFAULT 0.0 CHECK (trials_count >= 0),
  success_count NUMERIC DEFAULT 0.0 CHECK (success_count >= 0),
  response_rate NUMERIC DEFAULT 0.0 CHECK (response_rate >= 0 AND response_rate <= 1),
  
  -- Metadata
  contact_count INTEGER DEFAULT 0 CHECK (contact_count >= 0),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, segment_type, segment_value, hour_of_week)
);

-- Table 5: Algorithm Configuration
-- Per-user hyperparameters
CREATE TABLE IF NOT EXISTS contact_timing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Time decay parameters
  lambda_fast NUMERIC DEFAULT 0.05 CHECK (lambda_fast > 0),
  lambda_slow NUMERIC DEFAULT 0.01 CHECK (lambda_slow > 0),
  
  -- Beta-Binomial priors
  alpha_prior NUMERIC DEFAULT 1.0 CHECK (alpha_prior > 0),
  beta_prior NUMERIC DEFAULT 1.0 CHECK (beta_prior > 0),
  
  -- Hierarchical pooling
  hierarchical_kappa NUMERIC DEFAULT 5.0 CHECK (hierarchical_kappa >= 0),
  
  -- Thompson Sampling
  epsilon_exploration NUMERIC DEFAULT 0.08 CHECK (epsilon_exploration >= 0 AND epsilon_exploration <= 1),
  
  -- Success weighting
  success_weight_reply NUMERIC DEFAULT 1.0 CHECK (success_weight_reply >= 0 AND success_weight_reply <= 1),
  success_weight_click NUMERIC DEFAULT 0.5 CHECK (success_weight_click >= 0 AND success_weight_click <= 1),
  success_weight_open NUMERIC DEFAULT 0.25 CHECK (success_weight_open >= 0 AND success_weight_open <= 1),
  survival_gamma NUMERIC DEFAULT 0.05 CHECK (survival_gamma >= 0),
  
  -- Window selection
  top_k_windows INTEGER DEFAULT 6 CHECK (top_k_windows > 0),
  min_spacing_hours INTEGER DEFAULT 4 CHECK (min_spacing_hours > 0),
  daily_attempt_cap INTEGER DEFAULT 2 CHECK (daily_attempt_cap > 0),
  weekly_attempt_cap INTEGER DEFAULT 5 CHECK (weekly_attempt_cap > 0),
  success_window_hours INTEGER DEFAULT 24 CHECK (success_window_hours > 0),
  
  -- Composite score weights
  w1_confidence NUMERIC DEFAULT 0.6 CHECK (w1_confidence >= 0 AND w1_confidence <= 1),
  w2_recency NUMERIC DEFAULT 0.2 CHECK (w2_recency >= 0 AND w2_recency <= 1),
  w3_priority NUMERIC DEFAULT 0.2 CHECK (w3_priority >= 0 AND w3_priority <= 1),
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id),
  CHECK (w1_confidence + w2_recency + w3_priority = 1.0)
);

-- Table 6: Execution Log
-- Tracks scheduled and completed contact attempts
CREATE TABLE IF NOT EXISTS contact_timing_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES contact_timing_recommendations(id) ON DELETE SET NULL,
  
  -- Execution timing
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  window_dow TEXT,
  window_hour INTEGER CHECK (window_hour >= 0 AND window_hour < 24),
  hour_of_week SMALLINT CHECK (hour_of_week >= 0 AND hour_of_week < 168),
  
  -- Outcome tracking
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'executed', 'skipped', 'failed')),
  outcome TEXT CHECK (outcome IN ('success', 'no_response', 'failed', 'opted_out')),
  response_received_at TIMESTAMPTZ,
  response_latency_hours NUMERIC CHECK (response_latency_hours >= 0),
  
  -- Context
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  channel TEXT DEFAULT 'messenger',
  
  -- Metadata
  execution_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- STEP 3: CREATE INDEXES
-- ================================================================

-- Indexes for contact_interaction_events
CREATE INDEX IF NOT EXISTS idx_contact_events_user 
  ON contact_interaction_events(user_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_contact_events_conversation 
  ON contact_interaction_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_contact_events_timestamp 
  ON contact_interaction_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contact_events_type 
  ON contact_interaction_events(event_type, is_success);

-- Indexes for contact_timing_bins
CREATE INDEX IF NOT EXISTS idx_timing_bins_conversation 
  ON contact_timing_bins(conversation_id, hour_of_week);
CREATE INDEX IF NOT EXISTS idx_timing_bins_probability 
  ON contact_timing_bins(conversation_id, smoothed_probability DESC);

-- Indexes for contact_timing_recommendations
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_user 
  ON contact_timing_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_score 
  ON contact_timing_recommendations(composite_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_active 
  ON contact_timing_recommendations(is_active, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_timing_recommendations_cooldown 
  ON contact_timing_recommendations(cooldown_until) 
  WHERE cooldown_until IS NOT NULL;

-- Indexes for contact_timing_segment_priors
CREATE INDEX IF NOT EXISTS idx_segment_priors_lookup 
  ON contact_timing_segment_priors(user_id, segment_type, segment_value, hour_of_week);

-- Indexes for contact_timing_executions
CREATE INDEX IF NOT EXISTS idx_timing_executions_conversation 
  ON contact_timing_executions(conversation_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_timing_executions_scheduled 
  ON contact_timing_executions(scheduled_for) 
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_timing_executions_outcome 
  ON contact_timing_executions(outcome, executed_at DESC);

-- ================================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE contact_interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_segment_priors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timing_executions ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- STEP 5: CREATE RLS POLICIES
-- ================================================================

-- Policies for contact_interaction_events
CREATE POLICY "Users can view their own contact events"
  ON contact_interaction_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contact events"
  ON contact_interaction_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies for contact_timing_bins
CREATE POLICY "Users can view their own timing bins"
  ON contact_timing_bins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own timing bins"
  ON contact_timing_bins FOR ALL
  USING (auth.uid() = user_id);

-- Policies for contact_timing_recommendations
CREATE POLICY "Users can view their own recommendations"
  ON contact_timing_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own recommendations"
  ON contact_timing_recommendations FOR ALL
  USING (auth.uid() = user_id);

-- Policies for contact_timing_segment_priors
CREATE POLICY "Users can view their own segment priors"
  ON contact_timing_segment_priors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own segment priors"
  ON contact_timing_segment_priors FOR ALL
  USING (auth.uid() = user_id);

-- Policies for contact_timing_config
CREATE POLICY "Users can view their own config"
  ON contact_timing_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own config"
  ON contact_timing_config FOR ALL
  USING (auth.uid() = user_id);

-- Policies for contact_timing_executions
CREATE POLICY "Users can view their own executions"
  ON contact_timing_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own executions"
  ON contact_timing_executions FOR ALL
  USING (auth.uid() = user_id);

-- ================================================================
-- STEP 6: CREATE FUNCTIONS AND TRIGGERS
-- ================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_timing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers (safe)
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

-- ================================================================
-- STEP 7: ADD TABLE COMMENTS (Documentation)
-- ================================================================

COMMENT ON TABLE contact_interaction_events IS 
  'Tracks all contact interaction events (messages, calls, meetings) for machine learning-based timing optimization';

COMMENT ON TABLE contact_timing_bins IS 
  'Stores 168 hour-of-week bins per contact with Beta-Binomial statistics for probability calculations';

COMMENT ON TABLE contact_timing_recommendations IS 
  'Final computed best contact times and rankings for each contact with confidence scores';

COMMENT ON TABLE contact_timing_segment_priors IS 
  'Hierarchical priors for segment-level pooling to solve cold-start problem';

COMMENT ON TABLE contact_timing_config IS 
  'Algorithm hyperparameters per user - tune for optimal performance';

COMMENT ON TABLE contact_timing_executions IS 
  'Execution log tracking scheduled and completed contact attempts with outcomes';

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Best Time to Contact Migration Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created: 6';
  RAISE NOTICE 'Indexes created: 12';
  RAISE NOTICE 'RLS policies created: 12';
  RAISE NOTICE 'Triggers created: 3';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Sync conversations from Facebook';
  RAISE NOTICE '2. Visit Best Time to Contact page';
  RAISE NOTICE '3. Auto-compute will start automatically';
  RAISE NOTICE '========================================';
END $$;

