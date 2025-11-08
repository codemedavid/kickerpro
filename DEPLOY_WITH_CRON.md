# 🚀 Deploy to Vercel with Cron Jobs

## 📋 **Pre-Deployment Checklist**

Before deploying, ensure you have:

- [ ] **Vercel account** connected to your GitHub
- [ ] **Environment variables** ready:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_FACEBOOK_APP_ID`
  - `FACEBOOK_APP_SECRET`
  - `OPENAI_API_KEY`
  - `CRON_SECRET` (optional but recommended)

---

## 🎯 **Step 1: Generate Cron Secret**

For security, generate a random secret:

```bash
# On Mac/Linux
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output - you'll need it for Vercel environment variables.

---

## 🎯 **Step 2: Deploy to Vercel**

### **Option A: Via Vercel Dashboard (Recommended)**

1. **Go to Vercel Dashboard:** https://vercel.com/
2. **Import Project:**
   - Click "Add New" → "Project"
   - Select your GitHub repository: `kickerpro`
   - Click "Import"

3. **Configure Project:**
   - **Framework Preset:** Next.js (auto-detected)
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

4. **Add Environment Variables:**
   Click "Environment Variables" and add all required variables:
   
   | Name | Value | Environment |
   |------|-------|-------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Production, Preview, Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Production, Preview, Development |
   | `NEXT_PUBLIC_FACEBOOK_APP_ID` | Your FB app ID | Production, Preview, Development |
   | `FACEBOOK_APP_SECRET` | Your FB app secret | Production, Preview, Development |
   | `OPENAI_API_KEY` | Your OpenAI key | Production, Preview, Development |
   | `CRON_SECRET` | Generated secret from Step 1 | Production, Preview, Development |

5. **Click "Deploy"**

### **Option B: Via Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Follow prompts to set up environment variables
```

---

## 🎯 **Step 3: Verify Cron Jobs**

After deployment:

1. **Go to Vercel Dashboard** → Your Project
2. **Navigate to Settings** → **Cron Jobs**
3. **You should see:**

   ```
   GET /api/cron/send-scheduled
   Schedule: * * * * *
   Status: Active
   
   GET /api/cron/ai-automations
   Schedule: */15 * * * *
   Status: Active
   ```

4. **If cron jobs don't appear:**
   - Redeploy the project
   - Check that `vercel.json` is in your repository root
   - Ensure you're on a paid Vercel plan (crons require Pro/Team plan)

---

## 🎯 **Step 4: Test the Cron Job**

### **Manual Test via Vercel Functions**

1. **Go to Vercel Dashboard** → Your Project → **Functions**
2. **Find** `/api/cron/send-scheduled`
3. **Click** to view details
4. **Test the function:**
   - Click "Test" or manually trigger
   - View logs to see execution

### **Test with a Real Message**

1. **Schedule a message** for 2 minutes from now
2. **Close your browser** completely
3. **Wait 2 minutes**
4. **Open your app** and check History page
5. **Message should be sent!** ✅

---

## 🎯 **Step 5: Monitor Cron Execution**

### **View Logs**

1. **Vercel Dashboard** → Your Project → **Functions**
2. **Filter by** `/api/cron/send-scheduled`
3. **View real-time logs:**

```
[Cron Send Scheduled] ⏰ Starting scheduled message check at 2025-11-08T10:29:00.000Z
[Cron Send Scheduled] Found 1 message(s) due for sending
[Cron Send Scheduled] Processing message: abc123 - Test Message
[Cron Send Scheduled] Sending to 10 recipient(s)...
[Cron Send Scheduled] ✅ Message complete: 10 sent, 0 failed
```

### **Set Up Monitoring (Optional)**

Add monitoring with Vercel's built-in tools:
- **Vercel Analytics** - Track function performance
- **Vercel Logs** - Real-time log viewing
- **Third-party:** Datadog, LogDNA, etc.

---

## 🚨 **Troubleshooting**

### **Cron Jobs Not Running**

**Problem:** Scheduled messages aren't being sent

**Solutions:**
1. **Check Vercel Plan:**
   - Cron jobs require **Vercel Pro** or **Team** plan
   - Free plan doesn't support cron jobs
   - Upgrade at: https://vercel.com/account/billing

2. **Verify Cron Configuration:**
   - Check `vercel.json` is in repository root
   - Verify syntax is correct
   - Redeploy after changes

3. **Check Function Logs:**
   - Look for errors in Vercel Functions tab
   - Common issues:
     - Missing environment variables
     - Database connection errors
     - Facebook API token expired

### **Authorization Errors**

**Problem:** Cron returns 401 Unauthorized

**Solutions:**
1. **Check CRON_SECRET:**
   - Make sure it's set in Vercel environment variables
   - Should match between `vercel.json` and `.env`

2. **Vercel automatically handles auth:**
   - Don't manually pass Authorization header
   - Vercel injects it automatically

### **Messages Failing to Send**

**Problem:** Cron runs but messages fail

**Solutions:**
1. **Check Facebook access token:**
   - May have expired
   - Reconnect Facebook page in app

2. **Verify recipients exist:**
   - Check message has selected_recipients
   - Verify conversation data is fresh

3. **Check Supabase connection:**
   - Verify service role key is set
   - Test database connection

---

## 📊 **Cron Job Specifications**

### **Send Scheduled Messages**
- **Path:** `/api/cron/send-scheduled`
- **Schedule:** Every 1 minute (`* * * * *`)
- **Max Execution:** 10 seconds (Vercel limit)
- **Messages per run:** Up to 10
- **Memory:** 1024 MB (default)

### **AI Automations**
- **Path:** `/api/cron/ai-automations`
- **Schedule:** Every 15 minutes (`*/15 * * * *`)
- **Max Execution:** 60 seconds
- **Rules per run:** Unlimited
- **Memory:** 1024 MB (default)

---

## ✅ **Post-Deployment Checklist**

After deploying:

- [ ] Cron jobs visible in Vercel dashboard
- [ ] All environment variables set
- [ ] Test message scheduled and sent successfully
- [ ] Function logs showing successful execution
- [ ] No errors in Vercel Functions tab
- [ ] Facebook integration working
- [ ] Supabase connection established

---

## 🎉 **Success!**

Your app is now deployed with working cron jobs! Scheduled messages will automatically send every minute, and AI automations run every 15 minutes.

### **Key Features Now Active:**

✅ **Scheduled Messages** - Send messages at specific times
✅ **Auto-Send** - Works 24/7 without browser open
✅ **AI Automations** - Smart replies and automation rules
✅ **Server-Side** - Reliable Vercel infrastructure
✅ **Secure** - Authorization protected endpoints

---

## 📚 **Additional Resources**

- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Cron Schedule Syntax](https://crontab.guru/)
- [Vercel Pro Plan](https://vercel.com/pricing)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

---

**Last Updated:** November 8, 2025
**Status:** ✅ Ready for Production

