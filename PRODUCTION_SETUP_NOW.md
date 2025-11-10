# ⚡ Production Setup - Do This NOW (5 Minutes)

## ✅ Your Code is Ready!

Everything is pushed to GitHub. Now configure production:

---

## Step 1: Set Vercel Environment Variables (3 min)

### Open Vercel Dashboard
🔗 https://vercel.com/dashboard

### Find Your Project
Click on: **kickerpro**

### Add Environment Variables
Settings → Environment Variables → Add these:

```bash
NEXT_PUBLIC_FACEBOOK_APP_ID
Value: 802438925861067
Check: Production ✓ Preview ✓ Development ✓

FACEBOOK_APP_SECRET
Value: 99e11ff061cd03fa9348547f754f96b9
Check: Production ✓ Preview ✓ Development ✓

NEXT_PUBLIC_BASE_URL
Value: https://kickerpro.vercel.app (use YOUR actual URL!)
Check: Production ✓ Preview ✓ Development ✓
```

### Then Click: **"Redeploy"**

---

## Step 2: Update Facebook App (2 min)

### Open Facebook Developer Console
🔗 https://developers.facebook.com/apps/802438925861067

### Add Production Domain
Settings → Basic → App Domains:
```
kickerpro.vercel.app
```
(or your custom domain, no https://)

### Add Production Redirect URI
Facebook Login → Settings → Valid OAuth Redirect URIs:

**Add this (keep localhost too!):**
```
https://kickerpro.vercel.app/api/auth/facebook/callback
```

**So you should have BOTH:**
```
http://localhost:3000/api/auth/facebook/callback
https://kickerpro.vercel.app/api/auth/facebook/callback
```

### Click: **"Save Changes"**

---

## ✅ Done! Test It

1. Visit: https://kickerpro.vercel.app
2. Login
3. Go to Dashboard
4. Click "Connect Facebook"
5. Should work! 🎉

---

## 🎯 Quick Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Facebook App:** https://developers.facebook.com/apps/802438925861067
- **GitHub Repo:** https://github.com/codemedavid/kickerpro

---

## ❓ What's My Production URL?

Check Vercel Dashboard → Your project → Top right **"Visit"** button

Probably: `https://kickerpro.vercel.app`

---

**That's it! 5 minutes and you're live!** 🚀

