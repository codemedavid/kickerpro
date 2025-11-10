# ⚡ Facebook OAuth - Quick Start (5 Minutes)

## What You Built

✅ **Automatic long-lived token generation** for every user  
✅ **Auto-sync Facebook Pages** when users connect  
✅ **No more manual token management** - everything is automatic!

---

## 🚀 3-Step Setup

### Step 1: Add Environment Variables (1 min)

Add to your `.env.local`:

```bash
# Facebook OAuth
NEXT_PUBLIC_FACEBOOK_APP_ID=802438925861067
FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Step 2: Run Database Migration (1 min)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and run: `supabase/migrations/add_facebook_oauth_tokens.sql`

### Step 3: Configure Facebook App (2 min)

1. Go to https://developers.facebook.com/apps/802438925861067
2. **Settings → Basic** → Add domain: `localhost`
3. **Facebook Login → Settings** → Add redirect URI:
   ```
   http://localhost:3000/api/auth/facebook/callback
   ```
4. Click **Save**

---

## 🎨 Add to Your UI

### Quick Option: Full Connection Card

```tsx
// app/dashboard/page.tsx
import { FacebookConnectionCard } from '@/components/facebook/facebook-connection-card';

export default function DashboardPage() {
  return (
    <div className="container py-8">
      <FacebookConnectionCard />
    </div>
  );
}
```

### Simple Option: Just the Button

```tsx
import { ConnectFacebookButton } from '@/components/facebook/connect-facebook-button';

export default function Page() {
  return <ConnectFacebookButton />;
}
```

---

## ✅ Test It!

1. **Start dev server:** `npm run dev`
2. **Visit your page** with the component
3. **Click "Connect Facebook"**
4. **Authorize** your app
5. **Done!** Token auto-generated and saved

Check Supabase:
- `users` table → `facebook_access_token` filled
- `facebook_pages` table → all pages synced

---

## 🔧 Using Tokens in Your Code

```typescript
// Get user's Facebook token
const { data: user } = await supabase
  .from('users')
  .select('facebook_access_token')
  .eq('id', userId)
  .single();

// Use it to post
await fetch(`https://graph.facebook.com/v19.0/PAGE_ID/feed`, {
  method: 'POST',
  body: JSON.stringify({
    message: 'Hello!',
    access_token: user.facebook_access_token
  })
});
```

---

## 📊 API Endpoints

```typescript
// Initiate OAuth
window.location.href = '/api/auth/facebook';

// Get user's pages
const res = await fetch('/api/facebook/pages');

// Refresh token
await fetch('/api/facebook/refresh-token', { method: 'POST' });

// Disconnect
await fetch('/api/facebook/disconnect', { method: 'POST' });
```

---

## 🎉 That's It!

Every user now auto-generates their own long-lived token when connecting Facebook!

**See `FACEBOOK_OAUTH_SETUP.md` for detailed documentation.**

