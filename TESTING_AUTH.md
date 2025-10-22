# 🧪 Testing Facebook Authentication

## Overview

I've completely rebuilt the authentication system to be more robust and debuggable. Here's how to test it:

## ✅ What I Fixed

1. **Cookie-Based Authentication**
   - Switched from Supabase Auth to simple cookie-based sessions
   - Easier to debug and more reliable
   - Works with Facebook login

2. **Better Error Handling**
   - Detailed console logging at every step
   - Clear error messages
   - Step-by-step debugging info

3. **Improved API Routes**
   - `/api/auth/facebook` - Handle Facebook login
   - `/api/auth/me` - Check current user
   - `/api/auth/logout` - Sign out
   - All with detailed logging

4. **Updated Middleware**
   - Simple cookie-based auth check
   - Proper redirects
   - No Supabase dependency

## 🧪 Testing Steps

### Step 1: Set Up Supabase (Required)

```bash
# 1. Go to supabase.com and create a project
# 2. Go to SQL Editor
# 3. Run the schema from supabase-schema.sql
# 4. Get your credentials from Project Settings > API
```

### Step 2: Configure Environment

Create `.env.local`:
```env
# Supabase (Required for database)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Facebook (Required for login)
NEXT_PUBLIC_FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
NEXT_PUBLIC_FACEBOOK_APP_VERSION=v18.0

# App URL
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io
```

### Step 3: Set Up HTTPS (Required)

Facebook requires HTTPS. Use ngrok:

```bash
# Terminal 1: Run your app
npm run dev

# Terminal 2: Create HTTPS tunnel
npx ngrok http 3000

# You'll get: https://abc123.ngrok.io
```

### Step 4: Configure Facebook App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Your App → Settings → Basic
3. Copy your **App ID** to `.env.local`
4. Copy your **App Secret** to `.env.local`
5. Go to Facebook Login → Settings
6. Add OAuth Redirect URI: `https://abc123.ngrok.io/api/auth/callback`
7. Save changes

### Step 5: Test Authentication

1. **Visit ngrok URL** (not localhost!)
   ```
   https://abc123.ngrok.io
   ```

2. **Open Browser Console** (F12 → Console tab)
   - You'll see detailed logs for each step
   - Watch for errors in red

3. **Click "Continue with Facebook"**
   - Grant permissions
   - Wait for redirect

4. **Check Console Logs**

You should see:
```
[Login] Starting Facebook login...
[Login] Facebook login response: {...}
[Login] Got auth response for user: 123456789
[Login] Got user info from Facebook: {...}
[Login] Calling /api/auth/facebook...
[Login] Auth API response: {success: true, userId: "..."}
[Login] Authentication successful, redirecting...
```

5. **Server Logs** (in your terminal)

You should see:
```
[Facebook Auth] Starting authentication for user: 123456789
[Facebook Auth] Checking if user exists...
[Facebook Auth] Creating new user... (or User exists, updating info...)
[Facebook Auth] User created successfully: uuid-here
[Facebook Auth] Session created for user: uuid-here
```

## 🐛 Debugging Guide

### Issue: "Authentication failed"

**Check Console Logs:**
```javascript
// Look for:
[Login] Auth API response: {error: "...", details: "..."}
```

**Common Causes:**
1. **Supabase not configured**
   - Error: "Connection refused" or "Invalid credentials"
   - Fix: Check `.env.local` has correct Supabase URL and key

2. **Database table doesn't exist**
   - Error: "relation \"users\" does not exist"
   - Fix: Run `supabase-schema.sql` in Supabase SQL Editor

3. **Facebook permissions denied**
   - Error: User cancelled login
   - Fix: Accept all requested permissions

### Issue: "Access token override warning"

This is **just a warning**, not an error. It's from Facebook SDK and can be ignored.

To fix (optional):
- Use Facebook's recommended approach of passing token directly to API calls
- Or ignore it - it doesn't affect functionality

### Issue: Gets stuck after login

**Check:**
1. Look for JavaScript errors in console
2. Check if redirect happens: `[Login] Authentication successful, redirecting...`
3. Verify cookie was set: Application tab → Cookies → `fb-auth-user`

**Fix:**
- Clear cookies and try again
- Check middleware isn't blocking: Look for `[Middleware] Redirecting...` logs

### Issue: Can't access dashboard

**Check:**
1. Open `/api/auth/me` in browser
   - Should show: `{"user": {...}, "authenticated": true}`
   - If shows `{"user": null}`: Cookie not set or expired

2. Check middleware logs in terminal

**Fix:**
- Login again to create new session
- Check cookie expiration (7 days by default)

## 🔍 Manual Testing Endpoints

### Test if API is working:
```bash
# Should return: {"status": "ok", ...}
curl https://your-ngrok-url.ngrok.io/api/auth/facebook
```

### Test current auth status:
```bash
# Should return user info if logged in
curl https://your-ngrok-url.ngrok.io/api/auth/me \
  -H "Cookie: fb-auth-user=your-user-id"
```

### Test logout:
```bash
curl -X POST https://your-ngrok-url.ngrok.io/api/auth/logout
```

## 📊 Expected Flow

```
1. User clicks "Continue with Facebook"
   ↓
2. Facebook SDK opens login popup
   ↓
3. User grants permissions
   ↓
4. Facebook returns accessToken + userID
   ↓
5. App calls /api/auth/facebook with user data
   ↓
6. API checks/creates user in Supabase database
   ↓
7. API sets cookie: fb-auth-user=userId
   ↓
8. Browser redirects to /dashboard
   ↓
9. Middleware checks cookie → allows access
   ↓
10. Dashboard loads user data from /api/auth/me
```

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Console shows all green logs
2. ✅ No errors in console or terminal
3. ✅ Cookie `fb-auth-user` is set (check Application tab)
4. ✅ `/api/auth/me` returns your user data
5. ✅ Dashboard loads with your name in sidebar
6. ✅ Can navigate between pages
7. ✅ Logout works and redirects to login

## 🔧 Quick Fixes

### Reset Everything:
```bash
# Clear cookies in browser (Application tab → Storage → Clear site data)
# Delete user from Supabase
# Try logging in again
```

### Check Supabase Connection:
```javascript
// In browser console:
fetch('/api/auth/me')
  .then(r => r.json())
  .then(console.log)
```

### Verify Environment Variables:
```bash
# In terminal:
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_FACEBOOK_APP_ID
```

## 🎯 Common Patterns

### Successful Login Logs:
```
✅ [Login] Starting Facebook login...
✅ [Login] Got auth response for user: 123456789
✅ [Login] Got user info from Facebook
✅ [Login] Auth API response: {success: true}
✅ [Facebook Auth] User created successfully
```

### Failed Login Logs:
```
❌ [Login] Authentication failed: Missing required Facebook data
❌ [Facebook Auth] Insert error: duplicate key value
❌ Error: relation "users" does not exist
```

## 📞 Still Having Issues?

1. **Check all console logs** - they tell you exactly what's happening
2. **Verify Supabase schema** - run the SQL file
3. **Check Facebook App settings** - OAuth redirect must match ngrok URL
4. **Try incognito mode** - rules out cookie/cache issues
5. **Review `.env.local`** - all variables must be set correctly

## 🎉 Next Steps After Authentication Works

Once you can login successfully:

1. ✅ Connect Facebook pages (`/dashboard/pages`)
2. ✅ Create messages (`/dashboard/compose`)
3. ✅ View analytics
4. ✅ Invite team members
5. ✅ Deploy to Vercel for production

---

**Pro Tip:** Keep the browser console open during testing. The detailed logs will show you exactly where any issues occur!

