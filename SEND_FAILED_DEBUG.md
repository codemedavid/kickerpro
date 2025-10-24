# 🔧 Send Failed - Debug Guide

## 🎯 Your Issue

**Symptoms:**
- Progress shows: 20 sent, 20 failed, 0 pending
- Message: "Send Failed - There was an error sending your message"
- All messages marked as failed immediately

---

## 🔍 Root Causes

### 1. **24-Hour Messaging Window** (Most Common)
Facebook restricts messages to users who haven't interacted with your page in 24 hours.

**Error Code:** `10` with subcode `2018278`

**Solution:** Use message tags (like `ACCOUNT_UPDATE`)

### 2. **Expired Access Token**
Your Facebook access token has expired.

**Error Code:** `190`

**Solution:** Logout and login again

### 3. **Invalid Recipient ID**
The recipient ID is incorrect or the user blocked your page.

**Error Code:** `100`

**Solution:** Sync conversations again

### 4. **App Permissions**
Your Facebook app doesn't have required permissions.

**Error Code:** `200`

**Solution:** Check Facebook app settings

---

## 🧪 Step-by-Step Debugging

### Step 1: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors like:

```
[Send API] Facebook error: { code: 10, error_subcode: 2018278 }
```

**If you see this:** It's the 24-hour policy. Use message tags.

### Step 2: Test with Node.js

Run this test to see the exact error:

```bash
cd nextjs-app

# Get your access token and recipient ID from database first
# Then run:
node test-send-simple.js "YOUR_ACCESS_TOKEN" "RECIPIENT_ID"
```

**How to get values:**

1. **Access Token:** Go to Supabase → Table Editor → `facebook_pages` → copy `access_token`
2. **Recipient ID:** Go to Supabase → Table Editor → `messenger_conversations` → copy `sender_id`

### Step 3: Check Database

**In Supabase SQL Editor, run:**

```sql
-- Check if page access token exists
SELECT 
  name,
  facebook_page_id,
  LEFT(access_token, 20) || '...' as token_preview,
  LENGTH(access_token) as token_length
FROM facebook_pages
LIMIT 5;

-- Check if conversations exist
SELECT 
  sender_name,
  sender_id,
  last_message_time,
  conversation_status
FROM messenger_conversations
LIMIT 5;

-- Check failed message details
SELECT 
  id,
  title,
  status,
  error_message,
  delivered_count,
  recipient_count
FROM messages
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 5;
```

### Step 4: Check API Logs

**In your terminal where `npm run dev` is running:**

Look for lines like:
```
[Send API] Facebook error: ...
[Send API] Error sending to recipient: ...
```

---

## ✅ Quick Fixes

### Fix 1: Enable Message Tags (Recommended)

**Update your compose page to always use ACCOUNT_UPDATE:**

The app already supports this! Just ensure you're selecting a message tag in the UI.

### Fix 2: Refresh Access Token

**Logout and login again:**

1. Click your profile → Logout
2. Login with Facebook again
3. This refreshes the access token

### Fix 3: Check Message Tag in Code

**Ensure the send API is using the tag:**

File: `src/app/api/messages/[id]/send/route.ts`

```typescript
// Should have:
const result = await sendFacebookMessage(
  page.facebook_page_id,
  recipientId,
  message.content,
  page.access_token,
  message.message_tag || 'ACCOUNT_UPDATE' // ← Use default tag
);
```

---

## 🧪 Test Scripts Created

### 1. `test-send-simple.js`
Quick test with no dependencies.

**Usage:**
```bash
node test-send-simple.js "YOUR_TOKEN" "RECIPIENT_ID"
```

**What it does:**
- Tests sending WITHOUT message tag
- Tests sending WITH message tag
- Shows exact error codes
- Suggests fixes

### 2. `test-facebook-send.js`
Detailed test with analysis.

**Usage:**
```bash
node test-facebook-send.js "TOKEN" "RECIPIENT" [TAG]
```

### 3. `test-send-debug.js`
Automated testing (requires setup).

**Usage:**
```bash
# Install dotenv first
npm install dotenv

# Then run
node test-send-debug.js
```

---

## 🎯 Most Likely Fix

Based on your error (all 20 failed immediately), it's probably the **24-hour messaging window**.

### Solution:

1. **Option A: Use Message Tags (Recommended)**

   In the compose page, select "ACCOUNT_UPDATE" as the message tag.

2. **Option B: Update Default Tag**

   Edit `src/app/api/messages/[id]/send/route.ts`:

   ```typescript
   // Line ~35, change:
   const result = await sendFacebookMessage(
     page.facebook_page_id,
     recipientId,
     message.content,
     page.access_token,
     message.message_tag || 'ACCOUNT_UPDATE' // Always use tag as default
   );
   ```

3. **Option C: Test First**

   Run the test script to confirm:
   ```bash
   node test-send-simple.js "YOUR_TOKEN" "RECIPIENT_ID"
   ```

   If "Test 2" (with tag) works, then use tags for all sends!

---

## 📊 Error Code Reference

| Code | Subcode | Meaning | Fix |
|------|---------|---------|-----|
| 10 | 2018278 | 24-hour policy | Use message tags |
| 190 | - | Token expired | Logout & login again |
| 200 | - | Permission denied | Check app settings |
| 100 | - | Invalid parameter | Check recipient ID |
| 551 | - | User not reachable | User blocked page |

---

## 🔍 Check These

- [ ] ✅ Access token exists in `facebook_pages` table
- [ ] ✅ Recipient IDs exist in `messenger_conversations` table
- [ ] ✅ Message tag is set (ACCOUNT_UPDATE)
- [ ] ✅ Page access token is not expired
- [ ] ✅ App has `pages_messaging` permission
- [ ] ✅ Run test script to get exact error

---

## 🆘 Still Not Working?

1. **Run the test script:**
   ```bash
   node test-send-simple.js "TOKEN" "RECIPIENT"
   ```

2. **Copy the error output**

3. **Check the error code in the table above**

4. **Apply the suggested fix**

---

## 💡 Pro Tips

1. **Always use message tags** for bulk sends to avoid 24-hour policy
2. **Test with 1 recipient** before sending to many
3. **Check browser console** for detailed errors
4. **Refresh access tokens** regularly (logout/login)
5. **Verify app permissions** in Facebook Developer Portal

---

## ✅ Next Steps

1. Run: `node test-send-simple.js "TOKEN" "RECIPIENT"`
2. Note which test passes (Test 1 or Test 2)
3. If Test 2 passes: Use message tags for all sends
4. If both fail: Check error code and apply fix
5. Try sending again from dashboard

**Need more help? Share the output of the test script!** 📋

