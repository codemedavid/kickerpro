# Quick Start - Get Your Facebook Token in 5 Minutes

## 📋 Checklist

- [ ] Get App ID and App Secret from Facebook Developer Console
- [ ] Generate short-lived token from Graph API Explorer
- [ ] Fill in `.env` file
- [ ] Run `npm run exchange`
- [ ] Run `npm run verify`

## Step 1: Get App Credentials (2 minutes)

1. **Go to:** https://developers.facebook.com/apps/
2. **Select your app** (or create one)
3. **Navigate to:** Settings → Basic (left sidebar)
4. **Copy:**
   - App ID
   - App Secret (click "Show" button)

## Step 2: Generate Short-Lived Token (2 minutes)

1. **Go to:** https://developers.facebook.com/tools/explorer/
2. **Select your app** from dropdown (top right)
3. **Click:** "Generate Access Token" button
4. **Select permissions you need:**
   - For posting: `pages_manage_posts`, `pages_read_engagement`
   - For reading: `pages_show_list`, `pages_read_engagement`
   - For ads: `ads_management`, `ads_read`
5. **Click:** "Generate Access Token"
6. **Copy** the token (starts with `EAAG...`)

## Step 3: Fill Your `.env` File (1 minute)

Open the `.env` file in this directory and replace the placeholder values:

```bash
# Replace these with your actual values:
APP_ID=123456789012345                    # From Step 1
APP_SECRET=abc123def456ghi789jkl012        # From Step 1
SHORT_LIVED_USER_TOKEN=EAAGm0PX4ZCpsBO... # From Step 2
GRAPH_VERSION=v19.0                       # Keep as is (or update to your app version)
```

**Save the file!**

## Step 4: Run the Scripts (30 seconds)

Open your terminal in this directory and run:

```bash
# Exchange for long-lived token
npm run exchange
```

You should see:
```
✅ Long-lived user token acquired.
   Expires in ~60 days
   Saved to tokens/long_lived_user.json
   Preview: EAAGm0...ZCpsBO
```

```bash
# Verify it works
npm run verify
```

You should see:
```
✅ Token verification
{
  is_valid: true,
  type: 'USER',
  app_id: '123456789012345',
  user_id: '...',
  scopes: [...],
  expires_at_epoch: ...
}
```

```bash
# (Optional) Get page tokens
npm run pages
```

## ✅ Done!

Your long-lived token is saved in `tokens/long_lived_user.json` and will last ~60 days.

## 🔄 When Your Token Expires (in ~60 days)

1. Generate a new short-lived token (Step 2)
2. Update `SHORT_LIVED_USER_TOKEN` in `.env`
3. Run `npm run exchange` again

## ❓ Troubleshooting

### "Missing APP_ID, APP_SECRET, or SHORT_LIVED_USER_TOKEN"
→ Check that you filled in all three values in `.env` and saved the file

### "Exchange failed: Invalid OAuth access token"
→ Your short-lived token expired. Generate a new one (Step 2)

### "This authorization code has been used"
→ Same as above - generate a new short-lived token

### "No pages returned"
→ Make sure your user account is an admin/editor of at least one Facebook Page

### Script won't run / syntax error
→ Make sure you have Node.js 18+ installed: `node --version`

## 🎯 What to Do with Your Long-Lived Token

The long-lived token is saved in `tokens/long_lived_user.json`. You can:
- Use it in your Next.js app to post to Facebook
- Store it in your database
- Add it to your production environment variables
- Use it in API calls to Facebook Graph API

**Example:** Using it in your app:
```javascript
import { readFile } from 'fs/promises';

const tokenData = JSON.parse(await readFile('tokens/long_lived_user.json', 'utf-8'));
const token = tokenData.long_lived_user_token;

// Now use this token in your Facebook API calls
const response = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`);
```

## 📚 Full Documentation

See `FB_TOKEN_README.md` for complete documentation and advanced usage.
