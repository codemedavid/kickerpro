# 🔧 Fix 413 "Payload Too Large" Error in Deployment

## 🚨 **The Problem**

- ✅ **Local development**: Works fine
- ❌ **Deployed version**: 413 "Payload Too Large" error
- **Cause**: Deployment platforms have stricter file size limits

## ✅ **What I Fixed**

### **1. Next.js Configuration** (`next.config.js`)
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js']
  },
  api: {
    bodyParser: {
      sizeLimit: '25mb', // 25MB limit
    },
  },
  serverless: {
    timeout: 30,
  },
  // ... headers configuration
};
```

### **2. Vercel Configuration** (`vercel.json`)
```json
{
  "functions": {
    "src/app/api/upload-supabase/route.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/upload-supabase",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

### **3. Upload API Improvements**
- ✅ **Content-Length check** before processing
- ✅ **Better error messages** for 413 errors
- ✅ **Consistent JSON responses**

## 🚀 **Deployment-Specific Fixes**

### **For Vercel:**
1. **Add `vercel.json`** (already created)
2. **Set environment variables** if needed
3. **Redeploy** the application

### **For Netlify:**
Create `netlify.toml`:
```toml
[build]
  command = "npm run build"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[functions]
  timeout = 30
```

### **For Railway:**
Add to `railway.json`:
```json
{
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health"
  }
}
```

## 🎯 **Alternative Solutions**

### **Option 1: Reduce File Size**
- Compress images before upload
- Use smaller file formats
- Implement client-side compression

### **Option 2: Use Direct Supabase Upload**
```javascript
// Upload directly to Supabase from frontend
const { data, error } = await supabase.storage
  .from('media')
  .upload(filePath, file);
```

### **Option 3: Chunked Upload**
- Split large files into smaller chunks
- Upload chunks separately
- Reassemble on server

## 🧪 **Test After Fix**

1. **Redeploy your application**
2. **Try uploading a small file first** (< 1MB)
3. **Gradually increase file size**
4. **Check deployment logs** for any errors

## 🎉 **Expected Results**

- ✅ **Small files** (< 5MB): Should work
- ✅ **Medium files** (5-15MB): Should work with new config
- ✅ **Large files** (> 15MB): May need chunked upload approach

## 🚨 **If Still Getting 413**

1. **Check deployment platform limits**
2. **Consider using Supabase direct upload**
3. **Implement file compression**
4. **Use chunked upload for large files**

**The 413 error should be resolved with these configuration changes!** 🚀
