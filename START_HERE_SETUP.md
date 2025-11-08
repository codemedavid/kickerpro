# 🚀 Quick Start - Get KickerPro Running in 10 Minutes

## ⚠️ Current Status
**Node.js is not installed on your system.** You need to install it first.

---

## Step 1: Install Node.js (5 minutes)

### **Download & Install:**
1. Go to: **https://nodejs.org/**
2. Click **"Download Node.js (LTS)"** - the big green button
3. Run the installer
4. **IMPORTANT:** During installation, make sure "Add to PATH" is checked
5. Restart your PowerShell/Terminal after installation

### **Verify Installation:**
Open a new PowerShell window and type:
```bash
node --version
npm --version
```

You should see version numbers. If you do, Node.js is installed! ✅

---

## Step 2: Install Project Dependencies (2 minutes)

Open PowerShell in your project folder (`C:\Users\bigcl\Downloads\bulk\kickerpro`) and run:

```bash
npm install
```

This will download all required packages (~200MB).

---

## Step 3: Create Environment Variables File (1 minute)

Create a file named `.env.local` in the project root with this content:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Facebook App Configuration
NEXT_PUBLIC_FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
NEXT_PUBLIC_FACEBOOK_APP_VERSION=v18.0

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=MySecureToken123

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note:** You can run the app with placeholder values to see the UI, but you'll need real credentials to test features.

---

## Step 4: Run the Development Server (1 minute)

```bash
npm run dev
```

The app will start at: **http://localhost:3000**

---

## 🎉 You're Done!

Open your browser and go to: **http://localhost:3000**

You'll see the beautiful login page even without credentials!

---

## 🔧 To Get Full Functionality

### **Set Up Supabase (Free):**
1. Go to https://supabase.com
2. Sign up (free tier available)
3. Create a new project
4. Go to Settings → API
5. Copy the URL and keys to `.env.local`
6. Run `RUN_THIS_NOW.sql` in SQL Editor

### **Set Up Facebook App (Free):**
1. Go to https://developers.facebook.com
2. Create an app
3. Add "Facebook Login" and "Messenger Platform"
4. Copy App ID and Secret to `.env.local`
5. Add yourself as test user

---

## 🐛 Common Issues

### "npm is not recognized"
- Node.js not installed or not in PATH
- Restart your terminal after installing Node.js

### Port 3000 already in use
```bash
npm run dev -- -p 3001
```
This runs on port 3001 instead.

### Can't create .env.local
- Right-click in project folder
- New → Text Document
- Name it `.env.local` (with the dot at the start)
- Remove the `.txt` extension

---

## 📚 Full Documentation

- **SETUP_INSTRUCTIONS.md** - Detailed setup guide
- **README.md** - Project overview
- **FINAL_COMPLETE_SYSTEM.md** - Complete feature list

---

## 🎯 Next Steps After Setup

1. ✅ Login with Facebook
2. ✅ Connect Facebook pages
3. ✅ Sync conversations
4. ✅ Send test message
5. ✅ Create pipeline opportunity

---

**Questions?** Check `SETUP_INSTRUCTIONS.md` for detailed troubleshooting!

