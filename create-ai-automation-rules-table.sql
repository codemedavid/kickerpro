-- Create AI Automation Rules Table
-- Run this in your Supabase SQL Editor

-- Create the ai_automation_rules table
CREATE TABLE IF NOT EXISTS public.ai_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  
  -- Trigger configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('time_based', 'tag_based', 'manual')),
  time_interval_minutes INTEGER,
  
  -- AI Configuration
  custom_prompt TEXT,
  language_style TEXT DEFAULT 'taglish',
  message_tag TEXT,
  
  -- Limits and scheduling
  max_messages_per_day INTEGER DEFAULT 100,
  active_hours_start INTEGER DEFAULT 9 CHECK (active_hours_start >= 0 AND active_hours_start <= 23),
  active_hours_end INTEGER DEFAULT 21 CHECK (active_hours_end >= 0 AND active_hours_end <= 23),
  
  -- Tag filtering
  include_tag_ids UUID[] DEFAULT ARRAY[]::UUID[],
  exclude_tag_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Behavior
  stop_on_reply BOOLEAN DEFAULT true,
  remove_tag_on_reply UUID,
  
  -- Metadata
  last_run_at TIMESTAMPTZ,
  messages_sent_today INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_user_id ON public.ai_automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_enabled ON public.ai_automation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_trigger_type ON public.ai_automation_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_last_run ON public.ai_automation_rules(last_run_at);

-- Enable Row Level Security
ALTER TABLE public.ai_automation_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own automation rules
CREATE POLICY "Users can view own automation rules"
  ON public.ai_automation_rules
  FOR SELECT
  USING (auth.uid()::text IN (
    SELECT id::text FROM public.users WHERE id = ai_automation_rules.user_id
  ));

-- Users can insert their own automation rules
CREATE POLICY "Users can create own automation rules"
  ON public.ai_automation_rules
  FOR INSERT
  WITH CHECK (auth.uid()::text IN (
    SELECT id::text FROM public.users WHERE id = ai_automation_rules.user_id
  ));

-- Users can update their own automation rules
CREATE POLICY "Users can update own automation rules"
  ON public.ai_automation_rules
  FOR UPDATE
  USING (auth.uid()::text IN (
    SELECT id::text FROM public.users WHERE id = ai_automation_rules.user_id
  ));

-- Users can delete their own automation rules
CREATE POLICY "Users can delete own automation rules"
  ON public.ai_automation_rules
  FOR DELETE
  USING (auth.uid()::text IN (
    SELECT id::text FROM public.users WHERE id = ai_automation_rules.user_id
  ));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_automation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_ai_automation_rules_updated_at
  BEFORE UPDATE ON public.ai_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_automation_rules_updated_at();

-- Grant permissions
GRANT ALL ON public.ai_automation_rules TO authenticated;
GRANT ALL ON public.ai_automation_rules TO service_role;

-- Comments
COMMENT ON TABLE public.ai_automation_rules IS 'AI-powered automation rules for follow-up messages';
COMMENT ON COLUMN public.ai_automation_rules.trigger_type IS 'Type of trigger: time_based, tag_based, or manual';
COMMENT ON COLUMN public.ai_automation_rules.include_tag_ids IS 'Array of tag IDs that conversations must have';
COMMENT ON COLUMN public.ai_automation_rules.exclude_tag_ids IS 'Array of tag IDs that conversations must NOT have';
COMMENT ON COLUMN public.ai_automation_rules.stop_on_reply IS 'Stop sending to a conversation if they reply';
COMMENT ON COLUMN public.ai_automation_rules.remove_tag_on_reply IS 'Tag to remove when user replies';






