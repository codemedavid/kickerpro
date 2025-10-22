# Deployment Checklist for Facebook Bulk Messenger

## Pre-Deployment Checklist

### 1. Environment Variables ✓
- [ ] Set up all environment variables in production
- [ ] Verify Supabase URL and keys
- [ ] Verify Facebook App ID and Secret
- [ ] Set production webhook verify token
- [ ] Set production app URL

### 2. Database Setup ✓
- [ ] Run `supabase-schema.sql` in Supabase SQL Editor
- [ ] Verify all tables are created
- [ ] Verify RLS policies are enabled
- [ ] Test database connections

### 3. Facebook App Configuration ✓
- [ ] Add production domain to OAuth redirect URIs
- [ ] Configure webhook URL with production domain
- [ ] Subscribe to required webhook events
- [ ] Submit app for review (if needed)
- [ ] Verify permissions are approved

### 4. Code Quality ✓
- [ ] Run `npm run lint` - fix all errors
- [ ] Run `npm run build` - verify build succeeds
- [ ] Test all routes locally
- [ ] Verify no console errors

### 5. Security ✓
- [ ] Remove all test/debug code
- [ ] Verify .env files are in .gitignore
- [ ] Check for exposed API keys
- [ ] Review RLS policies
- [ ] Enable rate limiting if needed

## Deploying to Vercel

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: Next.js
   - Root Directory: `./` (or your nextjs-app directory)
   - Build Command: `npm run build`
   - Output Directory: `.next`

### Step 3: Environment Variables

Add these in Vercel project settings:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
NEXT_PUBLIC_FACEBOOK_APP_VERSION=v18.0
WEBHOOK_VERIFY_TOKEN=
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### Step 4: Deploy

1. Click "Deploy"
2. Wait for deployment to complete
3. Note your deployment URL

### Step 5: Post-Deployment

1. **Update Facebook App Settings:**
   ```
   OAuth Redirect URIs:
   - https://your-domain.vercel.app/api/auth/callback
   
   Webhook URL:
   - https://your-domain.vercel.app/api/webhook
   ```

2. **Test Webhook:**
   ```bash
   curl -X GET "https://your-domain.vercel.app/api/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
   ```
   Should return: `test123`

3. **Test Authentication:**
   - Visit your deployed site
   - Click "Continue with Facebook"
   - Verify login works
   - Check dashboard loads

4. **Test Messaging:**
   - Connect a Facebook page
   - Try composing a message
   - Verify database updates

## Custom Domain Setup

### 1. Add Domain in Vercel
1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed

### 2. Update Environment Variables
```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 3. Update Facebook App
- Update OAuth redirect URIs with new domain
- Update webhook URL with new domain

## Monitoring & Maintenance

### Set Up Monitoring
1. Enable Vercel Analytics
2. Set up error tracking (optional: Sentry)
3. Monitor Supabase usage
4. Monitor Facebook API usage

### Regular Maintenance
- [ ] Review error logs weekly
- [ ] Monitor API rate limits
- [ ] Check database performance
- [ ] Update dependencies monthly
- [ ] Review security policies quarterly

## Rollback Plan

If deployment fails:

1. **Vercel:** Use "Redeploy" with previous deployment
2. **Database:** Keep backups of Supabase data
3. **Code:** Maintain git history for rollbacks

## Troubleshooting

### Build Fails
```bash
# Locally test build
npm run build

# Check logs in Vercel
# Fix errors and redeploy
```

### Authentication Issues
- Verify all environment variables are set
- Check Facebook App settings
- Review Supabase auth configuration

### Webhook Not Working
- Test webhook endpoint manually
- Check Vercel function logs
- Verify webhook verify token matches

### Database Connection Issues
- Verify Supabase URL and keys
- Check RLS policies
- Review Supabase logs

## Performance Optimization

### After Deployment
- [ ] Enable Vercel Edge Caching
- [ ] Optimize images (use Next.js Image)
- [ ] Enable Vercel Speed Insights
- [ ] Monitor Core Web Vitals
- [ ] Set up CDN for static assets

### Database Optimization
- [ ] Add indexes for frequent queries
- [ ] Enable Supabase connection pooling
- [ ] Monitor query performance
- [ ] Set up database backups

## Security Checklist

- [ ] Enable Vercel's security headers
- [ ] Set up CORS properly
- [ ] Implement rate limiting
- [ ] Enable Supabase RLS
- [ ] Regular security audits
- [ ] Keep dependencies updated

## Success Metrics

Track these after deployment:
- Uptime percentage
- Average response time
- Error rate
- User authentication success rate
- Message delivery rate
- Database query performance

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review Supabase logs
3. Check Facebook App Dashboard
4. Review this checklist
5. Contact support if needed

---

**Last Updated:** [Current Date]
**Deployment Status:** [Ready/In Progress/Complete]

