# ⚡ FINAL SETUP - 2 Quick Steps Required

## ✅ What I Did For You (Already Complete!)

1. ✅ **Added environment variables to `.env.local`**
   ```bash
   NEXT_PUBLIC_FACEBOOK_APP_ID=802438925861067
   FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

2. ✅ **Added Facebook connection UI to your dashboard**
   - Component imported and added to `src/app/dashboard/page.tsx`
   - Will show up prominently when you run the app

3. ✅ **Created all backend API routes** (6 endpoints)

4. ✅ **Built complete token management system**

---

## 🎯 YOU NEED TO DO: 2 Quick Steps (5 Minutes)

### Step 1: Run Database Migration (2 minutes)

**Copy this SQL and run it in Supabase:**

1. **Open Supabase:**
   - Go to https://supabase.com
   - Click on your project
   - Click **"SQL Editor"** in left sidebar

2. **Copy and paste this SQL:**

```sql
-- Add Facebook OAuth token storage to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS facebook_access_token TEXT,
ADD COLUMN IF NOT EXISTS facebook_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS facebook_token_updated_at TIMESTAMPTZ;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id);

-- Update the facebook_pages table to include token expiry
ALTER TABLE facebook_pages
ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ;

-- Add index for active pages lookup
CREATE INDEX IF NOT EXISTS idx_facebook_pages_user_active ON facebook_pages(user_id, is_active);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to facebook_pages table
DROP TRIGGER IF EXISTS update_facebook_pages_updated_at ON facebook_pages;
CREATE TRIGGER update_facebook_pages_updated_at
    BEFORE UPDATE ON facebook_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_pages ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Users can only see and manage their own pages
CREATE POLICY "Users can view own pages" ON facebook_pages
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own pages" ON facebook_pages
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own pages" ON facebook_pages
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own pages" ON facebook_pages
    FOR DELETE USING (auth.uid()::text = user_id::text);
```

3. **Click "Run" button**

4. **You should see:** "Success. No rows returned"

✅ **Done! Database is ready.**

---

### Step 2: Configure Facebook App (3 minutes)

**Add the callback URL to your Facebook App:**

1. **Open Facebook Developer Console:**
   - Go to https://developers.facebook.com/apps/802438925861067
   - (This is YOUR app with ID: 802438925861067)

2. **Navigate to Facebook Login Settings:**
   - Click **"Facebook Login"** in left sidebar
   - Click **"Settings"**

3. **Add OAuth Redirect URI:**
   - Find the field: **"Valid OAuth Redirect URIs"**
   - Add this URL:
     ```
     http://localhost:3000/api/auth/facebook/callback
     ```
   - Click **"Save Changes"** at bottom

4. **Optional - Add App Domain (for production later):**
   - Go to **Settings → Basic**
   - In "App Domains" field, add: `localhost`
   - Click **"Save Changes"**

✅ **Done! Facebook App configured.**

---

## 🚀 TEST IT NOW!

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   ```
   http://localhost:3000/dashboard
   ```

3. **You should see:**
   - A new "Facebook Connection" card on your dashboard
   - A "Connect Facebook" button

4. **Click the button:**
   - You'll be redirected to Facebook
   - Authorize the app
   - Redirected back with success message
   - See all your Facebook Pages listed!

---

## ✨ What Happens When You Connect

```
1. User clicks "Connect Facebook"
   ↓
2. Redirects to Facebook OAuth
   ↓
3. User authorizes
   ↓
4. AUTOMATICALLY:
   ✅ Exchanges for long-lived token (60 days)
   ✅ Saves token to Supabase users table
   ✅ Fetches all Facebook Pages
   ✅ Saves pages to facebook_pages table
   ✅ Shows success + page list
   ↓
5. DONE! User can now send bulk messages
```

---

## 🎯 Summary

| Task | Status |
|------|--------|
| Environment variables | ✅ Done (by me) |
| Dashboard UI component | ✅ Done (by me) |
| Backend API routes | ✅ Done (by me) |
| Database migration | ⏳ **Run SQL in Supabase** |
| Facebook App config | ⏳ **Add redirect URI** |

---

## 📞 Need Help?

- **SQL file location:** `supabase/migrations/add_facebook_oauth_tokens.sql`
- **Dashboard file:** `src/app/dashboard/page.tsx` (already updated!)
- **Complete guide:** `FACEBOOK_OAUTH_SETUP.md`

---

## 🎉 After Setup

Once you complete the 2 steps above:

✅ Every user can connect their Facebook account  
✅ Automatic long-lived token generation (60 days)  
✅ Auto-sync Facebook Pages  
✅ No more manual token work!  

**Your app is ready for multi-user Facebook automation!** 🚀

