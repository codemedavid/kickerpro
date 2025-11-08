# 🔍 AI Setup Verification & Troubleshooting

## ⚠️ Issue: AI Not Working or Not Active

Let me help you verify the AI is properly set up and working.

---

## ✅ Step-by-Step Verification

### **1. Check if Server is Running**

Open a new terminal and run:
```bash
npm run dev
```

Wait for:
```
✓ Ready in 3s
Local: http://localhost:3000
```

**If server doesn't start:**
- Check if port 3000 is already in use
- Try: `taskkill /F /IM node.exe` then `npm run dev`

---

### **2. Verify OpenRouter API Keys**

**Check your `.env.local` file exists:**
```bash
# In project root directory
ls .env.local
```

**Your `.env.local` should have:**
```env
OPENROUTER_API_KEY_1=sk-or-v1-your-key-here
OPENROUTER_API_KEY_2=sk-or-v1-your-backup-key-here
```

**If keys are missing:**

1. Go to https://openrouter.ai/keys
2. Create API key(s)
3. Add to `.env.local`:
   ```env
   OPENROUTER_API_KEY_1=sk-or-v1-YOUR-ACTUAL-KEY
   OPENROUTER_API_KEY_2=sk-or-v1-YOUR-BACKUP-KEY
   ```
4. Restart server: `Ctrl+C` then `npm run dev`

---

### **3. Test AI Endpoint**

**Option A: Use Browser**

Go to:
```
http://localhost:3000/api/ai/test
```

**Expected Response:**
```json
{
  "status": "ready",
  "keysConfigured": true,
  "model": "openai/gpt-4o"
}
```

**If you see:**
```json
{
  "status": "no_keys",
  "keysConfigured": false
}
```
→ API keys are NOT configured! Go back to Step 2.

---

**Option B: Test from Compose Page**

1. Go to: `http://localhost:3000/dashboard/compose`
2. Select a Facebook page
3. Select 1-2 contacts
4. Add test instructions:
   ```
   Write a short test message saying hello.
   ```
5. Click "Generate AI Messages"
6. Wait 10-20 seconds

**If it works:** You'll see generated messages
**If it doesn't work:** Check browser console (F12) for errors

---

### **4. Check Browser Console for Errors**

**Press F12 in your browser**

**Look for errors like:**

❌ `POST /api/ai/generate-follow-ups 500`
→ Server error, check server terminal

❌ `POST /api/ai/generate-follow-ups 404`
→ Endpoint not found, restart server

❌ `Failed to fetch`
→ Server not running

❌ `No API keys configured`
→ Add keys to `.env.local`

---

### **5. Check Server Terminal for Logs**

**Look for these logs when generating:**

✅ **Good Logs:**
```
[AI Generate] API called
[AI Generate] Request: { conversationIds: 2, pageId: '...' }
[AI Generate] Using page: { name: 'My Page' }
[AI Generate] Processing 2 conversations
[AI Generate] ✅ Got 5 conversation messages for John
[OpenRouter] Calling API with model: openai/gpt-4o
[OpenRouter] Generated message for John Doe
```

❌ **Bad Logs:**
```
[OpenRouter] No API keys configured
[OpenRouter] API error: 401 Unauthorized
[AI Generate] Error: No pages found
[AI Generate] Error: Failed to fetch conversations
```

---

## 🚨 Common Issues & Solutions

### **Issue 1: "No API keys configured"**

**Problem:** `.env.local` missing or keys not set

**Solution:**
```bash
# Create .env.local in project root
# Add these lines:
OPENROUTER_API_KEY_1=sk-or-v1-YOUR-KEY-HERE
OPENROUTER_API_KEY_2=sk-or-v1-YOUR-BACKUP-KEY

# Restart server
npm run dev
```

---

### **Issue 2: "Page not found"**

**Problem:** No Facebook page connected or selected

**Solution:**
1. Go to `/dashboard/pages`
2. Connect a Facebook page
3. Go back to compose
4. Select that page from dropdown

