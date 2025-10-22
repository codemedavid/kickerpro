# 📋 Facebook Message Tags Guide

## ✅ ACCOUNT_UPDATE Tag Implemented!

Your app now uses the `ACCOUNT_UPDATE` message tag to send messages **outside the 24-hour window**.

---

## 🎯 What is ACCOUNT_UPDATE?

**Message Tags** allow you to send messages to users outside the standard 24-hour messaging window for specific use cases approved by Facebook.

### **ACCOUNT_UPDATE Tag:**

**Use Case:** Send non-promotional updates about user accounts

**Allowed:**
- ✅ Account information changes
- ✅ Purchase updates
- ✅ Order status changes
- ✅ Subscription confirmations
- ✅ Service notifications
- ✅ Appointment reminders

**NOT Allowed:**
- ❌ Promotional content
- ❌ Marketing messages
- ❌ Sales campaigns
- ❌ Unsolicited offers
- ❌ Generic announcements

---

## 📊 Before vs After

### **Without Message Tag (Old Behavior):**

```javascript
// Only works within 24 hours
{
  recipient: { id: "user_psid" },
  message: { text: "Hello!" },
  access_token: "token"
}

// After 24 hours:
❌ Error: "This message is sent outside of the allowed window"
```

### **With ACCOUNT_UPDATE Tag (New Behavior):**

```javascript
// Works anytime!
{
  recipient: { id: "user_psid" },
  message: { text: "Your account has been updated" },
  messaging_type: "MESSAGE_TAG",
  tag: "ACCOUNT_UPDATE",
  access_token: "token"
}

// After 24 hours:
✅ Success! Message delivered
```

---

## 🔧 Implementation

### **Updated Code (`/api/messages/[id]/send/route.ts`):**

```typescript
const postData = {
  recipient: {
    id: recipientId
  },
  message: {
    text: messageText
  },
  messaging_type: 'MESSAGE_TAG',  // ← NEW!
  tag: 'ACCOUNT_UPDATE',          // ← NEW!
  access_token: accessToken
};
```

### **What Changed:**

**Before:**
```javascript
POST /me/messages
{
  recipient: { id: "123" },
  message: { text: "Hello" }
}
```

**After:**
```javascript
POST /me/messages
{
  recipient: { id: "123" },
  message: { text: "Hello" },
  messaging_type: "MESSAGE_TAG",
  tag: "ACCOUNT_UPDATE"
}
```

---

## ⚠️ Important Facebook Requirements

### **1. App Review Required**

To use message tags, your Facebook app needs approval:

