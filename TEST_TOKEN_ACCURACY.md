# 🧪 Test Token Expiration Accuracy

## Quick Test Steps

### 1. **Clear Your Session**
```bash
# Open browser console (F12) and run:
document.cookie.split(";").forEach(c => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"));
```

Or simply logout from the app.

### 2. **Login Fresh**
1. Go to `/login`
2. Click "Continue with Facebook"
3. Complete Facebook OAuth

### 3. **Check Console Logs**

You should see these logs:

```
[Facebook Auth] ✅ Token expiration from Facebook: {
  expiresAt: "Jan 9, 2026, 11:59:00 PM",
  expiresAtUnix: 1736467199,
  expiresIn: 5184000,
  expiresInDays: 60,
  isValid: true
}
[Facebook Auth] Token absolute expiration: Jan 9, 2026, 11:59:00 PM
[Facebook Auth] Using ABSOLUTE expiration timestamp from Facebook (no calculation drift)
```

### 4. **Verify Widget Auto-Check**

The widget should auto-verify on load:

```
[TokenWidget] 🔍 Auto-verifying token expiration with Facebook...
[TokenWidget] ✅ Auto-verification passed - countdown is accurate
```

### 5. **Compare with Facebook Debug Tool**

1. Go to: https://developers.facebook.com/tools/debug/accesstoken/
2. Get your access token from console:
   ```javascript
   document.cookie.split('; ').find(row => row.startsWith('fb-access-token='))
   ```
3. Paste the token value into Facebook Debug Tool
4. Compare "Data Access Expires At" with your widget

**They should match exactly!** ✅

### 6. **Manual Verification Test**

1. Open the widget (bottom-right corner)
2. Expand it
3. Click "Verify with Facebook"
4. Should show green checkmark: "✓ Verified with Facebook"

## Expected Behavior

### ✅ Success Indicators

- Widget shows countdown in days/hours/minutes
- Console shows "Using ABSOLUTE expiration timestamp"
- Auto-verification passes or auto-corrects
- Manual verification shows "Verified with Facebook"
- Countdown matches Facebook Debug Tool

### ❌ Error Indicators

If you see these, something is wrong:

- Widget shows "0d 0h 0m 0s"
- Console shows error fetching token
- Verification fails with error
- Countdown doesn't match Facebook Debug Tool

## Troubleshooting

### Issue: Widget shows 0 time remaining

**Fix:** 
1. Check if you're logged in
2. Check console for errors
3. Try logout/login again

### Issue: Countdown doesn't match Facebook

**Fix:**
1. Click "Verify with Facebook" button
2. Widget should auto-correct
3. If not, check console for error logs

### Issue: Auto-verification fails

**Possible causes:**
- Facebook API rate limit
- Network issue
- Invalid token

**Fix:**
1. Wait 1 minute and refresh
2. Try manual verification
3. If still fails, logout/login again

## Advanced Testing

### Test Token Refresh Detection

1. Note current expiration time
2. Logout and login again
3. Widget should detect new expiration
4. Should show "✓ Refreshed" badge
5. Should show notification (if enabled)

### Test Auto-Refresh Feature

1. Enable "Auto-Refresh" toggle in widget
2. Enable browser notifications when prompted
3. Manually change cookie to expire in 4 minutes:
   ```javascript
   document.cookie = 'fb-token-expires=' + (Date.now() + 240000) + '; path=/'
   ```
4. Widget should turn red and start pulsing
5. After 1 minute, should show warning notification
6. Should auto-redirect to login after 5 minutes

## API Testing

### Test Verify Endpoint

```bash
curl http://localhost:3000/api/auth/verify-token \
  -H "Cookie: fb-user-id=YOUR_USER_ID"
```

Expected response:
```json
{
  "isValid": true,
  "expiresAt": 1736467199000,
  "expiresIn": 5184000,
  "expiresInDays": 60,
  "hasMismatch": false,
  "mismatchSeconds": 0,
  "userName": "Your Name"
}
```

## Production Checklist

Before deploying to production:

- [ ] Fresh login shows correct expiration
- [ ] Console logs show "ABSOLUTE expiration timestamp"
- [ ] Widget auto-verifies on load
- [ ] Manual verification works
- [ ] Countdown matches Facebook Debug Tool (within 1-2 seconds)
- [ ] Widget shows refresh badge after re-login
- [ ] No console errors
- [ ] Auto-refresh feature works (optional)

## Success Criteria

✅ **The fix is working correctly if:**

1. Widget countdown is accurate (matches Facebook)
2. Console shows "Using ABSOLUTE expiration timestamp"
3. Auto-verification passes or auto-corrects
4. No calculation drift or timing errors
5. Widget automatically corrects any discrepancies

---

**Status**: Ready for testing
**Priority**: High - Core feature accuracy
**Risk**: Low - Fallback mechanisms in place

