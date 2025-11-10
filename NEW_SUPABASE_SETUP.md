# 🆕 New Supabase Project Setup

You're switching to a new Supabase project: **`dahqykjwyzuprrcliudc`**

## ✅ Updated .env.local

Your `.env.local` has been updated with:
- ✅ New Supabase URL: `https://dahqykjwyzuprrcliudc.supabase.co`
- ✅ New Anon Key: Updated
- ⚠️ Service Role Key: **YOU NEED TO ADD THIS**

## ⚠️ IMPORTANT: Get Your Service Role Key

### Step 1: Get Service Role Key
1. Go to: https://app.supabase.com/project/dahqykjwyzuprrcliudc/settings/api
2. Scroll to **Service Role** section
3. Click to reveal the service role key
4. Copy it

### Step 2: Add to .env.local
Open `.env.local` and replace this line:
```
SUPABASE_SERVICE_ROLE_KEY=YOUR_NEW_SERVICE_ROLE_KEY_HERE
```

With:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... (your actual key)
```

## 📋 Database Migrations Required

Since this is a fresh Supabase project, you need to set up the database schema.

### Migration 1: Main Schema (Users, Conversations, Messages, etc.)

Go to: https://app.supabase.com/project/dahqykjwyzuprrcliudc/sql

Run the SQL from: **`supabase-schema.sql`**

This creates:
- ✅ Users table
- ✅ Conversations table  
- ✅ Messages table
- ✅ Tags system
- ✅ All required tables

### Migration 2: Facebook Token Columns

```sql
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS facebook_access_token TEXT,
ADD COLUMN IF NOT EXISTS facebook_token_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON public.users(facebook_id);
```

### Migration 3: AI Automation Rules

```sql
CREATE TABLE IF NOT EXISTS public.ai_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL,
  time_interval_minutes INTEGER,
  custom_prompt TEXT,
  language_style TEXT DEFAULT 'taglish',
  message_tag TEXT,
  max_messages_per_day INTEGER DEFAULT 100,
  active_hours_start INTEGER DEFAULT 9,
  active_hours_end INTEGER DEFAULT 21,
  include_tag_ids UUID[] DEFAULT ARRAY[]::UUID[],
  exclude_tag_ids UUID[] DEFAULT ARRAY[]::UUID[],
  stop_on_reply BOOLEAN DEFAULT true,
  remove_tag_on_reply UUID,
  last_run_at TIMESTAMPTZ,
  messages_sent_today INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_user_id 
  ON public.ai_automation_rules(user_id);

ALTER TABLE public.ai_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own automations"
  ON public.ai_automation_rules FOR ALL
  USING (user_id IN (SELECT id FROM public.users));

GRANT ALL ON public.ai_automation_rules TO authenticated;
GRANT ALL ON public.ai_automation_rules TO service_role;
```

### Migration 4: Disable Email Confirmation

In Supabase Dashboard:
1. Go to: Authentication → Settings → Email Auth
2. Toggle OFF: "Enable email confirmations"
3. Click Save

## 🔄 Restart Your Server

After updating `.env.local`:

```bash
# Stop server
taskkill /F /IM node.exe

# Start server
npm run dev
```

## ✅ Testing Checklist

After setup, test these:

1. **Login with Facebook** → Should create user and session
2. **View Conversations** → Should be empty (fresh database)
3. **Create AI Automation** → Should work (table exists)
4. **Send Messages** → Should work (all tables present)

## 📁 Migration Files Available

All SQL files are ready in your project:
- `supabase-schema.sql` - Complete main schema
- `add-facebook-token-column.sql` - Facebook tokens
- `create-ai-automation-rules-table.sql` - AI automations

## 🎯 Quick Setup Steps

1. ✅ Update SUPABASE_SERVICE_ROLE_KEY in `.env.local`
2. ✅ Run `supabase-schema.sql` in new Supabase SQL Editor
3. ✅ Run `create-ai-automation-rules-table.sql` in SQL Editor  
4. ✅ Disable email confirmation in Authentication settings
5. ✅ Restart dev server: `npm run dev`
6. ✅ Test login at your ngrok URL

## Why Use a Separate Supabase?

**Benefits:**
- ✅ Clean slate - no old data
- ✅ Fresh database schema
- ✅ Better isolation for testing
- ✅ Can keep old project as backup

**Note:** You'll need to reconnect Facebook pages and setup from scratch, but the app will work the same.

---

**Next Step**: Add your Service Role Key and run the migrations! 🚀









