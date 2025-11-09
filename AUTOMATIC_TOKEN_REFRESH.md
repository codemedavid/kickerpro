# 🤖 Automatic Facebook Token Refresh

## ✅ **Zero-Click Token Management**

Your Facebook tokens will now **automatically refresh** before they expire - no manual intervention needed!

---

## 🎯 **How It Works**

### **Daily Automatic Check**

A cron job runs **every day at midnight** to:

1. ✅ Check all Facebook page tokens
2. ✅ Test if tokens are still valid
3. ✅ Refresh tokens that expire in < 7 days
4. ✅ Update database with new 60-day tokens
5. ✅ Log everything for monitoring

**You literally do nothing!** ☕

---

## 🔧 **One-Time Setup Required**

### **Step 1: Add Environment Variables**

Add these to your **Vercel Environment Variables**:

```env
NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

**Where to find these:**

1. Go to: https://developers.facebook.com/apps/
2. Select your app
3. Go to **Settings → Basic**
4. Copy **App ID** and **App Secret**

---

### **Step 2: Reconnect Your Facebook Page Once**

Just this **ONE TIME**, reconnect your "Azshinari" page:

1. Go to `/dashboard/facebook-pages`
2. Connect the page
3. Grant all permissions

**That's it!** The system will handle everything from now on.

---

## 📊 **What Happens Automatically**

### **Every Day at Midnight:**

```
[Token Refresh Cron] 🔄 Starting automatic token refresh check
[Token Refresh Cron] Found 1 page(s) to check

Checking: Azshinari
🔍 Testing current token...
✅ Current token is valid
Token expires in 45 days
⏭️  Skipped - token still has 45 days
```

### **When Token Has < 7 Days:**

```
Checking: Azshinari
⚠️  Token expires in 5 days
🔄 Attempting token refresh...
✅ Got new token (valid for 60 days)
✅ Token updated in database
```

### **If Token Already Expired:**

```
Checking: Azshinari
⚠️  Current token invalid
🔄 Attempting token refresh...
✅ Got new token (valid for 60 days)
✅ Token updated in database
```

---

## ⏱️ **Schedule**

| Cron Job | Frequency | Purpose |
|----------|-----------|---------|
| `/api/cron/send-scheduled` | Every 1 minute | Send broadcast messages |
| `/api/cron/ai-automations` | Every 1 minute | AI automation processing |
| `/api/cron/refresh-facebook-tokens` | **Every day at midnight** | **Auto-refresh tokens** |

---

## 🔍 **How to Monitor**

### **Check Vercel Logs**

Go to **Vercel → Functions → `/api/cron/refresh-facebook-tokens`**

You'll see daily logs like:

```
✅ Refresh check completed
  Pages Checked: 1
  Refreshed: 1
  Skipped: 0
  Failed: 0
```

### **Check Database**

Run in Supabase:

```sql
SELECT 
  name,
  facebook_page_id,
  updated_at,
  LENGTH(access_token) as token_length
FROM facebook_pages
ORDER BY updated_at DESC;
```

If `updated_at` is recent, token was refreshed!

---

## 🚨 **When Manual Action Is Needed**

### **Only 2 Scenarios Require Manual Reconnection:**

1. **Every 60 days** - Facebook security requirement (you'll get notified)
2. **If you change Facebook app permissions**

**That's it!** Otherwise, completely automatic.

---

## 💡 **How It Keeps Tokens Fresh**

### **Token Lifecycle:**

```
Day 1:  Connect page → Get 60-day token
Day 53: Auto-refresh → Get NEW 60-day token (7 days before expiry)
Day 113: Auto-refresh → Get NEW 60-day token
Day 173: Auto-refresh → Get NEW 60-day token
...forever!
```

**Tokens never expire** because they refresh 7 days before expiry! 🎉

---

## 🔧 **Advanced Features**

### **Manual Token Refresh API** (if needed)

```bash
curl -X POST https://your-domain.com/api/facebook/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "pageId": "656646850875530",
    "shortLivedToken": "YOUR_TOKEN"
  }'
```

### **Force Refresh from Browser Console**

```javascript
await fetch('/api/cron/refresh-facebook-tokens');
```

---

## 📋 **Setup Checklist**

- [ ] Add `NEXT_PUBLIC_FACEBOOK_APP_ID` to Vercel env vars
- [ ] Add `FACEBOOK_APP_SECRET` to Vercel env vars
- [ ] Reconnect Facebook page ONE time
- [ ] Deploy to Vercel
- [ ] Wait for next midnight (or manually trigger)
- [ ] Check logs to verify it worked
- [ ] ✅ Done! Set it and forget it!

---

## 🎉 **Benefits**

**Before:**
- ❌ Token expires every few days/weeks
- ❌ AI automation stops working
- ❌ Manual reconnection needed
- ❌ Messages fail
- ❌ Constant maintenance

**After:**
- ✅ Tokens automatically refresh
- ✅ AI automation always works
- ✅ Zero maintenance (except every 60 days)
- ✅ Messages always send
- ✅ Peace of mind!

---

## 📊 **System Status**

Once set up, your system is:

| Component | Maintenance |
|-----------|-------------|
| AI Automation | ✅ Fully automatic |
| Tag Filtering | ✅ Fully automatic |
| Message Sending | ✅ Fully automatic |
| Token Refresh | ✅ **Fully automatic** |
| Manual Work | ⚠️ Reconnect every 60 days |

---

## 🚀 **Next Steps**

1. **Add the 2 environment variables** to Vercel
2. **Reconnect your Facebook page** once
3. **Deploy** (Vercel will deploy automatically)
4. **Relax!** Everything is automatic now! ☕

**Your AI automation will work 24/7 with zero maintenance!** 🎉

