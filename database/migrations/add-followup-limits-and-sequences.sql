-- Add follow-up limits and sequential intervals
-- Allows: "Follow up 3 times max" or "Unlimited"
-- Allows: "30 min, then 2 hours, then 24 hours" sequential intervals

ALTER TABLE ai_automation_rules
ADD COLUMN IF NOT EXISTS max_follow_ups INTEGER DEFAULT NULL, -- NULL = unlimited, number = max times
ADD COLUMN IF NOT EXISTS follow_up_sequence JSONB DEFAULT NULL, -- Array of intervals: [{"minutes": 30}, {"hours": 2}, {"days": 1}]
ADD COLUMN IF NOT EXISTS stop_on_reply BOOLEAN DEFAULT true, -- Stop when contact replies
ADD COLUMN IF NOT EXISTS remove_tag_on_reply TEXT; -- Tag to remove when contact replies (auto-stop)

-- Add tracking for follow-up counts per conversation
ALTER TABLE ai_automation_executions
ADD COLUMN IF NOT EXISTS follow_up_number INTEGER DEFAULT 1, -- Which follow-up this is (1st, 2nd, 3rd, etc.)
ADD COLUMN IF NOT EXISTS stopped_reason TEXT; -- Why automation stopped for this conversation

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_automation_executions_follow_up 
  ON ai_automation_executions(conversation_id, rule_id, follow_up_number);

-- Create table to track stopped automations per conversation
CREATE TABLE IF NOT EXISTS ai_automation_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES ai_automation_rules(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  sender_id TEXT NOT NULL,
  
  -- Stop details
  stopped_at TIMESTAMPTZ DEFAULT NOW(),
  stopped_reason TEXT NOT NULL, -- 'contact_replied', 'max_follow_ups_reached', 'manual_stop'
  follow_ups_sent INTEGER DEFAULT 0,
  
  -- Optional: Tag that was removed
  tag_removed TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(rule_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_automation_stops_rule_conv
  ON ai_automation_stops(rule_id, conversation_id);

-- Enable RLS
ALTER TABLE ai_automation_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automation stops"
  ON ai_automation_stops FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_automation_rules
      WHERE ai_automation_rules.id = ai_automation_stops.rule_id
      AND ai_automation_rules.user_id = auth.uid()
    )
  );

CREATE POLICY "Service can manage automation stops"
  ON ai_automation_stops FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON COLUMN ai_automation_rules.max_follow_ups IS 'Maximum number of times to follow up with each contact (NULL = unlimited)';
COMMENT ON COLUMN ai_automation_rules.follow_up_sequence IS 'Sequential time intervals for follow-ups: [{"minutes": 30}, {"hours": 2}, {"days": 1}]';
COMMENT ON COLUMN ai_automation_rules.stop_on_reply IS 'Automatically stop following up when contact replies';
COMMENT ON COLUMN ai_automation_rules.remove_tag_on_reply IS 'Tag ID to remove when contact replies (triggers automation stop)';
COMMENT ON TABLE ai_automation_stops IS 'Tracks conversations where automation has been stopped';









