# ⏰ Setup Auto-Send (Works Even When Page is Closed)

## 🎯 Two Solutions

### **Solution 1: For Production (Vercel) - Automatic ✅**

When you deploy to Vercel, it works automatically!

The `vercel.json` file I created includes:
```json
{
  "crons": [{
    "path": "/api/cron/send-scheduled",
    "schedule": "* * * * *"
  }]
}
```

**What this does:**
- ✅ Runs **every 1 minute** automatically
- ✅ Works **24/7** even with zero visitors
- ✅ Server-side execution
- ✅ No configuration needed

**Just deploy to Vercel and it works!**

---

### **Solution 2: For Local Development - Use External Cron**

Since you're testing locally, you need an external service to call your cron endpoint.

---

## 🚀 **Local Development Setup (3 Options)**

### **Option A: Use cron-job.org (Easiest)**

1. **Go to** https://cron-job.org/en/
2. **Sign up** for free account
3. **Create new cron job:**
   - Title: "KickerPro Auto-Send"
   - URL: `http://localhost:3000/api/cron/send-scheduled`
   - Schedule: Every 1 minute
   - **NOTE**: This only works if your localhost is publicly accessible

**Problem**: `localhost:3000` is not publicly accessible!

---

### **Option B: Use ngrok + cron-job.org (Recommended)**

Make your local server publicly accessible:

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start your dev server:**
   ```bash
   npm run dev
   ```

3. **In new terminal, run ngrok:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

5. **Set up cron-job.org:**
   - URL: `https://abc123.ngrok.io/api/cron/send-scheduled`
   - Schedule: Every 1 minute
   - Save

**Now auto-send works even when page is closed!**

---

### **Option C: PowerShell Script (Windows)**

Create a local PowerShell script that runs every minute:

**File: `auto-send-cron.ps1`**
```powershell
# Run this to start auto-send in background
while ($true) {
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] Checking for scheduled messages..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/cron/send-scheduled" -Method Get
        
        if ($response.dispatched -gt 0) {
            Write-Host "[$time] ✅ Sent $($response.dispatched) message(s)!" -ForegroundColor Green
        } else {
            Write-Host "[$time] No messages due" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "[$time] ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Wait 60 seconds
    Start-Sleep -Seconds 60
}
```

**To run:**
```powershell
.\auto-send-cron.ps1
```

**Keep this PowerShell window open** while developing!

---

## 🎯 **Recommended Approach**

### **For Local Testing:**
Just **keep the Scheduled Messages page open** - it's the simplest!
- ✅ No setup needed
- ✅ Works immediately
- ✅ See logs in browser console

### **For Production:**
Deploy to Vercel - cron runs automatically!
- ✅ No page needs to be open
- ✅ Runs every 1 minute 24/7
- ✅ Fully automated

---

## 🧪 **Quick Test Without Page Open**

To test the cron endpoint directly:

### **Manual Test:**

Visit in browser:
```
http://localhost:3000/api/cron/send-scheduled
```

This will:
- ✅ Check for due messages
- ✅ Send them immediately
- ✅ Show results

Example response:
```json
{
  "success": true,
  "dispatched": 1,
  "failed": 0,
  "results": [
    {
      "id": "msg-123",
      "title": "Auto-send test",
      "status": "sent",
      "sent": 1,
      "failed": 0
    }
  ]
}
```

---

## 📊 **Comparison**

| Method | Page Open? | Setup | Production? |
|--------|-----------|-------|-------------|
| **Client-side (current)** | Yes ✅ | None | No |
| **PowerShell script** | No ❌ | Easy | No |
| **ngrok + cron-job.org** | No ❌ | Medium | No |
| **Vercel Cron** | No ❌ | None | Yes ✅ |

---

## 🎉 **Recommendation**

### **For Now (Local Development):**

Use the **PowerShell script** I provided above:

1. **Create file**: `auto-send-cron.ps1`
2. **Copy** the PowerShell code above
3. **Run**: `.\auto-send-cron.ps1`
4. **Keep window open** while developing
5. **Messages auto-send** even with browser closed!

### **For Production:**

Just **deploy to Vercel**:
- ✅ `vercel.json` already created
- ✅ Cron runs automatically
- ✅ Works 24/7
- ✅ No page needs to be open

---

## 🚀 **Quick Start (PowerShell)**

Want it working right now without page open?

1. **Create** `auto-send-cron.ps1` in your project root
2. **Paste** the PowerShell code above
3. **Run**:
   ```powershell
   .\auto-send-cron.ps1
   ```
4. **Keep terminal open**
5. **Schedule a message**
6. **Close browser completely**
7. **Wait for scheduled time**
8. **Check PowerShell** - you'll see it send!

---

**Want me to create the PowerShell script file for you?** I can make it ready to run! 🎯



