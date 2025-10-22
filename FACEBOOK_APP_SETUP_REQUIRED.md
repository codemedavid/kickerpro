# ⚡ Fix: "Facebook Login is currently unavailable for this app"

## 🎯 This Error Means Facebook Needs More Information

Facebook is blocking login because your app setup is incomplete.

---

## ✅ SOLUTION: Complete These 5 Steps

### **Step 1: Go to Facebook Developer Console**

1. **Open:** [developers.facebook.com](https://developers.facebook.com)
2. **Login** with your Facebook account
3. **Click:** "My Apps" (top right)
4. **Select:** Your app OR **Create New App** if you don't have one

---

### **Step 2: If You DON'T Have a Facebook App Yet**

**Create one now:**

1. **Click:** "Create App"
2. **Select:** "Business" type
3. **Fill in:**
   - App Name: `Facebook Bulk Messenger` (or your preferred name)
   - Contact Email: Your email
   - App Purpose: Business
4. **Click:** "Create App"
5. **Complete security check**
6. ✅ **App created!**

**IMPORTANT: Copy your App ID and App Secret:**

```
App ID: 1234567890123456
App Secret: abc123def456...
```

**Add these to your `.env.local`:**

```env
NEXT_PUBLIC_FACEBOOK_APP_ID=1234567890123456
FACEBOOK_APP_SECRET=abc123def456...
```

---

### **Step 3: Configure Basic Settings**

**Go to:** Settings → Basic

**Fill in ALL these fields:**

```
✅ Display Name: Facebook Bulk Messenger

✅ App Contact Email: your-email@gmail.com

✅ Privacy Policy URL: http://localhost:3000/privacy
   (I already created this page for you!)

✅ Terms of Service URL: http://localhost:3000/terms
   (I already created this page for you!)

✅ App Domains: 
   localhost
   your-app.vercel.app (if deployed)

✅ App Icon: 
   Upload any 1024x1024 PNG image
   (Can be a simple logo or icon)

✅ Category: 
   Business and Pages
```

**Click "Save Changes"** at bottom

---

### **Step 4: Add Facebook Login Product**

**Go to:** Dashboard (left sidebar)

**Add Product:**

1. **Find:** "Facebook Login" in product list
2. **Click:** "Set Up"
3. **Select:** "Web" platform
4. **Click:** "Next"

**Configure Settings:**

**Go to:** Facebook Login → Settings

```
✅ Client OAuth Login: YES (toggle ON)

✅ Web OAuth Login: YES (toggle ON)

✅ Valid OAuth Redirect URIs:
   http://localhost:3000/login
   http://localhost:3000/
   http://localhost:3000/dashboard
   https://your-app.vercel.app/login (if deployed)

✅ Login from Devices: YES

✅ Use Strict Mode for Redirect URIs: NO
```

**Click "Save Changes"**

---

### **Step 5: Add Yourself as Admin/Tester**

**CRITICAL: This is usually the missing step!**

**Go to:** Settings → Roles

**Add Roles:**

1. **Click:** "Add People"
2. **Enter:** Your Facebook name or profile URL
3. **Select Role:** "Administrators" (most permissive)
4. **Click:** "Submit"

**Accept Role:**

1. **Check** your Facebook notifications
2. **Accept** the administrator role invitation
3. ✅ **You're now an admin!**

**OR Add Test Users (Alternative):**

**Go to:** Roles → Test Users

1. **Click:** "Add"
2. **Create:** Test user with access token
3. **Use** that account to login

---

## 🧪 Test If It's Fixed

### **After Completing Steps Above:**

1. **Wait 2-3 minutes** (Facebook processes changes)

2. **Clear browser cache:**
   - Press Ctrl+Shift+Delete
   - Clear all data
   - Close browser

3. **Open fresh browser window**

4. **Go to:** `http://localhost:3000/login`

5. **Click:** "Continue with Facebook"

6. **Should see:** Permission dialog (not error!)

7. ✅ **Click "Continue"** → Should login successfully!

---

## 🔍 Advanced Troubleshooting

### **Check 1: App Mode**

**Go to:** Settings → Basic → Top of page

**Look for:**
```
App Mode: [Development] or [Live]
```

**If Development:**
- Only Admins/Developers/Testers can login
- Make sure you're added as Admin (Step 5 above)

**If Live:**
- Anyone can login
- But requires App Review approval first

**For Testing:** Keep in Development mode + Add yourself as Admin

---

### **Check 2: Verify App Credentials**

**Go to:** Settings → Basic

**Copy:**
- App ID
- App Secret (click "Show")

**Update `.env.local`:**

```env
NEXT_PUBLIC_FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
WEBHOOK_VERIFY_TOKEN=Token123
```

**Restart dev server:**
```bash
# Kill port 3000
lsof -ti:3000 | xargs kill -9

# Start again
cd nextjs-app && npm run dev
```

---

### **Check 3: OAuth Redirect URIs**

**Must match EXACTLY:**

**In Facebook app:**
```
http://localhost:3000/login
http://localhost:3000/
```

**In your code:**
```typescript
// Should redirect to /login or /dashboard after auth
// Check login/page.tsx for redirect logic
```

**Common Mistakes:**
- ❌ `https://localhost:3000` (should be `http://` for local)
- ❌ Missing trailing slash
- ❌ Wrong port number

---

### **Check 4: Browser Console Errors**

**Press F12 → Console tab**

**Look for:**

```javascript
// ❌ Bad:
"Given URL is not allowed by the Application configuration"
→ Fix: Add to Valid OAuth Redirect URIs

// ❌ Bad:
"App Not Setup: This app is still in development mode"
→ Fix: Add yourself as Administrator

// ❌ Bad:
"API Error Code: 200"
→ Fix: Permissions not approved (add test user)
```

---

## 🚨 Nuclear Option: Start Fresh

If nothing works, create a brand new Facebook app:

### **Complete Fresh Setup (10 minutes):**

1. **Create New App:**
   - developers.facebook.com → Create App
   - Type: Business
   - Name: Facebook Bulk Messenger Test
   - Email: Your email

2. **Add Facebook Login:**
   - Products → Add Product → Facebook Login
   - Platform: Web

3. **Configure Everything:**
   ```
   Settings → Basic:
   - Contact Email: ✅
   - Privacy URL: http://localhost:3000/privacy
   - Terms URL: http://localhost:3000/terms
   - App Domains: localhost
   - App Icon: Upload image
   
   Facebook Login → Settings:
   - Valid OAuth Redirect URIs: http://localhost:3000/login
   - Client OAuth Login: ON
   - Web OAuth Login: ON
   
   Roles:
   - Add yourself as Administrator
   ```

4. **Copy Credentials:**
   ```
   Settings → Basic
   → App ID: Copy
   → App Secret: Show → Copy
   ```

5. **Update .env.local:**
   ```env
   NEXT_PUBLIC_FACEBOOK_APP_ID=new_app_id
   FACEBOOK_APP_SECRET=new_secret
   ```

6. **Restart server & try login**

---

## 📊 Verification Checklist

Before trying login again, verify ALL of these:

**Facebook App Settings:**
- [ ] ✅ App exists and you can see it
- [ ] ✅ App ID and Secret in .env.local
- [ ] ✅ Contact Email filled
- [ ] ✅ Privacy Policy URL added
- [ ] ✅ App Domains includes "localhost"
- [ ] ✅ You are added as Administrator in Roles
- [ ] ✅ OAuth Redirect URIs includes "http://localhost:3000/login"
- [ ] ✅ Client OAuth Login is ON
- [ ] ✅ Web OAuth Login is ON

**Your App:**
- [ ] ✅ Dev server running (http://localhost:3000)
- [ ] ✅ .env.local has correct App ID and Secret
- [ ] ✅ /privacy page exists (I created it)
- [ ] ✅ /terms page exists (I created it)
- [ ] ✅ Browser cache cleared
- [ ] ✅ Using http:// (not https://) for localhost

---

## ⚡ Most Common Solutions (Try These First)

### **Solution 1: Add as Administrator (90% of cases)**

```
Facebook Developer → Your App → Settings → Roles
→ Add yourself as Administrator
→ Accept invitation on Facebook
→ Try login again
```

### **Solution 2: Wait 5-10 Minutes**

```
After making changes in Facebook Developer Console
→ Wait 5-10 minutes
→ Facebook needs time to process
→ Clear browser cache
→ Try again
```

### **Solution 3: Use Test User**

```
Facebook Developer → Roles → Test Users
→ Create test user
→ Get test user access token
→ Login to Facebook as test user
→ Try your app with test account
```

---

## ✅ Summary

**Error:** "Facebook Login currently unavailable"  
**Meaning:** Facebook app setup incomplete  
**Main Fix:** Add yourself as Administrator in app settings  
**Also Need:** Contact email, privacy URL, OAuth redirect URIs  

**Steps:**
1. ✅ Go to developers.facebook.com
2. ✅ Settings → Roles → Add as Administrator
3. ✅ Settings → Basic → Fill contact email, privacy URL
4. ✅ Facebook Login → Settings → Add OAuth redirect URIs
5. ✅ Wait 5 minutes
6. ✅ Clear cache and try login

**After login works → Run RUN_THIS_NOW.sql in Supabase!** 🚀
