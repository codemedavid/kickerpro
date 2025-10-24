# 🚀 Quick Supabase Storage Setup

## ✅ **What's Ready**

I've created everything you need:

1. **✅ New Upload API**: `/api/upload-supabase` - Uses Supabase Storage
2. **✅ Updated Compose Page**: Now uses Supabase upload API
3. **✅ SQL Setup Script**: `setup-supabase-storage.sql`
4. **✅ Test Script**: `test-supabase-storage.js`

## 🎯 **Next Steps (5 minutes)**

### **Step 1: Set Up Supabase Storage Bucket**
1. Go to your Supabase project dashboard
2. Click **Storage** → **New bucket**
3. Name: `media`
4. **✅ Make it PUBLIC** (Facebook needs access)
5. File size limit: `25 MB`
6. Click **Create bucket**

### **Step 2: Set Up RLS Policies**
In your Supabase SQL Editor, run this:

```sql
-- Allow public read access (Facebook needs this)
CREATE POLICY "Public can view media files" ON storage.objects
FOR SELECT USING (bucket_id = 'media');

-- Allow authenticated users to upload
CREATE POLICY "Users can upload their own media files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### **Step 3: Test It**
1. Go to your compose page
2. Select a file to upload
3. It should now upload to Supabase Storage
4. Check the browser console for success messages

## 🎉 **What This Fixes**

- ❌ **Before**: Test URLs blocked by robots.txt
- ✅ **After**: Real Supabase URLs that Facebook can access
- ❌ **Before**: 400 errors from missing pageId
- ✅ **After**: Proper file uploads with public URLs
- ❌ **Before**: Facebook API errors
- ✅ **After**: Reliable media sending

## 🔧 **How It Works**

1. **User selects file** → Compose page
2. **File uploads** → Supabase Storage bucket
3. **Public URL generated** → `https://your-project.supabase.co/storage/v1/object/public/media/...`
4. **URL stored in database** → With message data
5. **Facebook receives URL** → Can access without robots.txt issues
6. **Media sent successfully** → No more API errors!

## 🚨 **If You Get Errors**

### **"Bucket not found"**
- Make sure you created the `media` bucket
- Check it's set to **Public**

### **"RLS policy violation"**
- Run the SQL policies above
- Make sure the user is logged in

### **"File too large"**
- Compress the file (max 25MB)
- Or increase the bucket file size limit

## 🎯 **Ready to Test!**

Your media upload system is now ready! Just set up the Supabase bucket and you're good to go. 🚀
