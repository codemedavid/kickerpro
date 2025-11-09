# 🔐 Facebook Long-Lived Tokens - Complete Setup Guide

## 🎯 Goal

Get **60-day long-lived tokens** that auto-refresh so you never have to manually reconnect Facebook pages.

---

## ✅ What You Already Have

Good news! Your system **already has**:
- ✅ Automatic token refresh cron job (runs daily)
- ✅ Token exchange endpoint
- ✅ Token validation logic

**But it needs proper configuration!**

---

## 🔧 Step 1: Add Missing Environment Variables

Add these to your **Vercel Environment Variables**:

1. Go to: https://vercel.com/your-project/settings/environment-variables

2. Add these variables:

```bash
# Facebook App Credentials (CRITICAL!)
NEXT_PUBLIC_FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
```

### Where to Find These:

1. **Go to:** https://developers.facebook.com/apps
2. **Select your app**
3. **Settings → Basic:**
   - **App ID** → Copy to `NEXT_PUBLIC_FACEBOOK_APP_ID`
   - **App Secret** → Click "Show" → Copy to `FACEBOOK_APP_SECRET`

---

## 🚀 Step 2: Reconnect Your Page (One Time)

After adding the environment variables:

1. **Redeploy** your Vercel app (to load new env vars)
   ```bash
   git commit --allow-empty -m "Trigger redeploy for env vars"
   git push
   ```

2. **Go to your dashboard**

3. **Navigate to Pages section**

4. **Disconnect your page** (if connected)

5. **Reconnect your page:**
   - Click "Connect Facebook Page"
   - Authorize permissions
   - **✅ System will automatically exchange for long-lived token!**

---

## 📊 How It Works

### **When You Connect a Page:**

```
1. Facebook gives short-lived token (1 hour)
2. Your app exchanges it for long-lived token (60 days)
3. Saves long-lived token to database
4. ✅ Works for 60 days!
```

### **Automatic Refresh (Daily Cron):**

```
Every 24 hours:
1. Cron checks all page tokens
2. If token expires in < 7 days → Refresh it
3. Saves new 60-day token
4. ✅ Never expires!
```

---

## 🧪 Step 3: Test The Setup

### **A. Test Token Exchange Manually**

After reconnecting your page, check the logs:

```
Expected in Vercel logs:
[Token Exchange] Exchanging short-lived token...
[Token Exchange] ✅ Got long-lived token (expires in 60 days)
[Token Exchange] ✅ Got page token
```

### **B. Check Token Expiration**

Run this in Supabase SQL:

```sql
SELECT 
  name,
  facebook_page_id,
  updated_at,
  CASE 
    WHEN access_token IS NULL THEN 'MISSING TOKEN'
    WHEN LENGTH(access_token) < 50 THEN 'INVALID TOKEN'
    ELSE 'TOKEN EXISTS'
  END as token_status
FROM facebook_pages;
```

### **C. Test Token Validity**

Use this API endpoint:

```bash
curl "https://your-domain.vercel.app/api/facebook/exchange-token?token=YOUR_PAGE_TOKEN"
```

Should return:
```json
{
  "isValid": true,
  "expiresAt": "2025-01-08T...",
  "daysUntilExpiry": 60,
  "tokenType": "PAGE"
}
```

---

## 🔄 How Auto-Refresh Works

### **Cron Schedule:**

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/refresh-facebook-tokens",
    "schedule": "0 0 * * *"  // Daily at midnight UTC
  }]
}
```

### **What It Does:**

```
Daily at midnight:
1. Gets all pages from database
2. For each page:
   - Checks token expiration
   - If < 7 days remaining:
     → Exchanges for new token
     → Updates database
   - If > 7 days:
     → Skips (no need to refresh)
3. Logs results
```

### **Check Auto-Refresh Logs:**

Search Vercel logs for:
```
[Token Refresh Cron]
```

---

## 🛠️ Manual Token Refresh (If Needed)

If tokens expire before auto-refresh:

### **Option 1: Trigger Cron Manually**

Visit this URL in your browser:
```
https://your-domain.vercel.app/api/cron/refresh-facebook-tokens
```

### **Option 2: Reconnect Page**

Dashboard → Pages → Reconnect

---

## 📋 Verification Checklist

Run through this checklist:

```
✅ NEXT_PUBLIC_FACEBOOK_APP_ID set in Vercel
✅ FACEBOOK_APP_SECRET set in Vercel
✅ App redeployed after adding env vars
✅ Page reconnected in dashboard
✅ Token saved to database
✅ Cron job configured in vercel.json
✅ Test automation sends successfully
```

---

## 🔍 Troubleshooting

### **Issue 1: Token Still Expires**

**Check env vars:**
```bash
# In Vercel, check if these exist:
NEXT_PUBLIC_FACEBOOK_APP_ID
FACEBOOK_APP_SECRET
```

**If missing:**
1. Add them to Vercel env vars
2. Redeploy app
3. Reconnect page

### **Issue 2: Cron Not Running**

**Check logs:**
```
Search Vercel logs for: "[Token Refresh Cron]"
```

**If no logs:**
- Verify `vercel.json` has the cron configured
- Cron jobs only work on **production** (not preview)

### **Issue 3: "Invalid App Secret"**

**Verify credentials:**
1. Go to Facebook Developers
2. Settings → Basic
3. Copy **exact** App ID and Secret
4. No extra spaces or characters

### **Issue 4: Still Getting OAuth Errors**

**Clear failed executions:**
```sql
DELETE FROM ai_automation_executions WHERE status = 'failed';
```

**Then reconnect page** and wait 5 minutes.

---

## 🎯 Quick Setup (TL;DR)

```bash
# 1. Add to Vercel env vars:
NEXT_PUBLIC_FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret

# 2. Redeploy
git commit --allow-empty -m "Add FB credentials"
git push

# 3. Reconnect page in dashboard

# 4. Done! Tokens will auto-refresh every 60 days
```

---

## 📊 Token Lifespan Summary

| Token Type | Lifespan | How to Get |
|------------|----------|------------|
| **Short-lived User** | 1 hour | Facebook Login |
| **Long-lived User** | 60 days | Token exchange ✅ |
| **Page Token** | Never expires* | From long-lived user token ✅ |

*Page tokens don't expire as long as the user token is valid

---

## 🎊 Expected Results

After setup:

```
✅ Tokens last 60 days
✅ Auto-refresh before expiration
✅ No manual reconnection needed
✅ Automations work 24/7
✅ No more OAuth errors!
```

---

## 📝 Files Created/Updated

Your repo now has:

1. ✅ `src/app/api/facebook/exchange-token/route.ts` - Token exchange API
2. ✅ `src/lib/facebook/token-refresh.ts` - Token utilities
3. ✅ `src/app/api/cron/refresh-tokens/route.ts` - Alternative cron
4. ✅ `src/app/api/cron/refresh-facebook-tokens/route.ts` - Existing cron (use this!)
5. ✅ `vercel.json` - Cron configured

---

## 🆘 Still Having Issues?

1. **Check Vercel env vars** are set correctly
2. **Redeploy** after adding env vars
3. **Reconnect page** in dashboard
4. **Wait 5 minutes** for next automation cycle
5. **Check logs** for "[Token Refresh Cron]"

---

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ No OAuth errors in logs
2. ✅ Automations send successfully  
3. ✅ Token refresh logs show daily
4. ✅ System runs for weeks without intervention

**Your automation system will now work indefinitely!** 🚀