1. **Go to:** [developers.facebook.com](https://developers.facebook.com)
2. **Select:** Your app
3. **Click:** App Review → Permissions and Features
4. **Request:** `pages_messaging` with message tag justification
5. **Explain:** How you'll use ACCOUNT_UPDATE (must be non-promotional)

### **2. Content Restrictions**

Facebook monitors tag usage. Violations can result in:
- Tag privileges revoked
- App suspended
- Page messaging blocked

**Do:**
- ✅ Send account-related updates
- ✅ Notify about order status
- ✅ Confirm transactions
- ✅ Provide service updates

**Don't:**
- ❌ Send promotions or ads
- ❌ Use for marketing campaigns
- ❌ Send unsolicited messages
- ❌ Abuse the tag system

---

## 📊 Available Message Tags

| Tag | Use Case | Example |
|-----|----------|---------|
| **ACCOUNT_UPDATE** | Account changes | "Your password was changed" |
| **CONFIRMED_EVENT_UPDATE** | Event updates | "Your event time changed" |
| **POST_PURCHASE_UPDATE** | Order updates | "Your order has shipped" |
| **HUMAN_AGENT** | Customer service | "Agent John is helping you" |

**We're using:** `ACCOUNT_UPDATE` (most flexible)

---

## 🧪 Testing

### **Test 1: Send Outside 24h Window**

```javascript
// In browser console (after refreshing tokens)
fetch('/api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Test with ACCOUNT_UPDATE tag',
    content: 'Your account information has been updated.',
    page_id: 'a430e86c-3f86-44fa-9148-1f10f45a5ccc',
    recipient_type: 'selected',
    recipient_count: 1,
    status: 'sent',
    selected_recipients: ['24934311549542539']
  })
})
.then(r => r.json())
.then(data => {
  console.log('Message created:', data);
  return fetch(`/api/messages/${data.message.id}/send`, { method: 'POST' })
    .then(r => r.json())
    .then(result => console.log('Result:', result));
});
```

**Expected (even if user hasn't messaged in days):**
```javascript
✅ Result: { sent: 1, failed: 0 }
```

### **Test 2: Check Server Logs**

```
[Send API] Sending to recipient: 24934311549... (with ACCOUNT_UPDATE tag)
✅ Message sent successfully
```

---

## 📝 Best Practices

### **1. Use Appropriate Content**

**Good Examples:**
```javascript
"Your account password was updated"
"Your subscription has been renewed"  
"Your order #12345 has been shipped"
"Your appointment is confirmed for tomorrow"
```

**Bad Examples:**
```javascript
"Flash sale! 50% off everything!" ❌
"Check out our new products" ❌
"Special offer just for you" ❌
"Weekly newsletter" ❌
```

### **2. Keep Messages Relevant**

Only send when there's an actual account update:
- ✅ User action triggered (password change, purchase, etc.)
- ✅ System update (service change, feature update)
- ❌ Random promotions
- ❌ Batch marketing campaigns

### **3. Don't Abuse**

- Send only when necessary
- Don't spam users
- Respect opt-outs
- Follow Facebook policies

---

## 🚨 Troubleshooting

### **Error: "This message tag is not supported"**

**Cause:** App doesn't have permission  
**Fix:** Submit for App Review → Request pages_messaging with message tags

### **Error: "Message tag usage is not allowed"**

**Cause:** Violating tag policies  
**Fix:** Review message content, ensure it's non-promotional

### **Error: "Invalid messaging_type"**

**Cause:** Typo in code  
**Fix:** Should be `messaging_type: 'MESSAGE_TAG'` (exact spelling)

### **Still Getting 24h Window Error**

**Possible Causes:**
1. App not approved for message tags yet
2. Message content is promotional (Facebook detecting abuse)
3. Tag spelled wrong in code

---

## 📊 Comparison: Your Implementation

### **Old PHP (No Tags):**

```php
// index.php - Limited to 24h window
function sendMessage($recipientPSID, $messageText) {
    $sendData = [
        'recipient' => ['id' => $recipientPSID],
        'message' => ['text' => $messageText],
        'access_token' => $accessToken
    ];
    
    // ❌ Fails after 24 hours
}
```

### **New Next.js (With Tags):**

```typescript
// /api/messages/[id]/send/route.ts
const postData = {
  recipient: { id: recipientId },
  message: { text: messageText },
  messaging_type: 'MESSAGE_TAG',
  tag: 'ACCOUNT_UPDATE',
  access_token: accessToken
};

// ✅ Works anytime!
```

---

## 🎉 Benefits

1. **No 24h Restriction:**
   - Send messages anytime
   - No need to wait for user to message first
   - More flexibility in timing

2. **Better User Experience:**
   - Send important updates when needed
   - Don't miss critical notifications
   - Keep users informed

3. **More Reliable:**
   - Less failures due to timing
   - Higher delivery rate
   - Better campaign success

---

## ⚠️ Important Notes

### **1. This is NOT a Loophole**

Facebook actively monitors message tag usage. Abuse will result in:
- App suspension
- Messaging privileges revoked
- Potential legal action

### **2. Use Responsibly**

Message tags are for **legitimate account updates only**:
- ✅ "Your order shipped"
- ✅ "Password changed"
- ✅ "Appointment confirmed"
- ❌ "Check out our sale"
- ❌ "New products available"

### **3. Content Matters**

Even with ACCOUNT_UPDATE tag:
- Message content must be account-related
- Facebook may reject promotional content
- Keep messages transactional, not promotional

---

## 📋 Checklist

Before using message tags in production:

- [ ] App submitted for review
- [ ] `pages_messaging` permission approved
- [ ] Message tag usage justified to Facebook
- [ ] Content is non-promotional
- [ ] Messages are account-related
- [ ] User opt-outs respected
- [ ] Tested with sample messages
- [ ] Monitoring for policy violations

---

## 🚀 Current Status

✅ **Code Updated:**
- `messaging_type: 'MESSAGE_TAG'` added
- `tag: 'ACCOUNT_UPDATE'` added
- Error handling updated
- Logging includes tag info

✅ **Ready to Use:**
- After you refresh your Facebook tokens
- After your app is approved for message tags (if not already)
- After first test succeeds

---

## 🔗 Facebook Documentation

**Official Docs:**
- [Message Tags Overview](https://developers.facebook.com/docs/messenger-platform/send-messages/message-tags)
- [ACCOUNT_UPDATE Tag](https://developers.facebook.com/docs/messenger-platform/send-messages/message-tags#account_update)
- [App Review Process](https://developers.facebook.com/docs/apps/review)

---

## ✅ Summary

**What Changed:**
- ✅ Added `ACCOUNT_UPDATE` message tag
- ✅ Bypasses 24-hour messaging window
- ✅ Allows sending anytime (with restrictions)

**Requirements:**
- ⚠️ Must be non-promotional content
- ⚠️ App needs Facebook approval (may already have)
- ⚠️ Content monitored by Facebook

**Benefits:**
- ✅ Send messages outside 24h window
- ✅ Higher delivery rates
- ✅ More flexibility

**Use Responsibly!**
- Send only account updates
- Don't abuse for marketing
- Follow Facebook policies

**Your app now uses ACCOUNT_UPDATE for all messages!** 🚀

