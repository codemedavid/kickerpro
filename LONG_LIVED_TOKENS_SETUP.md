# 🔐 Facebook 60-Day Long-Lived Tokens - Complete Setup

## ✅ What I Just Fixed

Your tokens were expiring after a few hours because they weren't being exchanged for long-lived tokens. **I've now fixed this!**

### Changes Made:

1. **✅ Modified `/api/pages` endpoint** - Now automatically exchanges tokens when connecting pages
2. **✅ Token Exchange Function** - Converts short-lived (1 hour) → long-lived (60 days)
3. **✅ Automatic Refresh Cron** - Already configured to run daily in `vercel.json`

---

## 🚀 Setup Instructions

### Step 1: Add Environment Variables

You **MUST** add these to your Vercel project:

1. Go to: https://vercel.com/your-project/settings/environment-variables

2. Add these **two critical variables**:

```bash
NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

### How to Get These Values:

1. Go to: https://developers.facebook.com/apps
2. Select your Facebook App
3. Go to **Settings → Basic**
4. Copy:
   - **App ID** → `NEXT_PUBLIC_FACEBOOK_APP_ID`
   - **App Secret** (click "Show") → `FACEBOOK_APP_SECRET`

---

### Step 2: Deploy to Vercel

After adding the environment variables:

```bash
# Commit your changes
git add .
git commit -m "Add 60-day token exchange"
git push

# Vercel will auto-deploy
```

Or manually trigger a redeploy in Vercel dashboard.

---

### Step 3: Reconnect Your Facebook Pages

**IMPORTANT:** You need to reconnect your pages ONE TIME for the fix to take effect.

1. **Go to your app** → Dashboard → Facebook Pages
2. **Disconnect your page** (if connected)
3. **Click "Connect Page" again**
4. **Select your page(s)** and connect

**Behind the scenes:**
```
Facebook gives: Short-lived token (1 hour)
       ↓
Your app exchanges: Long-lived token (60 days)
       ↓
Saved to database: 60-day token ✅
```

---

## 🔄 How Automatic Refresh Works

### Daily Token Refresh Cron Job

Your `vercel.json` already has this configured:

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-facebook-tokens",
      "schedule": "0 0 * * *"  // Daily at midnight UTC
    }
  ]
}
```

### What It Does:

```
Every 24 hours:
1. Checks all Facebook pages in database
2. Tests if token is still valid
3. If token expires in < 7 days:
   → Exchanges for new 60-day token
   → Updates database
4. If token has > 7 days left:
   → Skips (no action needed)
```

**Result:** Your tokens will **NEVER expire** because they're refreshed before expiration! 🎉

---

## 🧪 Testing

### Test 1: Check Token Exchange Logs

After reconnecting a page, check Vercel logs for:

```
[Pages API] 🔄 Exchanging token for page: Your Page Name...
[Token Exchange] ✅ Got long-lived user token (60 days)
[Token Exchange] ✅ Got long-lived page token for 123456789 (never expires)
[Pages API] ✅ Token exchanged for: Your Page Name
[Pages API] ✅ Inserted page with 60-day token: Your Page Name
```

### Test 2: Verify Token in Database

Run this in Supabase SQL Editor:

```sql
SELECT 
  name,
  facebook_page_id,
  created_at,
  updated_at,
  CASE 
    WHEN access_token IS NULL THEN '❌ MISSING'
    WHEN LENGTH(access_token) < 100 THEN '⚠️ SHORT (probably expired)'
    WHEN LENGTH(access_token) > 200 THEN '✅ LONG-LIVED TOKEN'
    ELSE '⚠️ UNCERTAIN'
  END as token_status
FROM facebook_pages
ORDER BY updated_at DESC;
```

**Expected:** Token status should show `✅ LONG-LIVED TOKEN`

### Test 3: Manually Trigger Cron

Visit this URL in your browser (or curl):

```
https://your-app.vercel.app/api/cron/refresh-facebook-tokens
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Token refresh check completed",
  "pages_checked": 1,
  "refreshed": 0,
  "skipped": 1,
  "results": [
    {
      "page_id": "123456789",
      "page_name": "Your Page",
      "status": "skipped",
      "reason": "Token valid for 60 more days"
    }
  ]
}
```

