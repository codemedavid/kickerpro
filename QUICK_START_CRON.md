# ⚡ Quick Start: Auto-Send Scheduled Messages

## 🎯 What You Need

For scheduled messages to send automatically, you need a cron job that runs every minute.

---

## 🚀 Easiest Setup (Local Development)

### **Option 1: Use the Script I Created**

**Step 1: Add Secret to .env.local**

```bash
# Add this line to .env.local
echo "CRON_SECRET=test_secret_123" >> .env.local
echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> .env.local
```

**Step 2: Start Dev Server (if not running)**

```bash
cd nextjs-app
npm run dev
```

**Step 3: Run Cron Script (in new terminal)**

```bash
cd nextjs-app
node run-cron-local.js
```

**You'll see:**
```
🕐 Starting local cron job runner...
📍 URL: http://localhost:3000/api/cron/send-scheduled
⏱️  Interval: Every 60 seconds
⚡ Press Ctrl+C to stop

[10:30:15] Run #1 - Checking for scheduled messages...
💤 No messages due to send

[10:31:15] Run #2 - Checking for scheduled messages...
✅ Found 1 message(s) to send
📨 Sent: 1, Failed: 0
   1. ✅ "Weekly Update" - Sent: 95, Failed: 5
```

**Leave this running!** It will check every minute and send due messages.

---

## 🧪 Test It Now

### **Quick Test (5 minutes):**

1. **Terminal 1:** Run dev server
   ```bash
   npm run dev
   ```

2. **Terminal 2:** Run cron
   ```bash
   node run-cron-local.js
   ```

3. **Browser:** Go to `/dashboard/compose`
   - Title: "Test Auto Send"
   - Content: "Testing automatic sending"
   - Message Type: "Schedule"
   - Date: Today
   - Time: **3 minutes from now**

4. **Click:** "Schedule Message"

5. **Go to:** `/dashboard/scheduled`
   - ✅ See your message

6. **Watch cron terminal:**
   ```
   [10:33:00] Run #3 - Checking...
   💤 No messages due
   
   [10:34:00] Run #4 - Checking...
   💤 No messages due
   
   [10:35:00] Run #5 - Checking...  ← Time reached!
   ✅ Found 1 message to send
   📨 Sent: 1, Failed: 0
   ```

7. **Refresh browser**
   - Message disappears from Scheduled
   - ✅ Appears in History tab!

---

## 🎯 Production Setup (Vercel)

### **When You Deploy:**

1. **Already configured!** (I created `vercel.json`)

2. **Add environment variables in Vercel:**
   - Settings → Environment Variables
   - Add: `CRON_SECRET=your_random_secret`
   - Add: `NEXT_PUBLIC_APP_URL=https://your-app.vercel.app`

3. **Deploy:**
   ```bash
   git push
   ```

4. ✅ **Done!** Vercel runs cron automatically every minute

**No need to do anything else!**

---

## 📊 What Happens

### **Every Minute:**

```
Cron job runs
   ↓
Checks database: "Any messages where scheduled_for <= NOW()?"
   ↓
If YES:
   ├─ Call /api/messages/[id]/send
   ├─ Send in batches (100 per batch)
   ├─ Update status to 'sent'
   ├─ Log activity
   └─ Message moves to History tab

If NO:
   └─ "No messages due" → Wait 1 minute → Check again
```

---

## ⚠️ Important

### **Keep Cron Running During Development:**

```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Cron runner (keep this running!)
node run-cron-local.js

# Leave both running while testing scheduled messages
```

### **In Production (Vercel):**

No need to run anything! Vercel handles it automatically via `vercel.json`.

---

## ✅ Complete Setup Checklist

**Local Development:**
- [ ] Add `CRON_SECRET` to `.env.local`
- [ ] Add `NEXT_PUBLIC_APP_URL` to `.env.local`
- [ ] Run `npm run dev` (Terminal 1)
- [ ] Run `node run-cron-local.js` (Terminal 2)
- [ ] Keep both running
- [ ] Test by scheduling message for 2 minutes from now

**Production (Vercel):**
- [ ] Add env vars in Vercel Dashboard
- [ ] Deploy (vercel.json included)
- [ ] Check Functions → Cron in Vercel
- [ ] Test by scheduling message
- [ ] Wait for scheduled time
- [ ] Check History tab

---

## 🎉 Summary

**Problem:** Scheduled messages don't send automatically  
**Solution:** Cron job checks every minute and sends due messages  
**Local:** Run `node run-cron-local.js`  
**Production:** Vercel handles automatically  

**Files Created:**
- ✅ `/api/cron/send-scheduled/route.ts`
- ✅ `vercel.json`
- ✅ `run-cron-local.js`

**Next Steps:**
1. Add CRON_SECRET to .env.local
2. Run: `node run-cron-local.js`
3. Schedule a test message
4. ✅ Watch it send automatically!

**Your scheduled messages now send automatically!** 🚀

