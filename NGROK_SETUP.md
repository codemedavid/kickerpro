# 🚀 Quick ngrok Setup Guide

## Current Status:
- ✅ Dev server running on `http://localhost:3000`
- ✅ ngrok window opened (check your taskbar)

## Step-by-Step Instructions:

### 1️⃣ Find Your ngrok URL

Look at the **ngrok command window** (check your taskbar for a new CMD window).

You should see something like:

```
Session Status                online
Account                       [Your Account]
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://xxxx-xxx-xxx-xxx.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** from the "Forwarding" line.
Example: `https://1234-56-78-90.ngrok-free.app`

---

### 2️⃣ Update Facebook App Settings

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Select your app
3. Go to **Settings → Basic**
4. Under **App Domains**, add: `xxxx-xxx-xxx-xxx.ngrok-free.app` (your ngrok domain without https://)
5. Go to **Facebook Login → Settings**
6. Under **Valid OAuth Redirect URIs**, add:
   ```
   https://xxxx-xxx-xxx-xxx.ngrok-free.app/api/auth/callback
   ```
7. Click **Save Changes**

---

### 3️⃣ Update Your Environment Variables

Open your `.env.local` file (create it if it doesn't exist) and update:

```env
# Application Configuration
NEXT_PUBLIC_APP_URL=https://xxxx-xxx-xxx-xxx.ngrok-free.app

# Add your other variables if not already present:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
NEXT_PUBLIC_FACEBOOK_APP_VERSION=v18.0

WEBHOOK_VERIFY_TOKEN=your_webhook_token
```

---

### 4️⃣ Restart Your Dev Server

After updating `.env.local`:

1. Go back to the terminal running your dev server
2. Press `Ctrl+C` to stop it
3. Run: `npm run dev`

---

### 5️⃣ Test Your Setup

1. Open your **ngrok URL** in a browser: `https://xxxx-xxx-xxx-xxx.ngrok-free.app`
2. Try logging in with Facebook
3. You should be redirected properly

---

## 📝 Quick Commands Reference

**If ngrok didn't start, manually run:**
```bash
npx ngrok http 3000
```

**If dev server isn't running:**
```bash
npm run dev
```

**To check what's running on port 3000:**
```bash
netstat -ano | findstr :3000
```

---

## ⚠️ Important Notes

- **Free ngrok URLs change** every time you restart ngrok
- Each time you restart ngrok, you'll need to update Facebook settings
- Keep both windows open (dev server + ngrok) while testing
- Access your app through the **ngrok URL**, not localhost

---

## 🐛 Troubleshooting

### Can't find ngrok window?
Check your taskbar for a new CMD/PowerShell window, or manually run:
```bash
npx ngrok http 3000
```

### ngrok says "command not found"?
Install it globally:
```bash
npm install -g ngrok
```

### Port 3000 already in use?
```bash
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Facebook login fails?
1. Make sure you're accessing via **ngrok URL** (not localhost)
2. Check OAuth redirect URIs match exactly
3. Clear browser cookies
4. Check that `.env.local` has the correct ngrok URL
5. Make sure dev server restarted after updating `.env.local`

---

## ✅ Success Checklist

- [ ] ngrok window is open and showing a URL
- [ ] Dev server is running on port 3000
- [ ] Facebook App updated with ngrok URL
- [ ] `.env.local` updated with ngrok URL
- [ ] Dev server restarted after env update
- [ ] Can access app via ngrok URL
- [ ] Facebook login works

---

## 🎯 Next Steps

Once everything is working:

1. Connect your Facebook Pages
2. Sync conversations
3. Start testing message sending
4. Check the dashboard features

For production deployment, see `DEPLOYMENT.md` for Vercel deployment.

---

**Need Help?** Check these files:
- `HTTPS_SETUP.md` - Alternative HTTPS options
- `FACEBOOK_PAGES_GUIDE.md` - Facebook integration
- `ENV_SETUP.md` - Environment variables
- `QUICKSTART.md` - General setup guide




