# 🚀 Quick Start Guide

Get your Facebook Bulk Messenger app running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- A Facebook Developer account

## Step 1: Install Dependencies (1 min)

```bash
cd nextjs-app
npm install
```

## Step 2: Set Up Supabase (2 mins)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to initialize
3. Go to **SQL Editor** in the left sidebar
4. Copy the contents of `supabase-schema.sql`
5. Paste into the SQL Editor and click **Run**
6. Go to **Project Settings** > **API**
7. Copy your **Project URL** and **anon public** key

## Step 3: Create Environment File (1 min)

Create a file named `.env.local` in the `nextjs-app` folder:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Facebook (can add later)
NEXT_PUBLIC_FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
NEXT_PUBLIC_FACEBOOK_APP_VERSION=v18.0

# Webhook (can add later)
WEBHOOK_VERIFY_TOKEN=any-random-string

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note:** You only need Supabase credentials to start. Facebook credentials can be added later.

## Step 4: Run the App (30 seconds)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

## Step 5: Set Up Facebook (Optional - Can Do Later)

To enable Facebook login:

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app or use existing
3. Add **Facebook Login** product
4. Add **Messenger** product
5. In **Facebook Login** settings:
   - Add `http://localhost:3000/api/auth/callback` to **Valid OAuth Redirect URIs**
6. Get your **App ID** and **App Secret** from **Settings** > **Basic**
7. Add them to your `.env.local` file
8. Restart the dev server

## What You Can Do Now

### Without Facebook Setup:
- ✅ Explore the UI and pages
- ✅ See the dashboard layout
- ✅ View the compose message interface
- ✅ Check the database structure in Supabase

### With Facebook Setup:
- ✅ Login with Facebook
- ✅ Connect Facebook pages
- ✅ Create and schedule messages
- ✅ View message history
- ✅ Manage team members

## Common Issues

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000
npm run dev
```

### CSS/Tailwind Errors
Make sure you're using Tailwind CSS v3 (already configured):
```bash
npm list tailwindcss
# Should show version 3.x.x
```

### Database Connection Issues
- Check your Supabase URL and keys in `.env.local`
- Make sure you ran the SQL schema in Supabase
- Verify the Supabase project is active

### Facebook Login Not Working
- Make sure you added the OAuth redirect URI in Facebook App settings
- Verify your App ID and App Secret are correct
- Check that Facebook Login product is added to your app

## Next Steps

1. **Read the full README.md** - Detailed setup instructions
2. **Check DEPLOYMENT.md** - Deploy to Vercel
3. **Review PROJECT_SUMMARY.md** - Full feature list
4. **Explore the code** - Learn how it works

## File Structure (What's Where)

```
nextjs-app/
├── src/app/              # All pages and routes
│   ├── login/           # Login page
│   ├── dashboard/       # Dashboard and sub-pages
│   └── api/             # API endpoints
├── src/components/       # React components
├── src/lib/             # Utilities and helpers
├── supabase-schema.sql  # Database setup
└── .env.local          # Your credentials (create this!)
```

## Development Tips

- **Hot Reload:** Changes auto-refresh in browser
- **TypeScript:** VS Code will show type errors
- **Console:** Check browser console for errors
- **Logs:** Check terminal for server logs

## Need Help?

1. Check the error message in terminal/browser
2. Review README.md for detailed docs
3. Verify environment variables are set
4. Make sure Supabase schema is installed

---

**Ready to customize?** Start editing files in `src/app/` and `src/components/`!

**Want to deploy?** See `DEPLOYMENT.md` for Vercel deployment guide.

**Building features?** Check `PROJECT_SUMMARY.md` for the full feature list and architecture.

