# 🚨 CRITICAL: Authentication Cookie Mismatch

## Problem Discovered

**Contacts are being fetched successfully but not shown because of authentication failure!**

### Root Cause:
1. **Facebook Auth Route** (`/api/auth/facebook`) sets cookie: **`fb-user-id`**
2. **Most API Endpoints** (170+ instances) expect cookie: **`fb-auth-user`**

### Result:
- User logs in → `fb-user-id` cookie is set
- User navigates to conversations page
- API calls use `fb-auth-user` cookie → **NOT FOUND**
- API returns 401 Unauthorized
- Frontend gets empty array
- **Contacts don't show even though sync was successful!**

### Affected Endpoints (35+ routes):
- ❌ `/api/conversations` 
- ❌ `/api/messages`
- ❌ `/api/tags`
- ❌ `/api/upload`
- ❌ `/api/ai-automations`
- ❌ `/api/pipeline/*`
- ❌ `/api/contact-timing/*`
- ❌ `/api/diagnostics`

### Solution:
**Option A (Quick Fix):** Set both cookies in auth route for backward compatibility
**Option B (Proper Fix):** Update all 170+ instances to use unified auth helper

Implementing **Option A** now for immediate fix, then gradually migrate to Option B.

