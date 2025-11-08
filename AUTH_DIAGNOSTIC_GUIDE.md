# 🔍 Authentication Diagnostic Guide

## Understanding Your 401 Errors

The 401 errors you're seeing could be **normal** or could indicate a problem. Here's how to tell:

## ✅ NORMAL 401 Errors (Expected)

These happen when:
1. **You're on the login page** (not logged in yet)
2. **Your session expired** (need to login again)
3. **You just logged out**

In these cases, the frontend tries to check auth status, gets 401, and shows the login button. **This is correct behavior!**

## ❌ PROBLEM 401 Errors (Need fixing)

These happen when:
1. **You just logged in but immediately get 401** (cookies not being set)
2. **You're logged in, on /dashboard, but get kicked to /login** (cookies not persisting)
3. **Page keeps refreshing after login** (cookie loop)

---

## 🧪 How to Diagnose

### Step 1: Check Authentication Status

Open your deployed app and visit this URL in your browser:
```
https://your-app.vercel.app/api/auth/check
```

You'll see JSON output like:
```json
{
  "authenticated": false,
  "cookies": {
    "fb-user-id": {
      "present": false,
      "message": "Cookie not found - user not logged in"
    }
  },
  "diagnosis": "⚠️ User is NOT authenticated"
}
```

### Step 2: Login and Check Again

1. **Login to your app** (Continue with Facebook)
2. **After successful login**, visit the check URL again:
   ```
   https://your-app.vercel.app/api/auth/check
   ```
3. **You should now see:**
   ```json
   {
     "authenticated": true,
     "cookies": {
       "fb-user-id": {
         "value": "some-uuid-here",
         "present": true
       },
       "fb-auth-user": {
         "value": "some-uuid-here",
         "present": true
       }
     },
     "diagnosis": "✅ User is authenticated - cookies present"
   }
   ```

### Step 3: Interpret Results

**If you see `authenticated: true` after login:**
✅ Cookies are working correctly!
✅ The 401 errors you saw were just from unauthenticated requests (normal)
✅ Your app is working as expected

**If you see `authenticated: false` after login:**
❌ Problem! Cookies are not being set or not persisting
❌ This needs to be fixed

---

## 🛠️ Common Issues & Fixes

### Issue 1: Cookies Not Set After Login

**Symptoms:**
- Login completes successfully
- Redirected to /dashboard
- Immediately get 401 errors
- Kicked back to /login

**Check:**
```
https://your-app.vercel.app/api/auth/check
```
Should show `authenticated: true` but shows `false`

**Causes:**
1. Cookie domain mismatch
2. Secure flag issue (HTTP vs HTTPS)
3. SameSite policy blocking cookies

**Fix:**
Check browser DevTools → Application → Cookies to see if cookies are being set at all.

---

### Issue 2: Cookies Not Sent with Requests

**Symptoms:**
- Login works
- Cookies appear in browser
- But API requests still get 401

**Check:**
1. Open DevTools → Network tab
2. Click on an API request (e.g., `/api/messages`)
3. Look at Request Headers
4. Check if `Cookie:` header includes `fb-user-id` and `fb-auth-user`

**If cookies missing from requests:**
- Check if your frontend and backend are on same domain
- Check CORS settings
- Check cookie SameSite policy

---

### Issue 3: Session Expires Too Quickly

**Symptoms:**
- Login works initially
- After 1-2 hours, suddenly logged out
- Need to login again

**This is actually the Facebook access token expiring**, not the session cookies.

**Check:**
- Cookies are set for 30 days
- But Facebook token might expire sooner
- Need to implement token refresh

---

## 📊 Quick Test Checklist

Run through this checklist:

- [ ] Visit `/api/auth/check` before login
  - Should show: `authenticated: false`
- [ ] Login with Facebook
  - Should redirect to `/dashboard`
- [ ] Visit `/api/auth/check` after login
  - Should show: `authenticated: true`
- [ ] Refresh the page
  - Should stay on `/dashboard` (not kicked to `/login`)
- [ ] Visit `/api/auth/me`
  - Should return your user data (not 401)
- [ ] Visit `/api/messages`
  - Should return your messages (not 401)

If all checkmarks pass: ✅ **Your auth is working perfectly!**

If any fail: ❌ **Use the diagnostic info to identify the specific issue**

---

## 🔧 What's Been Fixed

1. ✅ **Scheduled Messages Cron** - Uses service role key (bypasses RLS)
2. ✅ **AI Automations Cron** - Works without CRON_SECRET
3. ✅ **Logout** - Clears all auth cookies properly
4. ✅ **Diagnostic Endpoint** - `/api/auth/check` to debug auth issues

---

## 📝 Next Steps

1. **Deploy these changes** (should be auto-deploying from Git)
2. **Remove CRON_SECRET from Vercel** (for cron jobs to work)
3. **Test authentication flow** using the checklist above
4. **Share results** if you're still seeing issues

---

## 💡 Understanding the Logs

Your logs show:
```
GET /api/auth/me → 401
GET /api/messages → 401
```

This is **NORMAL** if:
- You're on `/login` page (not authenticated yet)
- Your session expired
- You're visiting the site for the first time

This is **A PROBLEM** if:
- You just logged in successfully
- You're on `/dashboard` but getting these errors
- Cookies should be present but aren't

Use `/api/auth/check` to determine which scenario applies to you! 🎯