### Test 4: Send a Test Message

After reconnecting:

1. Go to **Compose** or **AI Automations**
2. Select your Facebook page
3. Try sending a message
4. Should work without any OAuth errors! ✅

---

## 📊 Token Lifespan Comparison

| Before Fix | After Fix |
|-----------|----------|
| Short-lived token (1 hour) ❌ | Long-lived token (60 days) ✅ |
| Expires constantly | Auto-refreshes before expiration |
| OAuth errors every hour | No OAuth errors |
| Manual reconnection needed | Zero maintenance |

---

## 🔍 Troubleshooting

### Issue 1: "Missing Facebook app credentials"

**Problem:** Environment variables not set

**Solution:**
1. Add `NEXT_PUBLIC_FACEBOOK_APP_ID` to Vercel
2. Add `FACEBOOK_APP_SECRET` to Vercel
3. Redeploy app
4. Reconnect page

### Issue 2: Token Still Expires After a Few Hours

**Check:**
1. Are environment variables set in Vercel? ✓
2. Did you redeploy after adding env vars? ✓
3. Did you reconnect the page (not just refresh)? ✓

**If still failing:**
- Check Vercel logs for token exchange errors
- Verify App ID and Secret are correct (no extra spaces)

### Issue 3: Cron Job Not Running

**Remember:**
- Cron jobs only work in **Production** (not preview deployments)
- Check logs: Search for `[Token Refresh Cron]`
- Manually trigger: Visit `/api/cron/refresh-facebook-tokens`

### Issue 4: "Invalid OAuth Token" Errors

**This means token is expired. Fix:**
1. Reconnect your page in the dashboard
2. Wait 1-2 minutes
3. Try automation again
4. Should work! ✅

---

## 📋 Quick Setup Checklist

```
✅ 1. Add NEXT_PUBLIC_FACEBOOK_APP_ID to Vercel env vars
✅ 2. Add FACEBOOK_APP_SECRET to Vercel env vars
✅ 3. Deploy code changes to Vercel
✅ 4. Disconnect Facebook page (if connected)
✅ 5. Reconnect Facebook page
✅ 6. Check logs for successful token exchange
✅ 7. Test sending a message
✅ 8. Done! Tokens will auto-refresh forever 🎉
```

---

## 🎊 Expected Results

After completing setup:

```
✅ Tokens last 60 days (vs 1 hour before)
✅ Tokens auto-refresh daily before expiration
✅ No more OAuth errors
✅ No manual intervention needed
✅ Automations work 24/7 indefinitely
✅ Production-ready! 🚀
```

---

## 📝 Technical Details

### Token Exchange Flow:

```
1. User connects Facebook page
   ↓
2. Facebook returns short-lived page token (1 hour)
   ↓
3. Your app calls exchangeForLongLivedToken()
   ↓
4. Step 1: Exchange for long-lived USER token (60 days)
   - API: /oauth/access_token?grant_type=fb_exchange_token
   ↓
5. Step 2: Get long-lived PAGE token (never expires*)
   - API: /{page_id}?fields=access_token
   ↓
6. Save long-lived page token to database
   ↓
7. Cron job refreshes it before 60 days
   ↓
8. Token effectively never expires! ✅
```

*Page tokens don't expire as long as the user token is valid

### Files Modified:

1. **`src/app/api/pages/route.ts`** - Added token exchange function
2. **`vercel.json`** - Already has cron configured ✅
3. **`src/app/api/cron/refresh-facebook-tokens/route.ts`** - Already exists ✅

---

## 🆘 Need Help?

If you're still having issues:

1. **Check Vercel logs** - Look for `[Token Exchange]` and `[Token Refresh Cron]`
2. **Verify environment variables** - They must be set in Vercel
3. **Make sure you reconnected** - Old connections still use short-lived tokens
4. **Check Facebook App Settings** - App must be in Live mode (not Development)

---

## 🎉 Success!

Once setup is complete, you'll never need to reconnect Facebook pages again. The system will:

- ✅ Use 60-day tokens
- ✅ Auto-refresh before expiration
- ✅ Work indefinitely
- ✅ Require zero maintenance

**Your messaging system is now production-ready!** 🚀


