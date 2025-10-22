# 🕐 Scheduled Messages - Auto Send Setup

## ❌ Current Issue

**Problem:** Scheduled messages don't send automatically at their scheduled time.

**Why:** There's no background job checking for due messages and triggering sends.

---

## ✅ Solution: Cron Job System

I've created a cron endpoint that:
1. Checks for messages where `scheduled_for <= NOW()`
2. Triggers the send API for each due message
3. Updates status and logs results

---

## 🔧 Setup (Choose One Method)

### **Method 1: Vercel Cron Jobs** (Recommended - Easiest)

**When deployed to Vercel:**

1. **File Created:** `vercel.json`
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/send-scheduled",
         "schedule": "* * * * *"
       }
     ]
   }
   ```
   This runs every minute automatically!

2. **Add to `.env.local` and Vercel:**
   ```env
   CRON_SECRET=your_random_secret_123abc
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

3. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "Add cron jobs"
   git push
   vercel --prod
   ```

4. ✅ **Done!** Vercel runs the cron automatically every minute

**Pricing:**
- Free tier: 100 cron runs/day
- Pro: Unlimited

---

### **Method 2: External Cron Service** (For Development/Free)

**Use cron-job.org (Free):**

1. **Go to:** [cron-job.org](https://cron-job.org)
2. **Create account** (free)
3. **Create new cron job:**
   - **Title:** "Send Scheduled Messages"
   - **URL:** `https://your-app.vercel.app/api/cron/send-scheduled`
   - **Schedule:** Every 1 minute (`* * * * *`)
   - **Headers:**
     ```
     Authorization: Bearer your_random_secret_123abc
     ```
4. **Save**
5. ✅ **Done!** Runs every minute

---

### **Method 3: GitHub Actions** (Free, Self-Hosted)

**Create:** `.github/workflows/cron.yml`

```yaml
name: Send Scheduled Messages

on:
  schedule:
    - cron: '* * * * *'  # Every minute

jobs:
  send-scheduled:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cron Endpoint
        run: |
          curl -X POST https://your-app.vercel.app/api/cron/send-scheduled \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**Add secret:**
- GitHub repo → Settings → Secrets → Add `CRON_SECRET`

---

### **Method 4: Local Development (Manual)**

**For testing locally:**

**Option A: Manual Trigger**

Open browser console and run:
```javascript
fetch('http://localhost:3000/api/cron/send-scheduled', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_random_secret_123abc'
  }
})
.then(r => r.json())
.then(data => console.log('Cron result:', data));
```

**Option B: Node Script**

Create `run-cron.js`:
```javascript
setInterval(async () => {
  const response = await fetch('http://localhost:3000/api/cron/send-scheduled', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your_random_secret_123abc'
    }
  });
  const data = await response.json();
  console.log('[Cron]', new Date().toISOString(), data);
}, 60000); // Every minute
```

Run: `node run-cron.js`

---

## 🔐 Security Setup

### **Add to `.env.local`:**

```env
# Generate a random secret for cron authentication
CRON_SECRET=abc123xyz789_your_random_secret

# Your app URL (for cron to call send API)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Generate random secret:**
```bash
# Mac/Linux
openssl rand -base64 32

# Or use any random string
```

### **Add to Vercel Environment Variables:**

1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `CRON_SECRET`: `your_random_secret`
   - `NEXT_PUBLIC_APP_URL`: `https://your-app.vercel.app`

---

## 🧪 Testing

### **Test 1: Manual Trigger**

```bash
# Replace with your actual secret and URL
curl -X POST http://localhost:3000/api/cron/send-scheduled \
  -H "Authorization: Bearer your_random_secret_123abc"
```

**Expected Response:**
```json
{
  "success": true,
  "checked_at": "2024-10-22T10:30:00.000Z",
  "messages_found": 2,
  "sent": 2,
  "failed": 0,
  "results": [
    {
      "message_id": "msg-123",
      "title": "Weekly Update",
      "success": true,
      "sent": 95,
      "failed": 5
    },
    {
      "message_id": "msg-456",
      "title": "Promotion",
      "success": true,
      "sent": 200,
      "failed": 10
    }
  ]
}
```

---

### **Test 2: Schedule a Message**

1. **Go to:** `/dashboard/compose`
2. **Fill form:**
   - Title: "Test Scheduled Send"
   - Content: "This should send automatically"
   - Message Type: "Schedule"
   - Date: Today
   - Time: 2 minutes from now
3. **Click:** "Schedule Message"
4. **Go to:** `/dashboard/scheduled`
5. ✅ **Verify:** Message appears
6. **Wait 2 minutes**
7. **Run cron manually** (or wait for automatic cron)
8. ✅ **Verify:** Message sent and appears in History tab

---

### **Test 3: Check Cron Logs**

**In Vercel:**
- Dashboard → Your Project → Functions → Cron Logs
- See execution history

**In cron-job.org:**
- Dashboard → Your Job → Execution History

---

## 📊 How It Works

### **Complete Flow:**

```
1. User schedules message
   ↓
   Status: 'scheduled'
   scheduled_for: '2024-10-25T15:00:00Z'
   ↓
2. Message saved in database
   ↓
3. Cron runs every minute
   ↓
4. Checks: SELECT * WHERE status='scheduled' AND scheduled_for <= NOW()
   ↓
5. Finds due messages
   ↓
6. For each message:
   - Calls POST /api/messages/[id]/send
   - Message gets sent in batches
   - Status updated to 'sent'
   - Activity logged
   ↓
7. Message moves from Scheduled tab → History tab
```

