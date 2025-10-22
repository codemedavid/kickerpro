# 🔍 Diagnose: Only Getting 50 Pages

## 🐛 Issue

You're seeing only 50 of your Facebook pages instead of all of them.

---

## ⚡ Quick Diagnosis

### **Step 1: Run Debug Endpoint**

**Open this URL in your browser:**
```
http://localhost:3000/api/facebook/pages/debug
```

**This will show:**
- How many batches were fetched
- How many pages per batch
- If pagination is working
- Any errors

**Example Output:**
```json
{
  "success": true,
  "message": "Found 50 total pages in 1 batch(es)",
  "debug": {
    "batches": [
      {
        "batch_number": 1,
        "pages_in_batch": 50,
        "has_next": true,  ← If this is true, there should be more!
        "next_cursor": "abc123...",
        "sample_page_names": ["Page 1", "Page 2", ...]
      }
    ],
    "total_pages": 50
  },
  "recommendation": "⚠️ There are more pages but pagination might not be working correctly."
}
```

---

## 🔍 Common Causes

### **Cause 1: Facebook App Not Approved**

If your app is in Development mode, Facebook might limit results.

**Check:**
1. Go to developers.facebook.com → Your App
2. Check if "Development" or "Live"
3. If Development, this might be the limit

**Solution:**
- Add more test users
- OR submit for app review to go Live

---

### **Cause 2: Token Permissions Missing**

**Check permissions:**

```javascript
// In browser console after login
FB.api('/me/permissions', function(response) {
  console.log('Permissions:', response);
});
```

**Should show:**
```json
{
  "data": [
    { "permission": "pages_show_list", "status": "granted" },
    { "permission": "pages_manage_posts", "status": "granted" },
    { "permission": "pages_messaging", "status": "granted" }
  ]
}
```

**If any are "declined":**
- Logout → Login again
- Make sure to allow ALL permissions

---

### **Cause 3: Pagination Not Working**

**Check server logs:**

Look for:
```
[Facebook Pages API] Fetching batch 1...
[Facebook Pages API] ✅ Got 50 pages in batch 1. Total so far: 50
[Facebook Pages API] 📄 More pages available, fetching next batch...
[Facebook Pages API] Fetching batch 2...
```

**If you don't see batch 2:**
- Pagination stopped early
- Check for errors in logs

---

### **Cause 4: Facebook API Default Limit**

Facebook might be applying a default limit despite our request for 100.

**Workaround:** I'll add a manual override

---

## ✅ Fix: Force Higher Limit

Let me check the actual response and try different approaches:

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">/Users/codemedavid/Downloads/public_html/nextjs-app/src/app/api/facebook/pages/route.ts
