# 🎨 Auto Re-Login - Visual Guide

## 🎯 What You'll See

### **1. Normal State (> 60 minutes left)**

```
┌─────────────────────────────────────┐
│ 🟢 Token Expires                    │  ← GREEN, no pulse
│    59d 23h 59m 45s              ▼   │
└─────────────────────────────────────┘
```

**Expanded View:**
```
Auto-Refresh: ✓ ON
Auto re-login when < 5 min left
```

---

### **2. Warning State (10 minutes left)**

```
┌─────────────────────────────────────┐
│ 🟠 Token Expires                    │  ← ORANGE, no pulse
│    9m 30s                       ▼   │
└─────────────────────────────────────┘
```

**Expanded View:**
```
Auto-Refresh: ✓ ON
⚠️ Will trigger when < 5 min left
```

**Browser Notification:**
```
┌─────────────────────────────────────┐
│ ⚠️ Token Expiring Soon              │
│ Your Facebook token will expire in  │
│ less than 10 minutes. Auto-refresh  │
│ is enabled.                         │
└─────────────────────────────────────┘
```

**Console:**
```
[TokenWidget] ⚠️ Token expires in less than 10 minutes. Auto-refresh enabled.
```

---

### **3. Active Auto-Refresh State (< 5 minutes left)**

```
┌─────────────────────────────────────┐
│ 🔴 Token Expires       [PULSING]    │  ← RED, pulsing!
│    4m 30s                       ▼   │
└─────────────────────────────────────┘
```

**Expanded View:**
```
Auto-Refresh: ✓ ON
🔄 Triggering in 270 seconds...    ← Updates every second!
```

**Browser Notification:**
```
┌─────────────────────────────────────┐
│ 🔄 Auto-Refresh Triggered           │
│ Redirecting to login to refresh     │
│ your Facebook token...              │
└─────────────────────────────────────┘
```

**Console:**
```
[TokenWidget] 🔄 Auto-refresh triggered - redirecting to login in 5 seconds...
[TokenWidget] ➡️ Redirecting to login now...
```

**5-Second Countdown:**
```
270 seconds... (4m 30s)
269 seconds... (4m 29s)
268 seconds... (4m 28s)
...
After 5 seconds → Redirect to /login
```

---

## 🎬 Complete Flow Animation

### **Timeline:**

```
Time: 60 days left
Widget: 🟢 GREEN
Status: "Auto re-login when < 5 min left"
         ↓
         ... time passes ...
         ↓
Time: 10 minutes left
Widget: 🟠 ORANGE
Status: "⚠️ Will trigger when < 5 min left"
Action: 🔔 Browser notification appears
         ↓
         ... user continues working ...
         ↓
Time: 5 minutes left
Widget: 🔴 RED [PULSING]
Status: "🔄 Triggering in 300 seconds..."
Action: 🔔 Browser notification appears
         ↓
         5 second delay...
         ↓
Status: "🔄 Triggering in 295 seconds..."
         ↓
Status: "🔄 Triggering in 290 seconds..."
         ↓
         ... countdown continues ...
         ↓
Action: ➡️ Redirect to /login
         ↓
User: Re-authenticates with Facebook
         ↓
Time: 60 days left (new token)
Widget: 🟢 GREEN
Status: "Auto re-login when < 5 min left"
```

---

## 📱 Browser Notifications

### **When You Enable Auto-Refresh:**

**Desktop:**
```
┌──────────────────────────────────────────┐
│ kickerpro.com                   [x]      │
├──────────────────────────────────────────┤
│ ✅ Auto-Refresh Enabled                  │
│                                          │
│ You will be notified when your token    │
│ is about to expire.                      │
│                                          │
│ Just now                                 │
└──────────────────────────────────────────┘
```

### **At 10 Minutes:**

```
┌──────────────────────────────────────────┐
│ kickerpro.com                   [x]      │
├──────────────────────────────────────────┤
│ ⚠️ Token Expiring Soon                   │
│                                          │
│ Your Facebook token will expire in       │
│ less than 10 minutes. Auto-refresh       │
│ is enabled.                              │
│                                          │
│ Just now                                 │
└──────────────────────────────────────────┘
```

### **At 5 Minutes (Auto-Refresh Triggered):**

```
┌──────────────────────────────────────────┐
│ kickerpro.com                   [x]      │
├──────────────────────────────────────────┤
│ 🔄 Auto-Refresh Triggered                │
│                                          │
│ Redirecting to login to refresh your     │
│ Facebook token...                        │
│                                          │
│ Just now                                 │
└──────────────────────────────────────────┘
```

