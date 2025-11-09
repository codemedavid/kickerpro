-- Fix RLS Policies for Pipeline Tables - Clean Version
-- Safe to run multiple times

-- Drop ALL existing policies on pipeline tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'pipeline%'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Create permissive policies (Allow All)
CREATE POLICY "allow_all_pipeline_stages" 
  ON pipeline_stages FOR ALL 
  TO public, anon, authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "allow_all_pipeline_settings" 
  ON pipeline_settings FOR ALL 
  TO public, anon, authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "allow_all_pipeline_opportunities" 
  ON pipeline_opportunities FOR ALL 
  TO public, anon, authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "allow_all_pipeline_stage_history" 
  ON pipeline_stage_history FOR ALL 
  TO public, anon, authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON pipeline_stages TO public, anon, authenticated, service_role;
GRANT ALL ON pipeline_settings TO public, anon, authenticated, service_role;
GRANT ALL ON pipeline_opportunities TO public, anon, authenticated, service_role;
GRANT ALL ON pipeline_stage_history TO public, anon, authenticated, service_role;

-- Ensure RLS is enabled
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;

-- Verify
SELECT 
    '✅ Pipeline RLS policies fixed!' as status,
    COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename LIKE 'pipeline%';

