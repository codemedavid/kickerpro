# 🔒 HTTPS Setup for Local Development

Facebook Login requires HTTPS. Here are three ways to test locally:

## Option 1: ngrok (Easiest) ⭐

**Pros:** Quick, free, no configuration  
**Cons:** URL changes each restart (free tier)

```bash
# Install ngrok (one-time)
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Run your Next.js app
npm run dev

# In another terminal, create HTTPS tunnel
npx ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok.io`

**Update Facebook App Settings:**
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Your App → Settings → Basic
3. Add OAuth Redirect URI: `https://abc123.ngrok.io/api/auth/callback`
4. Save changes
5. Update your `.env.local`:
   ```env
   NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
   ```
6. Restart dev server and visit the ngrok URL

---

## Option 2: localtunnel (Free)

**Pros:** Free, simple  
**Cons:** Less stable than ngrok

```bash
# Install
npm install -g localtunnel

# Run your app
npm run dev

# Create tunnel
lt --port 3000
```

---

## Option 3: mkcert (Local HTTPS)

**Pros:** Real localhost HTTPS, permanent  
**Cons:** More setup, certificate management

### Step 1: Install mkcert

```bash
# macOS
brew install mkcert
brew install nss  # for Firefox

# Windows (using Chocolatey)
choco install mkcert

# Linux
sudo apt install libnss3-tools
brew install mkcert
```

### Step 2: Create Local Certificate

```bash
# Create local CA
mkcert -install

# Generate certificate for localhost
cd nextjs-app
mkcert localhost 127.0.0.1 ::1
```

This creates:
- `localhost+2.pem` (certificate)
- `localhost+2-key.pem` (private key)

### Step 3: Configure Next.js for HTTPS

Create `server.js` in your project root:

```javascript
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('./localhost+2-key.pem'),
  cert: fs.readFileSync('./localhost+2.pem'),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on https://localhost:3000');
  });
});
```

Update `package.json`:
```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "next build",
    "start": "next start"
  }
}
```

### Step 4: Update Facebook App

Add OAuth redirect: `https://localhost:3000/api/auth/callback`

Update `.env.local`:
```env
NEXT_PUBLIC_APP_URL=https://localhost:3000
```

---

## Option 4: Deploy to Vercel (Recommended for Testing)

**Pros:** Real production environment, free tier, automatic HTTPS  
**Cons:** Need to deploy for every test

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd nextjs-app
vercel

# Follow prompts, get deployment URL
```

**Update Facebook App:**
- Add OAuth redirect: `https://your-app.vercel.app/api/auth/callback`
- Add environment variables in Vercel dashboard

---

## Quick Comparison

| Method | Setup Time | Cost | Stability | Best For |
|--------|-----------|------|-----------|----------|
| ngrok | 2 min | Free* | ⭐⭐⭐⭐ | Quick testing |
| localtunnel | 1 min | Free | ⭐⭐⭐ | One-off tests |
| mkcert | 10 min | Free | ⭐⭐⭐⭐⭐ | Regular dev |
| Vercel | 5 min | Free | ⭐⭐⭐⭐⭐ | Production-like |

\* ngrok free tier has limits, paid plans have static URLs

---

## Troubleshooting

### Facebook Login Still Fails

1. **Check OAuth Redirect URIs** in Facebook App settings
2. **Verify HTTPS** in browser (should show lock icon)
3. **Clear cookies** and try again
4. **Check App ID** in `.env.local` matches Facebook App
5. **Verify App Mode** - ensure it's not in "Development Mode" without test users

### ngrok URL Changes

Free ngrok URLs change on restart. Solutions:
- Get ngrok paid plan ($8/mo) for static URLs
- Use Vercel for stable testing
- Use mkcert for local development

### Certificate Warnings

With mkcert, you might see warnings:
- Run `mkcert -install` to trust local CA
- Restart browser after installation
- Some browsers need nss installed

---

## Recommended Workflow

**For Development:**
```bash
# Option 1: Use mkcert for local HTTPS
mkcert -install
mkcert localhost
node server.js

# Option 2: Use ngrok for quick tests
npm run dev
npx ngrok http 3000
```

**For Testing:**
```bash
# Deploy to Vercel for production-like environment
vercel --prod
```

**For Production:**
```bash
# Deploy to Vercel
# HTTPS is automatic and free
```

---

## Alternative: Skip Facebook Login During Development

You can also:
1. Visit `/dashboard` directly to see the UI
2. Set up Supabase auth first
3. Use ngrok/Vercel only when testing Facebook integration

See `QUICKSTART.md` for more development options.