---

### **Issue 3: "No conversations found"**

**Problem:** No conversation history for selected contacts

**Solution:**
1. Go to `/dashboard/conversations`
2. Select your page
3. Click "Sync from Facebook"
4. Wait for sync to complete
5. Try AI generation again

---

### **Issue 4: Server keeps crashing**

**Problem:** Syntax error or dependency issue

**Solution:**
```bash
# Kill all node processes
taskkill /F /IM node.exe

# Clean install
rm -r node_modules
rm package-lock.json
npm install

# Restart
npm run dev
```

---

### **Issue 5: AI returns errors**

**Problem:** OpenRouter API issues

**Check:**
1. API keys are valid (not expired)
2. OpenRouter account has credits
3. No rate limits hit

**Test API key:**
```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer YOUR-API-KEY"
```

Should return list of models.

---

## 🧪 Quick Test Procedure

**1. Start Server:**
```bash
npm run dev
```

**2. Test Endpoint:**
```bash
# In browser:
http://localhost:3000/api/ai/test
```

**3. Check Response:**
```json
{
  "status": "ready",
  "keysConfigured": true
}
```

**4. Test Generation:**
- Go to compose page
- Select page + contacts
- Add simple instruction: "Write hello"
- Generate
- Check for results

**If ALL steps pass → AI is working!** ✅

---

## 📋 Verification Checklist

Before asking "AI not working", verify:

- [ ] Server is running (`npm run dev`)
- [ ] No errors in server terminal
- [ ] `.env.local` exists with API keys
- [ ] Facebook page connected
- [ ] Conversations synced
- [ ] Browser console shows no errors
- [ ] Test endpoint returns "ready"

**If all checked → AI should work!**

---

## 🔧 Manual Test

**Create test file: `test-ai.js`**

```javascript
const fetch = require('node-fetch');

async function testAI() {
  const apiKey = 'YOUR-OPENROUTER-KEY';
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [
        { role: 'user', content: 'Say hello in JSON format' }
      ],
      response_format: { type: 'json_object' }
    })
  });
  
  const data = await response.json();
  console.log(data);
}

testAI();
```

**Run:**
```bash
node test-ai.js
```

**Should return AI response.**

---

## 🎯 Most Likely Causes

**90% of "AI not working" issues are:**

1. **Server not running** (50%)
   → Solution: `npm run dev`

2. **API keys missing** (30%)
   → Solution: Add to `.env.local`

3. **No page/conversations selected** (10%)
   → Solution: Connect page, sync conversations

4. **Browser cache** (10%)
   → Solution: Hard refresh `Ctrl+Shift+R`

---

## ✅ How to Confirm AI is Active

**Test sequence:**

```bash
# 1. Server running?
npm run dev
→ Should show "Ready"

# 2. Test endpoint working?
curl http://localhost:3000/api/ai/test
→ Should show {"status":"ready"}

# 3. API keys valid?
# Check .env.local has keys starting with sk-or-v1-

# 4. Generate test?
# Go to compose, select contacts, generate
→ Should show AI messages
```

**If all pass → AI is 100% working!** ✅

---

## 🚀 Quick Fix Command

**Run this to fix most issues:**

```bash
# Kill processes
taskkill /F /IM node.exe

# Wait
timeout /t 2

# Start fresh
npm run dev
```

Then:
1. Hard refresh browser (`Ctrl+Shift+R`)
2. Go to compose page
3. Try generating

---

## 📞 Need Help?

**Check these logs in order:**

1. **Browser Console (F12)**
   → Any red errors?

2. **Server Terminal**
   → Any error messages?

3. **Network Tab (F12 → Network)**
   → Is `/api/ai/generate-follow-ups` returning 200?

**Share these with me if still not working!**

---

**Current Status:**
- ✅ Server starting
- ⏳ Waiting for "Ready" message
- 📋 Follow steps above to verify

**Server should be ready in 30 seconds!** 🚀




