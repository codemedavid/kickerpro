# 🔄 Trigger Vercel Deployment Manually

## Create a Deploy Hook in Vercel

### **Step 1: Create the Hook**

1. Go to: https://vercel.com/codemedavid/kickerpro/settings/git
2. Scroll to **"Deploy Hooks"**
3. Click **"Create Hook"**
4. Enter:
   - **Name:** Manual Deploy
   - **Branch:** main
5. Click **"Create Hook"**
6. **Copy the webhook URL** (looks like: `https://api.vercel.com/v1/integrations/deploy/...`)

### **Step 2: Use the Hook**

Open PowerShell or Terminal and run:

```bash
curl -X POST "YOUR_WEBHOOK_URL_HERE"
```

Or use this PowerShell command:
```powershell
Invoke-WebRequest -Uri "YOUR_WEBHOOK_URL_HERE" -Method POST
```

This will instantly trigger a deployment!

---

## Alternative: Use This Script

Save the webhook URL and use this command anytime:

```bash
# Save your webhook URL
$DEPLOY_HOOK = "your_webhook_url_here"

# Trigger deployment
curl -X POST $DEPLOY_HOOK

# Or in PowerShell
Invoke-WebRequest -Uri $DEPLOY_HOOK -Method POST
```

---

## Bookmark This

Keep the webhook URL handy. Anytime you want to deploy:
1. Run the curl/PowerShell command
2. Wait 2-3 minutes
3. Check Vercel dashboard for new deployment

Easy! 🚀

