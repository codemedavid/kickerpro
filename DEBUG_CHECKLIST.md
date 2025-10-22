# 🔍 Debug Checklist - Authentication Issues

## ✅ Server Status

Your server is running! I verified:
- ✅ Port 3000 is accessible
- ✅ Supabase environment variables are set
- ✅ API endpoints are responding

## 🧪 Quick Diagnostic Tests

### Test 1: Check Supabase Configuration

**Open in browser:**
```
http://localhost:3000/api/test-supabase
```

**Expected response if working:**
```json
{
  "timestamp": "...",
  "environment": {
    "hasSupabaseUrl": true,
    "hasSupabaseKey": true,
    "supabaseUrl": "https://your-project.supabase.co",
    "mode": "production"
  },
  "tests": {
    "clientCreation": {"success": true},
    "usersTable": {"success": true}
  }
}
```

**If you see errors:**
- `usersTable: {success: false}` → Run `supabase-schema.sql`
- `hasSupabaseUrl: false` → Check `.env.local`

### Test 2: Check Auth Endpoint

**Open in browser:**
```
http://localhost:3000/api/auth/facebook
```

**Expected response:**
```json
{
  "status": "ok",
  "endpoint": "Facebook Authentication",
  "supabaseConfigured": true,
  "mode": "production"
}
```

## 🐛 Current Issue Analysis

Based on your logs, the error is:
```
500 error from /api/auth/facebook
Response: {error: "Authentication failed", details: "[object Object]"}
```

This means the server is throwing an error when trying to save to the database.

### Most Likely Causes:

1. **Database tables don't exist**
   - Run `supabase-schema.sql` in Supabase

2. **Row Level Security (RLS) blocking inserts**
   - The schema includes RLS policies
   - May need to temporarily disable or adjust

3. **Incorrect Supabase URL/Key**
   - Double-check `.env.local`

## 🔧 Step-by-Step Fix

### Step 1: Verify Supabase Setup

1. Go to your Supabase project: https://supabase.com/dashboard/project/_
2. Go to **SQL Editor** (left sidebar)
3. Copy contents of `supabase-schema.sql`
4. Paste and click **Run**
5. You should see: "Success. No rows returned"

### Step 2: Check if Tables Exist

In Supabase SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected tables:**
- facebook_pages
- message_activity
- messages
- messenger_conversations
- team_members
- users

### Step 3: Test Database Connection

Visit:
```
http://localhost:3000/api/test-supabase
```

Check the response - it will tell you exactly what's wrong.

### Step 4: Temporarily Disable RLS (Testing Only)

If RLS is blocking, temporarily disable it:

```sql
-- In Supabase SQL Editor
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_pages DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_activity DISABLE ROW LEVEL SECURITY;
```

**⚠️ Remember to re-enable RLS before production!**

### Step 5: Check Server Terminal Logs

Your Next.js dev server terminal should show:
```
[Facebook Auth] Starting authentication for user: ...
[Facebook Auth] Database query error: <error details here>
```

The error details will tell you exactly what's wrong.

### Step 6: Try Login Again

1. Make sure you're using ngrok URL (not localhost)
2. Open browser console (F12)
3. Click "Continue with Facebook"
4. Watch both browser console AND server terminal
5. Look for the specific error message

## 🎯 Quick Tests You Can Run Now

### Test Database Connection:
```bash
# In your terminal
curl http://localhost:3000/api/test-supabase
```

### Test Auth Endpoint:
```bash
curl http://localhost:3000/api/auth/facebook
```

### Check Environment Variables:
```bash
# In your terminal (from nextjs-app directory)
cat .env.local
```

## 💡 Development Mode (No Supabase Needed)

If you want to test the UI without setting up Supabase:

1. Remove or rename `.env.local`
2. Restart the dev server
3. Try logging in

The app will work in "development mode" - user data stored in cookies instead of database.

## 🔍 What to Look For

### In Browser Console:
```javascript
✅ [Login] Starting Facebook login...
✅ [Login] Got auth response
✅ [Login] Calling /api/auth/facebook...
❌ [Login] Auth API response: {error: "...", details: "..."}
     ↑ This tells you the exact error!
```

### In Server Terminal:
```javascript
❌ [Facebook Auth] Database query error: relation "users" does not exist
     ↑ This is the root cause!
```

## 📊 Next Steps

1. **Run the diagnostic tests above**
2. **Check terminal logs** for the actual error
3. **Fix based on error message:**
   - "users does not exist" → Run SQL schema
   - "Connection refused" → Check Supabase URL
   - "Permission denied" → Check RLS policies

## 🆘 Still Stuck?

Share the output of:
1. `http://localhost:3000/api/test-supabase`
2. Server terminal logs when you click login
3. Browser console error details

This will pinpoint the exact issue!

---

**Server Status:** ✅ Running on http://localhost:3000  
**Next Step:** Visit `/api/test-supabase` to diagnose the issue

