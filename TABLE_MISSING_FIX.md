# ⚠️ Missing Database Table: ai_automation_rules

## Error

When trying to create an AI Automation, you get:
```
Could not find the table 'public.ai_automation_rules' in the schema cache
```

## Cause

The AI Automations feature requires a database table that hasn't been created yet.

## Solution

Run the SQL migration in Supabase to create the missing table.

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to: **SQL Editor** (left sidebar)

### Step 2: Run the Migration

Copy and paste the contents of `create-ai-automation-rules-table.sql` into the SQL Editor and click **Run**.

**OR** paste this SQL:

```sql
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
  active_hours_start INTEGER DEFAULT 9,
  active_hours_end INTEGER DEFAULT 21,
  
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_user_id ON public.ai_automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_enabled ON public.ai_automation_rules(enabled);

-- Enable RLS
ALTER TABLE public.ai_automation_rules ENABLE ROW LEVEL SECURITY;

-- Create policies (simplified for quick setup)
CREATE POLICY "Users can manage own automation rules"
  ON public.ai_automation_rules
  FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE id::text = auth.uid()::text))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE id::text = auth.uid()::text));

-- Grant permissions
GRANT ALL ON public.ai_automation_rules TO authenticated;
GRANT ALL ON public.ai_automation_rules TO service_role;
```

### Step 3: Verify

After running the SQL, verify the table was created:

```sql
SELECT * FROM public.ai_automation_rules LIMIT 1;
```

You should see an empty result (no error).

### Step 4: Test the Feature

1. Go back to your app: https://mae-squarish-sid.ngrok-free.dev/dashboard/ai-automations
2. Try creating an automation rule
3. It should work now! ✅

## What This Table Does

The `ai_automation_rules` table stores automated follow-up configurations:

- **Triggers**: Time-based or tag-based activation
- **AI Settings**: Custom prompts and language style
- **Scheduling**: Active hours and message limits
- **Filtering**: Include/exclude specific conversation tags
- **Behavior**: Stop on reply, auto-tag removal

## All Required Migrations

Make sure you've run these SQL files in Supabase:

1. ✅ `supabase-schema.sql` - Main schema (users, conversations, etc.)
2. ✅ `add-facebook-token-column.sql` - Facebook token storage
3. ⚠️ `create-ai-automation-rules-table.sql` - **RUN THIS NOW**

## After Running Migration

The AI Automations page will work and you can:
- Create automated follow-up rules
- Set custom AI prompts
- Schedule messages with time intervals
- Filter by conversation tags
- Set daily limits and active hours

---

**Status**: ⚠️ Table missing - Run SQL migration to fix
**File**: `create-ai-automation-rules-table.sql`
**Location**: Supabase SQL Editor



