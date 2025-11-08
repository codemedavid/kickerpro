# 🚀 Setup Instructions for KickerPro

## Step 1: Install Node.js

### Option A: Using Official Installer (Recommended)
1. **Download Node.js:**
   - Go to: https://nodejs.org/
   - Download the **LTS version** (recommended for most users)
   - Current LTS: Node.js 20.x or 18.x

2. **Install Node.js:**
   - Run the downloaded installer
   - Follow the installation wizard
   - **Important:** Make sure to check "Add to PATH" during installation
   - Restart your terminal/PowerShell after installation

3. **Verify Installation:**
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers like `v20.x.x` and `10.x.x`

### Option B: Using Chocolatey (Windows Package Manager)
If you have Chocolatey installed:
```bash
choco install nodejs-lts
```

### Option C: Using winget (Windows 11)
```bash
winget install OpenJS.NodeJS.LTS
```

---

## Step 2: Install Project Dependencies

Once Node.js is installed, open PowerShell in the project directory and run:

```bash
npm install
```

This will install all dependencies listed in `package.json`.

---

## Step 3: Configure Environment Variables

Create a `.env.local` file in the root directory with the following content:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Facebook App Configuration
NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
NEXT_PUBLIC_FACEBOOK_APP_VERSION=v18.0

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Where to Get These Values:

#### **Supabase Credentials:**
1. Go to https://supabase.com
2. Create a new project (or use existing)
3. Go to **Project Settings** > **API**
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

#### **Facebook App Credentials:**
1. Go to https://developers.facebook.com
2. Create a new app (or use existing)
3. Go to **Settings** > **Basic**
4. Copy:
   - App ID → `NEXT_PUBLIC_FACEBOOK_APP_ID`
   - App Secret → `FACEBOOK_APP_SECRET`

#### **Webhook Token:**
- Create any random string (e.g., `MySecureWebhookToken123`)
- This will be used to verify Facebook webhook requests

---

## Step 4: Set Up Supabase Database

1. **Open Supabase SQL Editor:**
   - Go to your Supabase project
   - Click **SQL Editor** in the sidebar

2. **Run Database Migration:**
   - Open the file `RUN_THIS_NOW.sql` from the project
   - Copy all contents
   - Paste into Supabase SQL Editor
   - Click **Run**

This creates all necessary tables and configurations.

---

## Step 5: Configure Facebook App

1. **Add Products to Your Facebook App:**
   - Go to your Facebook App dashboard
   - Add **Facebook Login** product
   - Add **Messenger Platform** product

2. **Configure OAuth Redirect URIs:**
   - Go to **Facebook Login** > **Settings**
   - Add Valid OAuth Redirect URIs:
     ```
     http://localhost:3000/login
     http://localhost:3000/
     ```

3. **Request Permissions:**
   Your app needs these permissions:
   - `pages_messaging`
   - `pages_read_engagement`
   - `pages_show_list`
   - `pages_manage_metadata`

4. **Add Yourself as Test User:**
   - Go to **Roles** > **Test Users**
   - Add yourself to test the app

---

## Step 6: Run the Development Server

```bash
npm run dev
```

The app will start at: **http://localhost:3000**

---

## Step 7: Test the Application

1. **Open Browser:**
   - Navigate to http://localhost:3000

2. **Login:**
   - Click "Continue with Facebook"
   - Grant permissions
   - You'll be redirected to the dashboard

3. **Connect Facebook Pages:**
   - Go to **Dashboard** > **Facebook Pages**
   - Click "Connect New Page"
   - Select pages to connect

4. **Test Features:**
   - ✅ Sync conversations
   - ✅ Send test message
   - ✅ Create pipeline opportunity
   - ✅ Schedule message

---

## 🐛 Troubleshooting

### Problem: "npm is not recognized"
**Solution:** Node.js is not installed or not in PATH. Reinstall Node.js and restart terminal.

### Problem: "Cannot find module"
**Solution:** Run `npm install` again to install dependencies.

### Problem: Facebook login fails
**Solution:** 
- Check if Facebook App ID is correct in `.env.local`
- Verify OAuth redirect URIs in Facebook App settings
- Make sure you're added as a test user/admin

### Problem: Database errors
**Solution:**
- Verify Supabase credentials in `.env.local`
- Run `RUN_THIS_NOW.sql` in Supabase SQL Editor
- Check Row Level Security policies are set up

### Problem: HTTPS required error
**Solution:** For local development:
- Use `localhost` (works without HTTPS)
- Or use ngrok: `npx ngrok http 3000`
- Update Facebook App OAuth URLs with ngrok URL

---

## 📚 Additional Resources

- **Next.js Documentation:** https://nextjs.org/docs
- **Supabase Documentation:** https://supabase.com/docs
- **Facebook Developers:** https://developers.facebook.com/docs
- **Shadcn UI Components:** https://ui.shadcn.com

---

## 🎯 Quick Commands Reference

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

---

## ✅ Checklist

Before running the app, make sure you have:

- [ ] ✅ Node.js installed (v18 or higher)
- [ ] ✅ Dependencies installed (`npm install`)
- [ ] ✅ `.env.local` file created with all credentials
- [ ] ✅ Supabase project created
- [ ] ✅ Database migrations run (`RUN_THIS_NOW.sql`)
- [ ] ✅ Facebook App created and configured
- [ ] ✅ OAuth redirect URIs added to Facebook App
- [ ] ✅ Added yourself as Facebook App admin/test user

---

## 🚀 You're Ready!

Once all steps are complete, run:

```bash
npm run dev
```

And open **http://localhost:3000** in your browser!

---

**Need Help?** Check the other documentation files:
- `README.md` - Project overview
- `ENV_SETUP.md` - Environment variables guide
- `FINAL_COMPLETE_SYSTEM.md` - Complete feature list
- `QUICKSTART.md` - Quick start guide