**Note:** Notifications work even when:
- ✅ Browser tab is inactive
- ✅ Browser is minimized
- ✅ You're working in another app

---

## 🎨 Widget Color States

| Time Left | Color | Animation | Urgency |
|-----------|-------|-----------|---------|
| > 60 min | 🟢 Green | None | Low |
| 30-60 min | 🔵 Blue | None | Low |
| 15-30 min | 🟡 Yellow | None | Medium |
| 10-15 min | 🟠 Orange | None | Medium |
| 5-10 min | 🟠 Orange | None | High |
| < 5 min | 🔴 Red | **Pulsing** | **Critical** |

---

## 🔊 Audio Alert (Optional Enhancement)

While not implemented yet, you could add:

```typescript
// Play sound at 5 minutes
const playAlert = () => {
  const audio = new Audio('/alert.mp3');
  audio.play();
};
```

---

## 🎭 State Comparison

### **Auto-Refresh OFF:**

```
┌─────────────────────────────────────────┐
│ Token Expires: 4m 30s            ▼      │  
├─────────────────────────────────────────┤
│ Auto-Refresh: ✗ OFF                     │
│ Disabled - manually re-login required   │
└─────────────────────────────────────────┘
```

**What Happens:**
- Widget shows countdown
- Changes to red when < 5 min
- **NO** automatic redirect
- **NO** notifications
- User must manually click "Re-login"

### **Auto-Refresh ON:**

```
┌─────────────────────────────────────────┐
│ Token Expires: 4m 30s   [PULSING] ▼     │  
├─────────────────────────────────────────┤
│ Auto-Refresh: ✓ ON                      │
│ 🔄 Triggering in 270 seconds...         │
└─────────────────────────────────────────┘
```

**What Happens:**
- Widget shows countdown
- Changes to red and PULSES when < 5 min
- **Automatic redirect** in 5 seconds
- **Browser notifications**
- User can still manually click "Re-login"

---

## 🖱️ User Actions

### **Enable Auto-Refresh:**
1. Click widget to expand
2. Toggle "Auto-Refresh" to ON
3. Grant notification permission (popup)
4. See confirmation notification

### **Disable Auto-Refresh:**
1. Click widget to expand
2. Toggle "Auto-Refresh" to OFF
3. No more automatic redirects

### **Manual Re-Login (Anytime):**
1. Click widget to expand
2. Click "🔄 Re-login" button
3. Immediate redirect (no delay)

### **Cancel Auto-Refresh (Before Trigger):**
1. When countdown is active (< 5 min)
2. Toggle "Auto-Refresh" to OFF
3. Auto-redirect cancelled
4. Manual re-login required

---

## 📊 Console Logs

### **Complete Log Sequence:**

```bash
# At 10 minutes:
[TokenWidget] ⚠️ Token expires in less than 10 minutes. Auto-refresh enabled.

# At 5 minutes:
[TokenWidget] 🔄 Auto-refresh triggered - redirecting to login in 5 seconds...

# After 5 seconds:
[TokenWidget] ➡️ Redirecting to login now...

# After re-login:
[Facebook Auth] ✅ Token expiration from Facebook: {...}
[TokenWidget] Token appears refreshed - reset auto-refresh flags
```

---

## ✅ Best Practices

### **For Users:**

1. ✅ **Enable Auto-Refresh** - Never worry about expired tokens
2. ✅ **Grant Notifications** - Get alerts even when away
3. ✅ **Keep Tab Open** - Auto-refresh works in background tabs
4. ✅ **Don't Panic** - Red pulsing is normal, system is working

### **For Developers:**

1. ✅ **Check Console Logs** - Detailed logging for debugging
2. ✅ **Test with Simulated Times** - Use cookie manipulation
3. ✅ **Verify Refs Reset** - After re-login, flags should reset
4. ✅ **Monitor Notifications** - Ensure permissions granted

---

## 🎉 Summary

**What You See:**
- 🟢 Green widget → All good (> 60 min)
- 🔵 Blue widget → Getting closer (30-60 min)
- 🟡 Yellow widget → Moderate urgency (15-30 min)
- 🟠 Orange widget → Warning given (5-15 min)
- 🔴 Red pulsing widget → Auto-refresh active (< 5 min)

**What You Get:**
- ✅ Browser notifications at 10 min and 5 min
- ✅ Visual countdown showing seconds remaining
- ✅ 5-second grace period before redirect
- ✅ Automatic re-login without interruption
- ✅ Peace of mind - never caught with expired token

**Bottom line: Clear, predictable, user-friendly auto-refresh!** 🎯✨

