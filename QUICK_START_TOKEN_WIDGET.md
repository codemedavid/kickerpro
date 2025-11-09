# ⚡ Quick Start - Token Countdown Widget

## 🎯 What's New?

The countdown widget now verifies its accuracy against Facebook's **real** token expiration!

---

## 🚀 How to Use

### **1. View Token Expiration**
```
Look at bottom-right corner of screen
→ See countdown timer with color indicator
→ Green = Good, Yellow/Orange = Soon, Red = Urgent
```

### **2. Verify Accuracy**
```
Click widget to expand
→ Click "🛡️ Verify with Facebook"
→ See verification result:
   ✅ Green badge = Accurate
   ⚠️ Yellow badge = Auto-corrected
```

### **3. Enable Auto-Refresh** (Recommended)
```
Expand widget
→ Toggle "Auto-Refresh" ON
→ App will auto re-login when < 5 min left
→ Never get caught with expired token!
```

---

## 🧪 Test It Now!

### **Quick Test:**
```javascript
// Open browser console (F12) and paste:

// 1. Check current expiration
document.cookie.split('; ')
  .find(row => row.startsWith('fb-token-expires='))
  
// 2. Verify with Facebook API
fetch('/api/auth/verify-token')
  .then(r => r.json())
  .then(d => console.log('✅ Verification:', d))
```

### **Expected Result:**
```json
{
  "isValid": true,
  "expiresAt": 1736467199000,
  "expiresIn": 5184000,
  "expiresInDays": 60,
  "hasMismatch": false,
  "userName": "Your Name"
}
```

---

## 🛠️ For Developers

### **New API Endpoint:**
```typescript
GET /api/auth/verify-token

// Returns:
{
  isValid: boolean;
  expiresAt: number;        // Real expiration (ms)
  expiresIn: number;        // Seconds until expiration
  hasMismatch: boolean;     // Cookie vs real mismatch?
  mismatchSeconds: number;  // Difference
}
```

### **Modified Files:**
1. ✅ `src/app/api/auth/facebook/route.ts` - Uses Facebook debug API
2. ✅ `src/app/api/auth/verify-token/route.ts` - New verification endpoint
3. ✅ `src/components/TokenExpirationWidget.tsx` - Verification UI

---

## 🎨 Widget States

| State | Color | Meaning |
|-------|-------|---------|
| 🟢 Green | > 30 min | All good |
| 🟡 Yellow | 15-30 min | Heads up |
| 🟠 Orange | 5-15 min | Get ready |
| 🔴 Red | < 5 min | Re-login now! |

---

## ✅ Benefits

### **Before:**
- ❌ Countdown might be inaccurate
- ❌ No way to verify
- ❌ Manual cookie checking

### **After:**
- ✅ Uses Facebook's REAL expiration
- ✅ One-click verification
- ✅ Auto-correction
- ✅ Peace of mind

---

## 🔍 What Happens Behind the Scenes

```
Login
  ↓
Exchange token for long-lived (60 days)
  ↓
Call Facebook debug_token API
  ↓
Get REAL expiration time
  ↓
Store in cookie (fb-token-expires)
  ↓
Widget reads and displays countdown
  ↓
User clicks "Verify"
  ↓
Call debug_token API again
  ↓
Compare cookie vs Facebook
  ↓
If mismatch → Auto-correct countdown
```

---

## 📝 Console Logs to Watch For

### **During Login:**
```
[Facebook Auth] ✅ Token expiration from Facebook: {
  expiresAt: "Jan 9, 2026, 11:59 PM",
  expiresIn: 5184000,
  expiresInDays: 60,
  isValid: true
}
[Facebook Auth] Token expires at: Jan 9, 2026, 11:59 PM
```

### **During Verification:**
```
[TokenWidget] Verifying token with Facebook...
[TokenWidget] Verification result: { hasMismatch: false }
```

---

## 🎯 Next Steps

1. ✅ **Test fresh login** - Logout and login again
2. ✅ **Click verify** - Check verification works
3. ✅ **Enable auto-refresh** - Never worry about expiration
4. ✅ **Check console logs** - See real expiration data

---

## 🆘 Troubleshooting

### **Widget Not Showing:**
```bash
# Check if authenticated
document.cookie.split('; ')
  .find(row => row.startsWith('fb-user-id='))
  
# Should return: "fb-user-id=xxx-xxx-xxx"
```

### **Verification Not Working:**
```bash
# Check environment variables
# .env.local should have:
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
```

### **Countdown Seems Wrong:**
```bash
# Just click "Verify with Facebook"
# It will auto-correct if there's a mismatch
```

---

## 🎉 Summary

**The countdown widget now shows the REAL token expiration from Facebook!**

- ✅ No more guessing
- ✅ One-click verification
- ✅ Auto-correction
- ✅ Auto-refresh option
- ✅ Color-coded alerts

**Try it now!** Click the widget and hit "Verify with Facebook" 🛡️

---

## 📚 More Info

- **Full Details:** See `TOKEN_COUNTDOWN_FIX_SUMMARY.md`
- **Visual Guide:** See `TOKEN_WIDGET_VISUAL_GUIDE.md`
- **API Docs:** See `/api/auth/verify-token` endpoint

**Enjoy your accurate token countdown!** 🎯✨

