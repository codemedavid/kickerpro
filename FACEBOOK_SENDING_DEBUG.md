# 🔍 Facebook Sending Debug Guide

## Issue: Messages Not Sending to Facebook Messenger

The batch processing might be running, but the actual Facebook API calls are failing. Let's find out why.

---

## Step 1: Test Facebook API Directly

Visit this URL to test if Facebook API is working:

```
http://localhost:3000/api/messages/test-facebook?messageId=944c10be-740a-429c-b42f-fa7371802e6d
```

### Possible Results:

#### ✅ Success:
```json
{
  "success": true,
  "message": "Test message sent successfully!",
  "message_id": "m_xxx..."
}
```
✅ If you see this, Facebook API is working! The issue is elsewhere.

#### ❌ Token Error:
```json
{
  "success": false,
  "facebook_error": {
    "code": 190,
    "message": "Error validating access token"
  },
  "recommendations": [
    "Access token expired or invalid",
    "Reconnect your Facebook page in settings"
  ]
}
```
🔧 **Fix**: Reconnect your Facebook page.

#### ❌ Permission Error:
```json
{
  "success": false,
  "facebook_error": {
    "code": 200,
    "message": "Permission denied"
  },
  "recommendations": [
    "Permission denied - check page permissions",
    "Make sure your app has pages_messaging permission"
  ]
}
```
🔧 **Fix**: Check Facebook app permissions.

#### ❌ Rate Limit:
```json
{
  "success": false,
  "facebook_error": {
    "code": 613,
    "message": "Calls to this api have exceeded the rate limit"
  }
}
```
🔧 **Fix**: Wait 5-10 minutes, then try again.

#### ❌ Message Tag Error:
```json
{
  "success": false,
  "facebook_error": {
    "code": 2018109,
    "message": "Message tag not allowed"
  }
}
```
🔧 **Fix**: Try sending without message tag, or use different tag.

---

## Step 2: Check Server Console Logs

Look at your terminal where `npm run dev` is running.

### Look for these log entries:

#### Good Signs (Message Sent):
```
[Send Helpers] Facebook API request: ...
[Send Helpers] Facebook API response status: 200
[Send Helpers] ✅ Message sent successfully
```

#### Bad Signs (Error):
```
[Send Helpers] Facebook API response status: 400/403/500
[Send Helpers] ❌ Facebook API error: ...
```

### Common Console Errors:

#### Error 1: Token Expired
```
[Send Helpers] ❌ Facebook API error: {
  code: 190,
  message: "Error validating access token"
}
```
**Fix**: Reconnect Facebook page.

#### Error 2: Permission Denied
```
[Send Helpers] ❌ Facebook API error: {
  code: 200,
  message: "Requires extended permission: pages_messaging"
}
```
**Fix**: Check Facebook app settings.

#### Error 3: No Response
```
[Send API] 🚀 Processing batch 1/1 in background
(No further logs)
```
**Fix**: Processing might have crashed. Check for exceptions.

---

## Step 3: Check Message Batches Status

Visit diagnostic endpoint:
```
http://localhost:3000/api/messages/diagnose?messageId=944c10be-740a-429c-b42f-fa7371802e6d
```

Check `batch_details`:
```json
{
  "batch_details": [
    {
      "status": "processing",  // ← Stuck here?
      "sent_count": 0,         // ← No messages sent
      "failed_count": 0        // ← But also no failures logged
    }
  ]
}
```

This means the batch is processing but Facebook calls are failing silently.

---

## Step 4: Common Issues & Fixes

### Issue 1: Access Token Expired
**Symptoms**: Test API returns error 190
**Fix**: 
1. Go to Dashboard → Pages
2. Disconnect and reconnect Facebook page
3. Try sending again

### Issue 2: No `pages_messaging` Permission
**Symptoms**: Test API returns error 200
**Fix**:
1. Go to Facebook App settings
2. Add `pages_messaging` permission
3. Reauthorize the page

### Issue 3: Message Tag Required
**Symptoms**: Test API returns error 2018109
**Fix**:
1. When composing message, select a message tag
2. Use "ACCOUNT_UPDATE" for most cases
3. Or send without tag to subscribers within 24h

### Issue 4: Recipient Can't Receive
**Symptoms**: Test API returns error 551
**Fix**:
- User blocked the page
- User opted out of messages
- Try different recipient

### Issue 5: Rate Limit
**Symptoms**: Test API returns error 613
**Fix**:
- Wait 5-10 minutes
- Reduce sending frequency
- Check Facebook rate limits

### Issue 6: Invalid Content
**Symptoms**: Test API returns error 100
**Fix**:
- Message too long (>2000 characters)
- Invalid characters
- Empty message

---

## Step 5: Force Detailed Logging

To see more details, check the batch processing logs:

1. Visit: `http://localhost:3000/api/messages/944c10be-740a-429c-b42f-fa7371802e6d/batches/process`

2. Watch console for detailed logs:
```
[Process Batch API] Attempting send...
[Send Helpers] Facebook API request: ...
[Send Helpers] Facebook API response status: ...
[Send Helpers] Facebook API response data: ...
```

---

## Step 6: Test with Simple Message

Try creating a NEW simple message:

1. **Go to Compose page**
2. **Create message:**
   - Title: "Test"
   - Content: "Hi, this is a test"
   - Select 1 recipient
   - Message tag: "ACCOUNT_UPDATE"
3. **Send**
4. **Watch console logs immediately**

---

## Quick Diagnosis Checklist

Run through this checklist:

- [ ] Visit test-facebook endpoint - does it succeed?
- [ ] Check console for Facebook API errors
- [ ] Access token present? (check page.has_access_token in diagnostic)
- [ ] Message tag valid? (ACCOUNT_UPDATE, CONFIRMED_EVENT_UPDATE, etc.)
- [ ] Recipient valid? (not blocked, not opted out)
- [ ] Content valid? (not too long, no special characters)
- [ ] Rate limit? (sent too many recently)
- [ ] Processing actually running? (see logs in console)

---

## What to Share With Me

To help you further, please share:

1. **Test Facebook Result**:
   ```
   Output from: /api/messages/test-facebook?messageId=...
   ```

2. **Console Logs**:
   ```
   Any logs starting with:
   [Send Helpers]
   [Process Batch API]
   [Send API]
   ```

3. **Diagnostic Output**:
   ```
   Output from: /api/messages/diagnose?messageId=...
   ```

With this information, I can tell you exactly what's wrong and how to fix it!

---

## Most Likely Issues

Based on your symptoms, the most likely issues are:

### 1. **Access Token Expired** (90% likely)
- Test endpoint will show error 190
- Fix: Reconnect Facebook page

### 2. **Message Tag Issue** (5% likely)
- Test endpoint will show error 2018109
- Fix: Use correct tag or no tag

### 3. **Processing Crashed** (5% likely)
- No logs after batch processing starts
- Fix: Check for exceptions in console

---

**Start with Step 1 (test-facebook endpoint) and share the result!** 🔍




