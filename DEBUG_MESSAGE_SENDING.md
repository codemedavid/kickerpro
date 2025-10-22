# 🔍 Debug Message Sending

## 📋 Enhanced Error Logging Added

I just added comprehensive error logging to help diagnose the "Failed to create message" error.

---

## 🧪 How to Debug

### **Step 1: Try Sending a Message Again**

1. Go to `/dashboard/compose`
2. Fill out the form:
   - **Page:** Select any connected page
   - **Title:** "Test Message"
   - **Content:** "Testing 123"
3. Click "Send Message"

### **Step 2: Check Browser Console** (F12 → Console)

You should now see detailed logs:

**Expected logs:**
```javascript
[Compose] Submitting message: {
  title: "Test Message",
  content: "Testing 123",
  page_id: "uuid...",
  created_by: "uuid...",
  ...
}
[Compose] Response status: 500  // or 400, or 200
[Compose] Response ok: false
[Compose] API error response: {
  error: "Actual error message here",
  details: "Detailed error information",
  code: "Error code if available"
}
```

### **Step 3: Check Server Terminal**

Look for these logs in your terminal where `npm run dev` is running:

**Expected logs:**
```javascript
[Messages API] POST request received
[Messages API] User ID from cookie: uuid...
[Messages API] Request body: {
  "title": "Test Message",
  ...
}
[Messages API] Inserting message into database...
[Messages API] Insert error: {
  code: "42501",
  message: "new row violates row-level security policy",
  ...
}
```

---

## 🐛 Common Errors & Solutions

### **Error 1: Row Level Security**

**Console shows:**
```
code: "42501"
message: "new row violates row-level security policy for table 'messages'"
```

**Cause:** Supabase RLS is blocking the insert

**Solution:**

**Quick Fix (Development):**
```sql
-- In Supabase SQL Editor
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
```

**Proper Fix:**
```sql
-- Update RLS policy to allow inserts
DROP POLICY IF EXISTS "Users can insert own messages" ON messages;

CREATE POLICY "Users can insert own messages" ON messages
    FOR INSERT 
    WITH CHECK (true);  -- Allow all inserts for now
```

### **Error 2: Missing Required Fields**

**Console shows:**
```
error: "Missing required fields"
missing: {title: false, content: false, page_id: true}
```

**Cause:** One of the required fields is empty

**Solution:**
- Make sure you select a page from dropdown
- Fill in title and content
- Try again

### **Error 3: Not Authenticated**

**Console shows:**
```
status: 401
error: "Not authenticated"
```

**Cause:** Cookie missing or expired

**Solution:**
1. Logout (sidebar bottom)
2. Login again with Facebook
3. Try sending message

### **Error 4: Foreign Key Constraint**

**Console shows:**
```
code: "23503"
message: "violates foreign key constraint"
```

**Cause:** Page ID or User ID doesn't exist in database

**Solution:**
- Make sure the page is actually connected
- Check `/api/pages` returns your pages
- Reconnect the page if needed

---

## 🔧 Manual Testing

### **Test API Directly:**

**Test 1: Check if API route exists:**
```bash
# In a new terminal
curl http://localhost:3000/api/messages

# Should return:
# {"error":"Not authenticated"}
# (This is good - means route exists!)
```

**Test 2: Check authentication:**
```bash
# Check your cookies
# Browser DevTools → Application → Cookies → localhost:3000
# Should see: fb-auth-user
```

**Test 3: Test with curl:**
```bash
# Get your cookie value from browser
# Then test:
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: fb-auth-user=your-user-id" \
  -d '{
    "title": "Test",
    "content": "Test message",
    "page_id": "page-uuid-from-connected-pages",
    "recipient_type": "all",
    "recipient_count": 0,
    "status": "draft"
  }'
```

---

## 📊 Diagnostic Checklist

Run through these checks:

### **✅ Authentication:**
- [ ] Can access dashboard
- [ ] User name shows in sidebar
- [ ] `/api/auth/me` returns user data

### **✅ Database:**
- [ ] `supabase-schema.sql` was run
- [ ] `messages` table exists
- [ ] RLS policies configured

### **✅ Connected Pages:**
- [ ] At least one page connected
- [ ] Pages show in dropdown
- [ ] Page has UUID in database

### **✅ Form Data:**
- [ ] Title filled in
- [ ] Content filled in
- [ ] Page selected from dropdown
- [ ] Recipient type selected

---

## 🔍 Step-by-Step Debugging

### **1. Verify Messages Table Exists**

In Supabase SQL Editor:
```sql
SELECT * FROM messages LIMIT 1;
```

**If error: "relation 'messages' does not exist"**
→ Run `supabase-schema.sql`

**If works:**
→ Table exists, continue

### **2. Check RLS Policies**

In Supabase SQL Editor:
```sql
SELECT * FROM pg_policies WHERE tablename = 'messages';
```

**If shows strict policies:**
→ Temporarily disable RLS for testing

**If no results:**
→ RLS might not be the issue

### **3. Try Manual Insert**

In Supabase SQL Editor:
```sql
INSERT INTO messages (
    title,
    content,
    page_id,
    created_by,
    recipient_type,
    status
) VALUES (
    'Test Message',
    'Test content',
    (SELECT id FROM facebook_pages LIMIT 1),  -- Get a real page ID
    (SELECT id FROM users LIMIT 1),           -- Get a real user ID
    'all',
    'draft'
);
```

**If works:**
→ Problem is with the API or authentication

**If fails:**
→ Problem is with database/RLS

---

## 🎯 Quick Fixes to Try

### **Fix 1: Disable RLS (Temporary)**

```sql
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_activity DISABLE ROW LEVEL SECURITY;
```

Try sending message again.

### **Fix 2: Re-login**

1. Logout
2. Login with Facebook
3. Try sending message

### **Fix 3: Use Different Page**

1. Try selecting a different page from dropdown
2. Some pages might have issues
3. See if one works

### **Fix 4: Simplify Message**

1. Remove any special characters
2. Use simple title: "Test"
3. Use simple content: "Testing"
4. Choose "Save Draft"
5. Try sending

---

## 📝 What to Share If Still Stuck

After trying to send a message, share:

1. **Browser Console Logs:**
   - Everything starting with `[Compose]`
   - Especially the "API error response" line

2. **Server Terminal Logs:**
   - Everything starting with `[Messages API]`
   - Especially any error lines

3. **Form Data:**
   - What page you selected
   - What you typed
   - What options you chose

This will help me pinpoint the exact issue!

---

## ✅ Expected Working Flow

When everything works, you'll see:

**Browser:**
```javascript
✅ [Compose] Submitting message: {...}
✅ [Compose] Response status: 200
✅ [Compose] Response ok: true
✅ [Compose] Message created: {success: true, message: {...}}
✅ Success! Message sent successfully!
```

**Server:**
```javascript
✅ [Messages API] POST request received
✅ [Messages API] User ID from cookie: uuid...
✅ [Messages API] Request body: {...}
✅ [Messages API] Inserting message into database...
✅ [Messages API] Message created successfully: uuid
```

**Then:**
- Success toast appears
- Redirects to dashboard
- Message saved in database ✅

---

## 🎯 Next Steps

1. **Try sending a message**
2. **Check both console and terminal logs**
3. **Share the detailed error** if it fails
4. **I'll help fix based on the specific error!**

The enhanced logging will show us exactly what's wrong! 🔍

