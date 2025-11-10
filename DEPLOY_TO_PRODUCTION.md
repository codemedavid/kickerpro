# 🚀 Deploy to Production - Complete Guide

## ✅ Code is Already Pushed!

Your code is already on GitHub: https://github.com/codemedavid/kickerpro

If you have Vercel connected, it's probably already deploying! Let's configure it properly.

---

## 📋 Production Deployment Checklist

### Step 1: Find Your Production URL (1 min)

1. Go to https://vercel.com
2. Find your project: **kickerpro**
3. Your production URL will be something like:
   ```
   https://kickerpro.vercel.app
   ```
   Or if you have a custom domain:
   ```
   https://yourdomain.com
   ```

📝 **Write down this URL - you'll need it!**

---

### Step 2: Set Environment Variables in Vercel (3 min)

1. **Open Vercel Dashboard**
   - Go to https://vercel.com/dashboard
   - Click on your **kickerpro** project

2. **Go to Settings → Environment Variables**

3. **Add these variables:**

```bash
# Facebook OAuth Configuration
NEXT_PUBLIC_FACEBOOK_APP_ID=802438925861067
FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9
NEXT_PUBLIC_BASE_URL=https://kickerpro.vercel.app

# Supabase (if not already set)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

**Important:** Replace `https://kickerpro.vercel.app` with YOUR actual production URL!

4. **For each variable:**
   - Click **"Add New"**
   - Enter **Name** (e.g., `NEXT_PUBLIC_FACEBOOK_APP_ID`)
   - Enter **Value** (e.g., `802438925861067`)
   - Select **Production**, **Preview**, and **Development** (all three!)
   - Click **"Save"**

5. **After adding all variables:**
   - Click **"Redeploy"** to apply changes

---

### Step 3: Update Facebook App for Production (2 min)

1. **Open Facebook Developer Console:**
   - Go to https://developers.facebook.com/apps/802438925861067

2. **Update App Domains:**
   - Go to **Settings → Basic**
   - In **"App Domains"** add:
     ```
     kickerpro.vercel.app
     ```
     (or your custom domain without https://)

3. **Add Production Redirect URI:**
   - Go to **Facebook Login → Settings**
   - In **"Valid OAuth Redirect URIs"** you should now have BOTH:
     ```
     http://localhost:3000/api/auth/facebook/callback
     https://kickerpro.vercel.app/api/auth/facebook/callback
     ```
     ⚠️ **Replace with YOUR actual production URL!**

4. **Click "Save Changes"**

---

### Step 4: Run Database Migration in Production Supabase (if not done)

If you haven't run the SQL migration yet:

1. Open https://supabase.com
2. SQL Editor
3. Copy from `COPY_THIS_SQL.txt`
4. Run it

✅ **Skip this if you already ran it!**

---

### Step 5: Test Production Deployment (2 min)

1. **Visit your production URL:**
   ```
   https://kickerpro.vercel.app
   ```

2. **Login to your app**

3. **Go to Dashboard**

4. **Click "Connect Facebook"**
   - Should redirect to Facebook
   - Authorize the app
   - Redirect back to your production site
   - See success message + your pages!

---

## 🔧 Quick Commands

### Check Deployment Status
```bash
# If you have Vercel CLI installed
vercel --prod
```

### Force Redeploy
Go to Vercel Dashboard → Deployments → Click "..." → Redeploy

---

## 📊 Environment Variables Summary

| Variable | Value | Where |
|----------|-------|-------|
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | `802438925861067` | Vercel + Local |
| `FACEBOOK_APP_SECRET` | `99e11ff061cd03fa9348547f754f96b9` | Vercel + Local |
| `NEXT_PUBLIC_BASE_URL` | `https://kickerpro.vercel.app` | **Vercel (production)** |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | **Local (.env.local)** |

---

## 🎯 Facebook App URLs Summary

### Development (localhost)
- **App Domain:** `localhost`
- **Redirect URI:** `http://localhost:3000/api/auth/facebook/callback`

### Production (Vercel)
- **App Domain:** `kickerpro.vercel.app` (or your custom domain)
- **Redirect URI:** `https://kickerpro.vercel.app/api/auth/facebook/callback`

**You need BOTH in Facebook App settings!**

---

## ✅ Verification Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel environment variables set
- [ ] `NEXT_PUBLIC_BASE_URL` points to production URL
- [ ] Facebook App has production redirect URI
- [ ] Facebook App has production domain
- [ ] Database migration ran in Supabase
- [ ] Production site loads
- [ ] Can login to production site
- [ ] "Connect Facebook" works in production
- [ ] Pages sync successfully

---

## 🐛 Troubleshooting Production

### "Redirect URI Mismatch" in Production
→ Check Facebook App has your exact production URL
→ Make sure it starts with `https://` (not `http://`)

### Environment Variables Not Working
→ Make sure you selected **Production** when adding them
→ Click "Redeploy" after adding variables

### Token Not Saving
→ Check Supabase database migration ran
→ Check RLS policies allow authenticated users

### Facebook Login Fails
→ Check `NEXT_PUBLIC_FACEBOOK_APP_ID` is correct in Vercel
→ Check `FACEBOOK_APP_SECRET` is set in Vercel (not exposed to client)

---

## 🎊 You're Live!

Once all steps are complete:

✅ Users can visit your production site  
✅ Click "Connect Facebook"  
✅ Get automatic long-lived tokens  
✅ All their pages sync automatically  
✅ Start sending bulk messages!  

**Your production deployment is complete!** 🚀

---

## 📞 Need Your Production URL?

### Find it in Vercel:
1. Go to https://vercel.com/dashboard
2. Click your project
3. Top of the page shows: **"Visit" button** with your URL

### Or check your git repo:
- Look for deployment in GitHub Actions
- Or check the README

### Default Vercel URL pattern:
```
https://[project-name].vercel.app
https://kickerpro.vercel.app  ← Probably this!
```

---

## 🔄 Local vs Production

| Environment | Base URL | Facebook Redirect |
|-------------|----------|-------------------|
| **Local** | `http://localhost:3000` | `http://localhost:3000/api/auth/facebook/callback` |
| **Production** | `https://kickerpro.vercel.app` | `https://kickerpro.vercel.app/api/auth/facebook/callback` |

**Both should be in Facebook App settings so you can test locally AND run in production!**

