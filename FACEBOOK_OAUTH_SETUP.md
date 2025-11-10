# 🚀 Facebook OAuth Auto-Generation Setup Guide

## What Was Built

A complete Facebook OAuth system that **automatically generates long-lived tokens** for every user who connects their Facebook account. No more manual token generation!

## 🎯 Features

- ✅ **Auto-generate long-lived tokens** (~60 days) for each user
- ✅ **Automatic page syncing** - fetches all Facebook Pages user manages
- ✅ **Token refresh** - automatically refresh expiring tokens
- ✅ **Secure storage** - tokens stored per-user in Supabase
- ✅ **Beautiful UI** - ready-to-use React components
- ✅ **Full API** - complete REST endpoints for all operations

## 📁 What Was Created

```
📦 Your Project
├── 🗄️ Database
│   └── supabase/migrations/add_facebook_oauth_tokens.sql
│       - Adds token storage to users table
│       - RLS policies for security
│       - Indexes for performance
│
├── 🔧 Backend API
│   ├── src/lib/facebook/
│   │   ├── config.ts              - Facebook OAuth configuration
│   │   └── token-manager.ts       - Token exchange & management
│   │
│   └── src/app/api/
│       ├── auth/facebook/
│       │   ├── route.ts           - Initiate OAuth flow
│       │   └── callback/route.ts  - Handle OAuth callback
│       │
│       └── facebook/
│           ├── refresh-token/route.ts  - Refresh expiring tokens
│           ├── pages/route.ts          - Get/sync user's pages
│           └── disconnect/route.ts     - Disconnect Facebook
│
└── 🎨 Frontend UI
    └── src/components/facebook/
        ├── connect-facebook-button.tsx     - "Connect Facebook" button
        └── facebook-connection-card.tsx    - Full connection management UI
```

---

## 🔧 Setup Instructions

### Step 1: Update Environment Variables

Add these to your `.env` or `.env.local` file:

```bash
# Facebook OAuth Configuration
NEXT_PUBLIC_FACEBOOK_APP_ID=802438925861067
FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9

# Your app's base URL (adjust for production)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**For Production (Vercel/Other):**
```bash
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### Step 2: Run Database Migration

1. **Open Supabase Dashboard**
   - Go to https://supabase.com
   - Select your project
   - Click **"SQL Editor"** in the left sidebar

2. **Run the Migration**
   - Copy the contents of `supabase/migrations/add_facebook_oauth_tokens.sql`
   - Paste into SQL Editor
   - Click **"Run"**

This adds columns to store Facebook tokens for each user.

### Step 3: Configure Facebook App

1. **Go to Facebook Developer Console**
   - Visit https://developers.facebook.com/apps/
   - Select your app (ID: 802438925861067)

2. **Add OAuth Redirect URI**
   - Go to **Settings → Basic**
   - Scroll to **"App Domains"**, add: `localhost` (for dev) and your production domain
   - Go to **Facebook Login → Settings**
   - Add to **Valid OAuth Redirect URIs**:
     ```
     http://localhost:3000/api/auth/facebook/callback
     https://yourdomain.com/api/auth/facebook/callback
     ```
   - Click **"Save Changes"**

3. **Verify Permissions**
   - Go to **App Review → Permissions and Features**
   - Make sure these are enabled:
     - `pages_show_list`
     - `pages_read_engagement`
     - `pages_manage_posts`
     - `pages_messaging`

---

## 🎨 Using the UI Components

### Option 1: Quick Setup - Add to Dashboard

```tsx
// In your dashboard page (e.g., app/dashboard/page.tsx)
import { FacebookConnectionCard } from '@/components/facebook/facebook-connection-card';

export default function DashboardPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      {/* Add the Facebook connection card */}
      <FacebookConnectionCard />
      
      {/* Rest of your dashboard */}
    </div>
  );
}
```

### Option 2: Just the Button

```tsx
import { ConnectFacebookButton } from '@/components/facebook/connect-facebook-button';

export default function MyPage() {
  return (
    <div>
      <h2>Connect Your Account</h2>
      <ConnectFacebookButton />
    </div>
  );
}
```

