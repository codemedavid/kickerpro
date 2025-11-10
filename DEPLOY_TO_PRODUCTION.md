# 🚀 Deploy to Production - Complete Guide

## 🎯 Your Setup

- ✅ **GitHub Repo**: https://github.com/codemedavid/kickerpro
- ✅ **Deployment Platform**: Vercel (configured with cron jobs)
- ✅ **Facebook App ID**: 802438925861067
- ✅ **Database**: Supabase (rvfxvunlxnafmqpovqrf)

---

## 📋 Pre-Deployment Checklist

### ✅ Already Done
- [x] Facebook OAuth code implemented
- [x] Environment variables configured locally
- [x] Database migration SQL ready
- [x] vercel.json configured with cron jobs
- [x] GitHub repo connected

### ⏳ Need to Do
- [ ] Run database migration in Supabase
- [ ] Deploy to Vercel
- [ ] Add production environment variables
- [ ] Update Facebook App with production URLs

---

## 🚀 Step 1: Deploy to Vercel (5 minutes)

### Option A: Deploy via Vercel Dashboard (Easiest)

1. **Go to Vercel:**
   - Visit https://vercel.com
   - Login/Signup

2. **Import Project:**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Choose: `codemedavid/kickerpro`

3. **Configure Build Settings:**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (leave as is)
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

4. **Click "Deploy"**
   - Wait 2-3 minutes
   - You'll get a URL like: `https://kickerpro.vercel.app`
   - Or your custom domain if configured

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

---

## 🔐 Step 2: Add Environment Variables to Vercel

**IMPORTANT:** Add these in Vercel Dashboard → Your Project → Settings → Environment Variables

### Required Variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://rvfxvunlxnafmqpovqrf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Facebook OAuth (Production)
NEXT_PUBLIC_FACEBOOK_APP_ID=802438925861067
FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9
NEXT_PUBLIC_BASE_URL=https://kickerpro.vercel.app
# ^^ CHANGE THIS to your actual Vercel URL!

# Facebook App Version
NEXT_PUBLIC_FACEBOOK_APP_VERSION=v19.0

# Webhook Token (optional)
WEBHOOK_VERIFY_TOKEN=Token123
```

### How to Add:
1. Go to https://vercel.com/dashboard
2. Select your project: `kickerpro`
3. Go to **Settings** → **Environment Variables**
4. For each variable:
   - Click "Add Variable"
   - Name: (e.g., `NEXT_PUBLIC_FACEBOOK_APP_ID`)
   - Value: (paste the value)
   - Environment: Select **Production, Preview, Development**
   - Click "Save"

**After adding all variables:** Redeploy
- Go to **Deployments** tab
- Click "..." on latest deployment
- Click "Redeploy"

---

## 🗄️ Step 3: Run Database Migration

**You still need to do this!**

1. Open https://supabase.com
2. Select your project: `rvfxvunlxnafmqpovqrf`
3. Go to **SQL Editor**
4. Copy SQL from **`COPY_THIS_SQL.txt`**
5. Paste and click **"Run"**

---

## 📱 Step 4: Update Facebook App Settings

Once deployed, add your production URLs:

1. **Go to:** https://developers.facebook.com/apps/802438925861067

2. **Settings → Basic:**
   - **App Domains:** Add both:
     ```
     localhost
     kickerpro.vercel.app
     ```
   - Click **Save Changes**

3. **Facebook Login → Settings:**
   - **Valid OAuth Redirect URIs:** Add ALL three:
     ```
     http://localhost:3000/api/auth/facebook/callback
     https://mae-squarish-sid.ngrok-free.dev/api/auth/facebook/callback
     https://kickerpro.vercel.app/api/auth/facebook/callback
     ```
   - ☝️ **CHANGE** `kickerpro.vercel.app` to YOUR actual URL
   - Click **Save Changes**

---

## 🧪 Step 5: Test Production

1. **Visit your production URL:**
   ```
   https://kickerpro.vercel.app
   ```

2. **Login/Register**

3. **Go to Dashboard**

4. **Click "Connect Facebook"**

5. **Authorize**

6. **Should see:** Success + your Facebook Pages!

---

## 🎯 Your URLs After Deployment

| Environment | URL | Use For |
|-------------|-----|---------|
| **Production** | `https://kickerpro.vercel.app` | Live users |
| **Local Dev** | `http://localhost:3000` | Development |
| **ngrok** | `https://mae-squarish-sid.ngrok-free.dev` | Testing webhooks |

---

## 🔧 Custom Domain (Optional)

### If you have a custom domain (e.g., `yourdomain.com`):

1. **In Vercel:**
   - Go to **Settings** → **Domains**
   - Click "Add"
   - Enter your domain: `yourdomain.com`
   - Follow DNS instructions

2. **Update Environment Variable:**
   ```bash
   NEXT_PUBLIC_BASE_URL=https://yourdomain.com
   ```

3. **Update Facebook App:**
   - Add domain to **App Domains**
   - Add to **OAuth Redirect URIs**:
     ```
     https://yourdomain.com/api/auth/facebook/callback
     ```

---

## 📊 Monitoring & Cron Jobs

Your `vercel.json` has configured:

- ✅ Send scheduled messages (every minute)
- ✅ AI automations (every minute)
- ✅ Refresh Facebook tokens (daily at midnight)
- ✅ Cleanup monitoring (hourly)
- ✅ Retry failed messages (every 15 minutes)

**These will run automatically in production!**

View cron logs:
- Vercel Dashboard → Your Project → Logs

---

## 🐛 Troubleshooting

### "Redirect URI Mismatch"
→ Add production URL to Facebook App OAuth settings

### Environment Variables Not Working
→ Redeploy after adding variables in Vercel

### Build Fails
→ Check build logs in Vercel
→ Ensure all dependencies in `package.json`

### Database Errors
→ Run the SQL migration in Supabase
→ Check Supabase connection string

### Cron Jobs Not Running
→ Check Vercel logs
→ Ensure endpoints exist and work

---

## ✅ Deployment Checklist

- [ ] Deployed to Vercel
- [ ] Added all environment variables
- [ ] Redeployed after adding variables
- [ ] Ran database migration in Supabase
- [ ] Added production URL to Facebook App
- [ ] Added OAuth redirect URI to Facebook
- [ ] Tested production login
- [ ] Tested Facebook connection
- [ ] Verified cron jobs in logs

---

## 🎉 Success!

Once all steps complete:

✅ Users can access: `https://kickerpro.vercel.app`  
✅ Facebook OAuth works in production  
✅ Automatic token generation for all users  
✅ Cron jobs running automatically  
✅ Database connected  
✅ Ready to send bulk messages!  

---

## 📞 Quick Reference

| What | Value |
|------|-------|
| **GitHub Repo** | https://github.com/codemedavid/kickerpro |
| **Vercel Dashboard** | https://vercel.com/dashboard |
| **Facebook App** | https://developers.facebook.com/apps/802438925861067 |
| **Supabase** | https://supabase.com/dashboard/project/rvfxvunlxnafmqpovqrf |
| **OAuth Callback** | `/api/auth/facebook/callback` |

---

**Ready to deploy? Follow Step 1! 🚀**

