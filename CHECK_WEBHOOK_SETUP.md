# 🔍 Check if Webhook is Properly Set Up

## The Issue

If customer replies on Facebook but automation still sends follow-ups, the webhook might not be working properly.

---

## ✅ Step 1: Verify Webhook is Configured

### **A. Check Facebook Developers:**

1. Go to: https://developers.facebook.com/apps
2. Your App → Messenger → Settings
3. **Webhooks section:**

Should show:
```
✅ Callback URL: https://your-domain.vercel.app/api/webhook
✅ Verify Token: Token123 (or your custom token)
✅ Subscribed to: messages ✅
```

### **B. Check Webhook Logs:**

In Vercel logs, search for: `"Webhook event received"`

**If you see these logs:** Webhook is working ✅
**If no logs:** Webhook not receiving events ❌

---

## ✅ Step 2: Test Webhook Manually

Send a test message to your page:

1. Open Facebook Messenger
2. Go to Azshinari page
3. Send: "Test webhook"

**Expected in Vercel logs within 2 seconds:**
```
Webhook event received: { ... }
Message from USER_ID to PAGE_ID: Test webhook
[Reply Detector] 💬 Contact replied to page
```

**If no logs → Webhook not configured properly!**

---

## ✅ Step 3: Check if Replies Trigger Stop

When customer replies, look for these logs:

```
[Reply Detector] 💬 Contact [PSID] replied to page [PAGE_ID]
[Reply Detector] ✅ Found conversation: Prince Cj Lara
[Reply Detector] 🔍 Checking rules with stop_on_reply enabled
[Reply Detector]   🛑 STOPPED automation "test 2" for Prince Cj Lara
[Reply Detector]   🏷️ Removing trigger tag(s)...
```

**If you DON'T see these → Webhook not stopping automations!**

---

## 🔧 If Webhook Not Working

### **Fix 1: Verify Webhook URL**

In Facebook Developers:
1. Messenger → Settings → Webhooks
2. Check Callback URL is: `https://YOUR-DOMAIN.vercel.app/api/webhook`
3. Not: `/api/webhook/reply-detector` (that's a different endpoint)

### **Fix 2: Re-Subscribe to Page**

1. Webhooks section
2. Find your page subscription
3. Click "Edit"
4. ✅ Ensure `messages` is checked
5. Save

### **Fix 3: Test Webhook Connection**

Facebook has a "Test" button - use it to send a test event!

---

## 🎯 Key Questions

1. **Do you see webhook logs when you message your page?**
   - If YES → Webhook works ✅
   - If NO → Need to configure webhook ❌

2. **Do you see [Reply Detector] logs when replying?**
   - If YES → Stop-on-reply works ✅
   - If NO → Need to check stop_on_reply setting ❌

3. **Is stop_on_reply enabled for "test 2" rule?**
   ```sql
   SELECT name, stop_on_reply FROM ai_automation_rules 
   WHERE name = 'test 2';
   ```
   Should show: `stop_on_reply = true` ✅

---

## 📊 Test Right Now

1. **Send test message** to Azshinari page on Facebook
2. **Check Vercel logs** immediately
3. **Share what you see:**
   - Do webhook logs appear?
   - Do reply detector logs appear?

This will tell us if the webhook is working! 🔍

