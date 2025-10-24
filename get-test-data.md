# 🔑 Get Test Data for Debugging

## Quick Method: Get Values from Supabase

### Step 1: Get Access Token

**In Supabase SQL Editor:**

```sql
SELECT 
  name as page_name,
  facebook_page_id,
  access_token
FROM facebook_pages
LIMIT 1;
```

**Copy the `access_token` value**

---

### Step 2: Get Recipient ID

**In Supabase SQL Editor:**

```sql
SELECT 
  sender_name,
  sender_id,
  page_id,
  last_message_time
FROM messenger_conversations
WHERE conversation_status = 'active'
LIMIT 1;
```

**Copy the `sender_id` value**

---

### Step 3: Run Test

```bash
cd nextjs-app

node test-send-simple.js "PASTE_ACCESS_TOKEN_HERE" "PASTE_SENDER_ID_HERE"
```

---

## Example

```bash
# Your command will look like this:
node test-send-simple.js "EAABsbCS1iHgBO7fZBiGfZC..." "7234567890123456"
```

---

## Expected Output

### If 24-Hour Policy Error:

```
🧪 Testing Facebook Send API

Access Token: EAABsbCS1iHgBO7fZBiGfZC...
Recipient ID: 7234567890123456

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 1: Standard Messaging (no tag)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ FAILED!
   Status: 400
   Error Code: 10
   Error Subcode: 2018278
   Message: (#10) This message is sent outside of allowed window...

💡 This is the 24-hour policy error!
   User hasn't messaged the page in 24 hours.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 2: With ACCOUNT_UPDATE Tag
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ SUCCESS!
   Message ID: m_abc123...

🎉 Message tags work! Use ACCOUNT_UPDATE for all sends.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Solution:** Always use message tags!

---

### If Token Expired:

```
❌ FAILED!
   Status: 400
   Error Code: 190
   Message: Error validating access token...

💡 Access token expired!
   User needs to logout and login again.
```

**Solution:** Logout and login to refresh token.

---

### If Success:

```
✅ SUCCESS!
   Message ID: m_xyz789...
```

**Solution:** Everything works! Check your app logic.

---

## What to Do Next

1. **If Test 2 works:** Update your app to always use `ACCOUNT_UPDATE` tag
2. **If both fail:** Follow the error-specific fix in `SEND_FAILED_DEBUG.md`
3. **If both succeed:** The issue is in your app code, not Facebook API

---

## Alternative: Use Browser Console

1. Open your app in browser
2. Open DevTools (F12)
3. Go to Console
4. Paste this:

```javascript
// Get access token
document.cookie.split('; ').find(c => c.startsWith('fb-access-token='))

// Or check Application → Cookies → fb-access-token
```

---

## Need Help?

Share the output of `test-send-simple.js` for specific guidance!

