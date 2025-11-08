# ✅ AI Setup - Quick Check Guide

## 🚀 Server is Starting...

I just started the development server. Follow these steps to verify AI is working:

---

## ⚡ Quick Test (2 minutes)

### **Step 1: Wait for Server (30 seconds)**

Look at your terminal, wait for:
```
✓ Ready in 3s
Local: http://localhost:3000
```

---

### **Step 2: Test AI Endpoint**

**Open in your browser:**
```
http://localhost:3000/api/ai/test
```

**You should see:**
```json
{
  "status": "ready",
  "keysConfigured": true,
  "model": "openai/gpt-4o"
}
```

✅ **If you see this → AI is ACTIVE and ready!**

❌ **If you see `"keysConfigured": false` → Need to add API keys!**

---

### **Step 3: If Keys Missing - Add Them**

**Your `.env.local` file needs:**
```env
OPENROUTER_API_KEY_1=sk-or-v1-your-actual-key-here
OPENROUTER_API_KEY_2=sk-or-v1-your-backup-key-here
```

**Get your keys:**
1. Go to https://openrouter.ai/keys
2. Sign up/login
3. Create API key
4. Copy the key (starts with `sk-or-v1-`)

**Add to `.env.local`:**
```bash
# Open .env.local in your editor
# Add this line:
OPENROUTER_API_KEY_1=sk-or-v1-PASTE-YOUR-KEY-HERE
```

**Then restart:**
```bash
Ctrl+C
npm run dev
```

---

### **Step 4: Test AI Generation**

**Go to:**
```
http://localhost:3000/dashboard/compose
```

**Then:**
1. Select a Facebook page (dropdown)
2. Select 1-2 contacts
3. In "AI Instructions" box, type:
   ```
   Write a simple hello message in Taglish.
   Use: Kumusta, how are you
   ```
4. Click "✨ Generate AI Messages"
5. Wait 20 seconds

**If it works:**
- You'll see generated messages
- AI is working! ✅

**If it doesn't work:**
- Check browser console (F12)
- Check server terminal for errors
- Follow troubleshooting below

---

## 🔍 Troubleshooting

### **Problem 1: Page says "Select a page"**

**Solution:**
1. Go to `/dashboard/pages`
2. Click "Connect Facebook Page"
3. Follow Facebook login
4. Go back to compose
5. Select the page from dropdown

---

### **Problem 2: No contacts showing**

**Solution:**
1. Go to `/dashboard/conversations`
2. Select your page
3. Click "Sync from Facebook" (blue button)
4. Wait for sync to complete
5. Select contacts
6. Go to compose

---

### **Problem 3: "No pages found" error**

**Solution:**
- Make sure Facebook page is connected
- Check page is selected in dropdown
- Not "All Pages" - select specific page

---

### **Problem 4: Generate button does nothing**

**Check:**
1. Open browser console (F12)
2. Click generate button
3. Look for red errors
4. Check server terminal for errors

**Common error:**
```
POST /api/ai/generate-follow-ups 401
```
→ API keys invalid or missing

---

### **Problem 5: API keys but still not working**

**Verify key format:**
```
✅ Correct: sk-or-v1-1234567890abcdef...
❌ Wrong: YOUR-KEY-HERE
❌ Wrong: Missing sk-or-v1- prefix
```

**Test your key:**
1. Go to https://openrouter.ai/activity
2. Check if key is active
3. Check account has credits

---

## 📊 What Should Happen

### **When AI is Working Correctly:**

```
1. Click "Generate AI Messages"
   ↓
2. Button shows "Generating..." with spinner
   ↓
3. Wait 10-30 seconds (depending on # of contacts)
   ↓
4. Messages appear or navigate opens
   ↓
5. Each contact gets personalized message
   ↓
6. Messages are in specified language (Taglish)
   ↓
7. Can navigate through messages (if multiple)
   ↓
8. Can toggle "AI Personalized Bulk Send" ON
   ↓
9. Each person gets their unique AI message
```

---

## 🎯 Verification Checklist

**Before generating, verify:**

- [ ] Server is running (terminal shows "Ready")
- [ ] Can access http://localhost:3000
- [ ] `/api/ai/test` returns `"status": "ready"`
- [ ] Facebook page connected
- [ ] Page selected in compose dropdown
- [ ] At least 1 contact selected
- [ ] Instructions written (optional but recommended)

**If ALL checked → Should work!**

---

## 🚨 Still Not Working?

**Collect this info:**

1. **Test endpoint response:**
   - Go to: `http://localhost:3000/api/ai/test`
   - Copy the JSON response

2. **Browser console errors:**
   - Press F12
   - Go to Console tab
   - Copy any red errors

3. **Server terminal errors:**
   - Look at your `npm run dev` terminal
   - Copy any error messages

4. **What you see:**
   - Button does nothing?
   - Error message?
   - Infinite loading?
   - Something else?

**Share these details so I can help!**

---

## ✅ Expected Behavior

### **Test Endpoint:**
```json
{
  "status": "ready",
  "keysConfigured": true,
  "model": "openai/gpt-4o"
}
```

### **Generation Success:**
```
1. Click generate
2. Button changes to "Generating..."
3. After 10-30 seconds
4. AI panel appears with messages
5. Can navigate prev/next
6. Messages are personalized
7. In correct language
```

### **Server Logs (Good):**
```
[AI Generate] API called
[AI Generate] Request: { conversationIds: 2 }
[AI Generate] Processing 2 conversations
[AI Generate] ✅ Got 5 messages for John
[OpenRouter] Generated message for John Doe
```

---

## 🔑 API Key Setup (Detailed)

### **1. Get OpenRouter Key:**

```
1. Visit: https://openrouter.ai
2. Click "Sign Up" or "Log In"
3. Go to "API Keys" tab
4. Click "Create Key"
5. Copy the key (starts with sk-or-v1-)
6. Save it somewhere safe
```

### **2. Add to Project:**

```bash
# In project root, create/edit .env.local
# Add this line:
OPENROUTER_API_KEY_1=sk-or-v1-YOUR-ACTUAL-KEY-PASTE-HERE

# Optional: Add backup key
OPENROUTER_API_KEY_2=sk-or-v1-YOUR-BACKUP-KEY

# Save file
# Restart server: Ctrl+C then npm run dev
```

### **3. Verify:**

```
Go to: http://localhost:3000/api/ai/test
Should show: "keysConfigured": true
```

---

## 🎉 Success Indicators

**You'll know AI is working when:**

✅ Test endpoint shows "ready"
✅ Generate button shows spinner
✅ Messages appear after 10-30 seconds
✅ Messages are in specified language
✅ Each person gets unique message
✅ Can use "AI Personalized Bulk Send"

---

## 🚀 Next Steps

**Once AI is working:**

1. ✅ Test with 2 contacts first
2. ✅ Verify message quality
3. ✅ Check language adherence (Taglish)
4. ✅ Check personalization (unique per person)
5. ✅ Scale to 10+ contacts
6. ✅ Use AI Personalized Bulk Send
7. ✅ Send to unlimited contacts!

---

**Server should be ready now! Go test:**
```
http://localhost:3000/api/ai/test
```

**Then try generating in compose page!** 🎯



