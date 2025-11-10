# 🔐 Environment Variables Guide

## Required Environment Variables

### Supabase Configuration
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Where to find:**
1. Go to https://supabase.com
2. Select your project
3. Go to **Settings → API**
4. Copy **Project URL** and **anon/public** key

---

### Facebook OAuth Configuration

```bash
# Your Facebook App ID (public - used in frontend)
NEXT_PUBLIC_FACEBOOK_APP_ID=802438925861067

# Your Facebook App Secret (private - server only)
FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9

# Your app's base URL (change for production)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Where to find:**
1. Go to https://developers.facebook.com/apps/
2. Select your app
3. Go to **Settings → Basic**
4. Copy **App ID** and **App Secret** (click "Show")

**For Production (Vercel):**
```bash
NEXT_PUBLIC_BASE_URL=https://yourdomain.vercel.app
```

---

## Environment Files

### Development (`.env.local`)

Create `.env.local` in your project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Facebook OAuth
NEXT_PUBLIC_FACEBOOK_APP_ID=802438925861067
FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Production (Vercel/Netlify)

Add these in your hosting platform's environment variables dashboard:

1. **Vercel:**
   - Go to Project Settings → Environment Variables
   - Add each variable
   - Redeploy

2. **Netlify:**
   - Go to Site Settings → Build & Deploy → Environment
   - Add each variable
   - Redeploy

---

## Security Notes

### ⚠️ NEVER Commit These Files:
- `.env`
- `.env.local`
- `.env.production`

They're already in `.gitignore` - keep them there!

### ✅ Variables Starting with `NEXT_PUBLIC_`
- These are exposed to the browser
- Safe to include: App IDs, public URLs
- Never include secrets here

### 🔒 Variables WITHOUT `NEXT_PUBLIC_`
- These stay on the server
- Include secrets: App Secrets, API keys
- Never exposed to browser

---

## Testing Your Configuration

### Check Environment Variables Are Loaded:

Create a test file: `scripts/check-env.js`

```javascript
console.log('Environment Variables Check:');
console.log('---------------------------');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_FACEBOOK_APP_ID:', process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ? '✅ Set' : '❌ Missing');
console.log('FACEBOOK_APP_SECRET:', process.env.FACEBOOK_APP_SECRET ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000 (default)');
```

Run it:
```bash
node scripts/check-env.js
```

---

## Common Issues

### "Missing environment variables"
→ Make sure `.env.local` exists and has all required variables
→ Restart your dev server after adding variables

### "Invalid Client ID" (Facebook)
→ Check `NEXT_PUBLIC_FACEBOOK_APP_ID` is correct
→ Make sure it doesn't have extra spaces or quotes

### "Redirect URI mismatch"
→ Update `NEXT_PUBLIC_BASE_URL` to match your domain
→ Add the callback URL in Facebook Developer Console

### Variables not updating
→ Restart your dev server: `npm run dev`
→ Clear Next.js cache: `rm -rf .next`

---

## Quick Setup Checklist

- [ ] Create `.env.local` file
- [ ] Add Supabase URL and key
- [ ] Add Facebook App ID and Secret
- [ ] Set BASE_URL (localhost for dev)
- [ ] Restart dev server
- [ ] Test Facebook OAuth connection
- [ ] For production: Add to hosting platform
- [ ] Update BASE_URL for production
- [ ] Update Facebook redirect URIs

---

## Example `.env.local` (Complete)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Facebook OAuth (for auto-generating user tokens)
NEXT_PUBLIC_FACEBOOK_APP_ID=802438925861067
FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9

# App Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Optional: Override Graph API version
# FACEBOOK_GRAPH_VERSION=v19.0
```

---

## Need Help?

See `FACEBOOK_OAUTH_SETUP.md` for complete setup instructions!