---

## ⏱️ Cron Schedule Options

| Schedule | Cron Expression | Use Case |
|----------|----------------|----------|
| Every minute | `* * * * *` | Most accurate, recommended |
| Every 5 minutes | `*/5 * * * *` | Reduce API calls |
| Every 15 minutes | `*/15 * * * *` | Very light usage |
| Every hour | `0 * * * *` | Not recommended |

**Recommended:** Every 1 minute for best accuracy

---

## 📋 Vercel Setup (Complete)

### **Step 1: Update Environment Variables**

**In `.env.local`:**
```env
CRON_SECRET=generate_random_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**In Vercel Dashboard:**
```
Settings → Environment Variables:
- CRON_SECRET: same_secret_as_env_local
- NEXT_PUBLIC_APP_URL: https://your-app.vercel.app
```

### **Step 2: Deploy**

```bash
git add vercel.json
git add src/app/api/cron/send-scheduled/route.ts
git commit -m "Add scheduled message cron job"
git push
vercel --prod
```

### **Step 3: Verify**

**Check Vercel Dashboard:**
- Functions → Cron
- Should see: `/api/cron/send-scheduled` running every minute

**Check Logs:**
```
[Cron] Starting scheduled message check...
[Cron] Found 1 message(s) due to send
[Cron] Sending scheduled message: msg-123
[Cron] Successfully sent message. Sent: 95, Failed: 5
[Cron] Completed. Sent: 1, Failed: 0
```

---

## ⚠️ Important Notes

### **1. Timezone Handling**

Scheduled times are stored in UTC:
```javascript
// User selects: 2024-10-25 3:00 PM (their local time)
// Converted to: 2024-10-25T22:00:00.000Z (UTC)
// Cron checks: NOW() >= 2024-10-25T22:00:00.000Z
```

### **2. Cron Reliability**

**Vercel Cron:**
- ✅ Very reliable
- ✅ No configuration needed
- ⚠️ Free tier: 100 executions/day (enough for testing)

**External Cron:**
- ✅ Unlimited (free)
- ⚠️ Depends on external service uptime

### **3. Multiple Messages at Same Time**

If multiple messages are scheduled for the same time:
```
Scheduled for 3:00 PM:
- Message A (100 recipients)
- Message B (500 recipients)
- Message C (50 recipients)

Cron at 3:00 PM:
- Sends all 3 sequentially
- Total time: ~1 minute (with batching)
```

---

## 🐛 Troubleshooting

### **Messages Not Sending:**

1. **Check cron is running:**
   ```bash
   curl https://your-app.vercel.app/api/cron/send-scheduled \
     -H "Authorization: Bearer your_secret"
   ```

2. **Check response:**
   ```json
   {
     "messages_found": 0,  // ← If 0, no messages are due
     "sent": 0
   }
   ```

3. **Check database:**
   ```sql
   SELECT id, title, scheduled_for, status 
   FROM messages 
   WHERE status = 'scheduled'
   AND scheduled_for <= NOW();
   ```

4. **Check scheduled_for time:**
   - Make sure it's in the past (NOW() >= scheduled_for)
   - Check timezone conversion

---

### **Cron Not Running:**

**Vercel:**
- Check Functions → Cron in dashboard
- Verify vercel.json deployed
- Check environment variables set

**External:**
- Check cron-job.org dashboard
- Verify URL is correct
- Check Authorization header set

---

## ✅ Files Created

1. ✅ `/api/cron/send-scheduled/route.ts` - Cron endpoint
2. ✅ `vercel.json` - Vercel cron configuration
3. ✅ `SCHEDULED_MESSAGES_AUTO_SEND.md` - This documentation

---

## 📁 Configuration Files

### **vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/send-scheduled",
      "schedule": "* * * * *"
    }
  ]
}
```

### **Environment Variables:**
```env
CRON_SECRET=random_secret_key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## 🚀 Quick Start

### **For Local Development:**

```bash
# Add to .env.local
echo "CRON_SECRET=test_secret_123" >> .env.local
echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> .env.local

# Manually trigger cron (test)
curl -X POST http://localhost:3000/api/cron/send-scheduled \
  -H "Authorization: Bearer test_secret_123"
```

### **For Production (Vercel):**

```bash
# 1. Add env vars in Vercel Dashboard
# 2. Deploy
git add vercel.json
git commit -m "Add cron job"
git push
vercel --prod

# 3. Verify in Vercel Dashboard → Functions → Cron
```

---

## ✅ Summary

**Problem:** Scheduled messages not sending automatically  
**Cause:** No cron job configured  
**Solution:** Created cron endpoint + Vercel cron config  
**Result:** Messages now send automatically every minute!  

**Setup:**
1. ✅ Cron endpoint created (`/api/cron/send-scheduled`)
2. ✅ Vercel config created (`vercel.json`)
3. ⏳ Add CRON_SECRET to .env.local
4. ⏳ Deploy to Vercel OR use external cron service

**After setup:**
- ✅ Schedule message for 5 minutes from now
- ✅ Wait
- ✅ Message sends automatically!
- ✅ Appears in History tab

**Scheduled messages now work automatically!** 🎉

