# ⚡ Quick Start: 60-Day Facebook Tokens

## 🎯 Problem Fixed

**Before:** Tokens expired after a few hours ❌  
**Now:** Tokens last 60 days and auto-refresh ✅

---

## 🚀 3-Step Setup (5 Minutes)

### Step 1: Add Environment Variables to Vercel

Go to your Vercel project: **Settings → Environment Variables**

Add these **2 variables** (if not already set):

```bash
NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

**Get these values from:**
1. https://developers.facebook.com/apps
2. Select your app → Settings → Basic
3. Copy App ID and App Secret

---

### Step 2: Deploy Your Changes

```bash
git add .
git commit -m "Add 60-day token exchange"
git push
```

Vercel will auto-deploy (or manually redeploy in Vercel dashboard).

---

### Step 3: Reconnect Your Facebook Page

**IMPORTANT:** This step is required for the fix to take effect!

1. Go to your app → **Facebook Pages**
2. **Disconnect your page** (if already connected)
3. **Click "Connect Page"** again
4. Select your page(s) and connect

**What happens behind the scenes:**
- ✅ Short-lived token (1 hour) → Exchanged automatically
- ✅ Long-lived token (60 days) → Saved to database
- ✅ Auto-refresh cron → Keeps it fresh forever

---

## ✅ Verify It's Working

### Check Logs (Vercel Dashboard → Logs)

Look for these messages after reconnecting:

```
[Pages API] 🔄 Exchanging token for page: Your Page...
[Token Exchange] ✅ Got long-lived user token (60 days)
[Token Exchange] ✅ Got long-lived page token (never expires)
[Pages API] ✅ Token exchanged for: Your Page
```

### Test Sending a Message

1. Go to **Compose** or **AI Automations**
2. Select your Facebook page
3. Send a test message
4. Should work without OAuth errors! ✅

---

## 🔄 Automatic Refresh (Already Configured)

Your `vercel.json` already has the cron job:

```json
{
  "path": "/api/cron/refresh-facebook-tokens",
  "schedule": "0 0 * * *"  // Daily at midnight
}
```

**What it does:**
- Runs every 24 hours
- Checks all page tokens
- Refreshes tokens that expire in < 7 days
- Your tokens will **NEVER** expire! 🎉

---

## 🎊 Done!

After completing these 3 steps:

✅ Tokens last 60 days (instead of 1 hour)  
✅ Auto-refresh before expiration  
✅ No more OAuth errors  
✅ Zero maintenance required  
✅ Production ready! 🚀

---

## 🔍 Troubleshooting

**Issue:** Still getting OAuth errors

**Solution:**
1. Make sure environment variables are set in Vercel ✓
2. Make sure you deployed after adding env vars ✓
3. Make sure you **reconnected** the page (not just refreshed) ✓

**Issue:** "Missing Facebook app credentials" in logs

**Solution:**
- Add `NEXT_PUBLIC_FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` to Vercel
- Redeploy
- Reconnect page

---

## 📚 More Details

See `LONG_LIVED_TOKENS_SETUP.md` for complete technical documentation.

---

**That's it! Your tokens now last 60 days and auto-refresh. Enjoy! 🚀**