---

## 🔄 How It Works (The Flow)

```
1. User clicks "Connect Facebook" button
   ↓
2. Redirects to Facebook OAuth login
   ↓
3. User authorizes your app
   ↓
4. Facebook redirects back to /api/auth/facebook/callback
   ↓
5. Backend automatically:
   - Exchanges code for short-lived token
   - Exchanges short-lived for LONG-LIVED token (~60 days)
   - Fetches user's profile
   - Fetches all their Facebook Pages
   - Stores everything in Supabase
   ↓
6. User redirected back to dashboard with success message
   ↓
7. Token automatically refreshes when expiring
```

---

## 🛠️ API Endpoints

### For Frontend Usage

```typescript
// Connect Facebook (initiates OAuth)
window.location.href = '/api/auth/facebook';

// Get user's pages
const response = await fetch('/api/facebook/pages');
const { pages } = await response.json();

// Refresh token
const response = await fetch('/api/facebook/refresh-token', {
  method: 'POST'
});

// Disconnect Facebook
const response = await fetch('/api/facebook/disconnect', {
  method: 'POST'
});

// Toggle page active/inactive
const response = await fetch('/api/facebook/pages', {
  method: 'POST',
  body: JSON.stringify({
    pageId: 'PAGE_ID',
    action: 'toggle'
  })
});
```

---

## 🎯 Example: Getting a User's Token in Your Code

```typescript
// In any API route or server component
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  // Get their Facebook token
  const { data: userData } = await supabase
    .from('users')
    .select('facebook_access_token')
    .eq('id', user.id)
    .single();
  
  const fbToken = userData.facebook_access_token;
  
  // Use the token to post to Facebook
  await fetch(`https://graph.facebook.com/v19.0/PAGE_ID/feed`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'Posted via my app!',
      access_token: fbToken
    })
  });
}
```

---

## 🔐 Security Features

- ✅ **Row Level Security (RLS)** - Users can only access their own tokens
- ✅ **Secure storage** - Tokens never exposed to client
- ✅ **CSRF protection** - State parameter in OAuth flow
- ✅ **Auto-refresh** - Tokens refreshed before expiry
- ✅ **Token validation** - Verified with Facebook before use

---

## 🐛 Troubleshooting

### "Redirect URI Mismatch"
→ Make sure you added the callback URL in Facebook Developer Console

### "Invalid Client ID"
→ Check your `NEXT_PUBLIC_FACEBOOK_APP_ID` in `.env`

### "No Facebook token found"
→ User needs to click "Connect Facebook" first

### "Token expired"
→ Call the refresh endpoint: `POST /api/facebook/refresh-token`

### Pages not showing up
→ Make sure user is admin/editor of Facebook Pages
→ Try clicking the "Refresh" button in the UI

---

## 🚀 Testing It

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Add the component to a page** (e.g., dashboard)

3. **Visit the page and click "Connect Facebook"**

4. **Authorize your app**

5. **You'll be redirected back with success message**

6. **Check Supabase:**
   - Go to Table Editor → users
   - You should see `facebook_access_token` filled
   - Go to facebook_pages → see all your pages

---

## 🎉 You're Done!

Every user who connects Facebook now automatically gets:
- ✅ Long-lived token (60 days)
- ✅ All their Facebook Pages synced
- ✅ Automatic token refresh
- ✅ Secure per-user storage

**No more manual token generation needed!** 🎊

---

## 📚 Additional Resources

- **Facebook Graph API Docs**: https://developers.facebook.com/docs/graph-api
- **OAuth Documentation**: https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow
- **Supabase RLS**: https://supabase.com/docs/guides/auth/row-level-security

---

## Need Help?

Check the files:
- `src/lib/facebook/token-manager.ts` - Token management logic
- `src/app/api/auth/facebook/callback/route.ts` - OAuth callback handler
- `src/components/facebook/facebook-connection-card.tsx` - UI component

All files have detailed comments explaining how they work!

