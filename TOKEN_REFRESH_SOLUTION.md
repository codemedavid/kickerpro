# 🔄 Token Refresh Solution

## ❌ Current Problem:

```
"Error validating access token: Session has expired"
```

**Cause:** Facebook access tokens expire:
- Short-lived user tokens: 1-2 hours
- Long-lived user tokens: 60 days
- Page tokens: Tied to user token lifespan

**When user token expires → All page tokens expire too!**

---

## ✅ Immediate Workaround:

### **Every time tokens expire:**

1. Logout → Login again
2. Go to Connections → Re-connect pages
3. Try sending again

---

## 🔧 Permanent Solutions:

### **Option 1: Request Long-Lived User Tokens** (Recommended)

Facebook allows exchanging short-lived tokens for long-lived ones (60 days):

```typescript
// Add to /api/auth/facebook/route.ts
async function exchangeForLongLivedToken(shortLivedToken: string) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?` +
    `grant_type=fb_exchange_token&` +
    `client_id=${process.env.FACEBOOK_APP_ID}&` +
    `client_secret=${process.env.FACEBOOK_APP_SECRET}&` +
    `fb_exchange_token=${shortLivedToken}`
  );
  
  const data = await response.json();
  return data.access_token; // This is long-lived (60 days)
}
```

### **Option 2: Automatic Token Refresh**

Check token validity before sending and refresh if needed:

```typescript
// /api/messages/[id]/send/route.ts
async function validateAndRefreshToken(pageId: string, currentToken: string) {
  // Check if token is valid
  const debugResponse = await fetch(
    `https://graph.facebook.com/debug_token?` +
    `input_token=${currentToken}&` +
    `access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
  );
  
  const debug = await debugResponse.json();
  
  if (debug.data?.is_valid === false) {
    // Token expired - need user to re-login
    throw new Error('TOKEN_EXPIRED');
  }
  
  return currentToken;
}
```

### **Option 3: Cron Job to Refresh Tokens**

Set up a scheduled job to refresh tokens before they expire:

```typescript
// /api/cron/refresh-tokens/route.ts
export async function GET() {
  const supabase = await createClient();
  
  // Get all pages
  const { data: pages } = await supabase
    .from('facebook_pages')
    .select('*')
    .eq('is_active', true);
  
  for (const page of pages || []) {
    try {
      // Check token validity
      const response = await fetch(
        `https://graph.facebook.com/${page.facebook_page_id}?` +
        `fields=access_token&` +
        `access_token=${page.access_token}`
      );
      
      if (!response.ok) {
        // Token expired - mark page as needing reconnection
        await supabase
          .from('facebook_pages')
          .update({ 
            is_active: false,
            error_message: 'Token expired - please reconnect'
          })
          .eq('id', page.id);
      }
    } catch (error) {
      console.error('Token refresh error for page:', page.name, error);
    }
  }
  
  return NextResponse.json({ success: true });
}
```

---

## 🎯 Recommended Implementation:

### **Phase 1: Immediate (Today)**

1. ✅ Re-login and reconnect pages (workaround)
2. ✅ Add token validation to send API
3. ✅ Show friendly error when token expires

### **Phase 2: Short-term (This Week)**

1. ⏳ Implement long-lived token exchange
2. ⏳ Add "Reconnect Page" button in UI
3. ⏳ Store token expiry date in database

### **Phase 3: Long-term (Later)**

1. ⏳ Automated token refresh cron job
2. ⏳ Email notifications when tokens expire
3. ⏳ Background job to refresh tokens

---

## 📝 Quick Implementation:

### **1. Add Token Validation to Send API:**

```typescript
// Update /api/messages/[id]/send/route.ts
async function sendFacebookMessage(
  pageId: string,
  recipientId: string,
  messageText: string,
  accessToken: string
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v18.0/me/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText },
        access_token: accessToken
      })
    });

    const data = await response.json();

    if (data.error) {
      // Check if token expired
      if (data.error.code === 190) {  // Invalid OAuth token
        return {
          success: false,
          error: 'TOKEN_EXPIRED: Please logout and login again to refresh your access token'
        };
      }
      
      return {
        success: false,
        error: data.error.message
      };
    }

    return {
      success: true,
      message_id: data.message_id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}
```

### **2. Add Friendly UI Error:**

```typescript
// In compose page, handle TOKEN_EXPIRED error
if (error.message.includes('TOKEN_EXPIRED')) {
  toast({
    title: "⚠️ Session Expired",
    description: "Your Facebook session has expired. Please logout and login again.",
    variant: "destructive",
    duration: 10000
  });
  
  // Optional: Auto-redirect to logout
  setTimeout(() => {
    router.push('/api/auth/logout');
  }, 3000);
}
```

---

## 🧪 Testing Token Expiry:

### **Simulate Expired Token:**

```sql
-- In Supabase, set page token to expired one
UPDATE facebook_pages 
SET access_token = 'EXPIRED_TOKEN_HERE'
WHERE facebook_page_id = '505302195998738';
```

### **Test Error Handling:**

```javascript
// Browser console
fetch('/api/messages/your-message-id/send', { method: 'POST' })
  .then(r => r.json())
  .then(result => {
    if (result.results?.[0]?.error?.includes('expired')) {
      console.log('✅ Token expiry detected correctly!');
    }
  });
```

---

## 📊 Current vs Recommended Flow:

### **Current (Breaks when token expires):**
```
1. User logins → Gets user token (1-2 hours)
2. Connects pages → Gets page tokens
3. Waits 3 hours
4. Tries to send → ❌ "Session expired"
5. Manual: Logout → Login → Reconnect
```

### **Recommended (Auto-handles expiry):**
```
1. User logins → Exchange for long-lived token (60 days)
2. Connects pages → Gets page tokens (60 days)
3. Before sending → Check token validity
4. If expired → Show "Please reconnect" UI
5. User clicks "Reconnect" → Fresh tokens
```

---

## ✅ Summary:

**Problem:** Tokens expire after 1-2 hours  
**Current Fix:** Logout → Login → Reconnect pages  
**Short-term:** Implement long-lived tokens  
**Long-term:** Automated refresh system  

**For now, just re-login and reconnect pages!** 🔄

---

## 📞 Implementation Priority:

1. 🔴 **NOW:** Re-login and reconnect (workaround)
2. 🟡 **TODAY:** Add token expiry detection
3. 🟢 **THIS WEEK:** Implement long-lived tokens
4. ⚪ **LATER:** Automated refresh

**Start with step 1, then we can implement the rest!** 🚀

