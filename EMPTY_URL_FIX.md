# 🔧 Fix Empty URL Issue

## 🚨 **Root Cause Identified**

The "Must upload exactly one file" error is happening because you're sending media attachments with **empty URLs**:

```
"Sending media to Facebook: { recipient: '24855146144180037', type: 'image', url: '' }"
```

## ✅ **What I Fixed**

### **1. Added URL Validation**
- ✅ **Skip media attachments with empty URLs**
- ✅ **Skip media attachments with errors**
- ✅ **Log clear messages about skipped attachments**

### **2. Better Error Handling**
- ✅ **Don't send empty attachments to Facebook**
- ✅ **Track which attachments failed**
- ✅ **Continue with text message even if media fails**

## 🎯 **The Real Problem**

Your media upload is failing due to **Supabase RLS policy**, so the URL is empty. When Facebook receives an empty URL, it thinks you're trying to upload multiple files.

## 🚀 **Complete Fix Steps**

### **Step 1: Fix Supabase RLS Policy**
Run this SQL in your **Supabase SQL Editor**:

```sql
-- Drop restrictive policies
DROP POLICY IF EXISTS "Users can upload their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view media files" ON storage.objects;

-- Create permissive policies
CREATE POLICY "Allow authenticated users to upload media files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to media files" ON storage.objects
FOR SELECT USING (bucket_id = 'media');
```

### **Step 2: Test File Upload**
1. **Go to compose page**
2. **Upload a single image**
3. **Check browser console** - should see successful upload
4. **Check database** - should have real Supabase URL

### **Step 3: Send Message**
1. **Add some text**
2. **Send the message**
3. **Should work without Facebook errors**

## 🎉 **Expected Results**

### **Before (❌ Broken)**
- File upload fails → Empty URL → Facebook error
- "Must upload exactly one file" error
- Media not sent to Facebook

### **After (✅ Working)**
- File upload succeeds → Real Supabase URL
- No Facebook API errors
- Media sent successfully to Facebook

## 🧪 **Test It**

1. **Run the SQL fix above**
2. **Upload a single image**
3. **Send a test message**
4. **Check Facebook** - should receive the image!

**The empty URL issue will be resolved and your single image will send successfully!** 🚀
