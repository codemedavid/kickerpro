# 📦 Supabase Storage Setup for Media Attachments

## 🎯 **Overview**

This guide will help you set up Supabase Storage for media file uploads that Facebook can access reliably.

## 🚀 **Step 1: Create Storage Bucket**

### **Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Set these values:
   - **Name**: `media`
   - **Public bucket**: ✅ **Yes** (Facebook needs public access)
   - **File size limit**: `25 MB`
   - **Allowed MIME types**: 
     ```
     image/jpeg,image/png,image/gif,image/webp,
     video/mp4,video/quicktime,video/x-msvideo,
     audio/mpeg,audio/wav,audio/ogg,
     application/pdf,text/plain,
     application/msword,
     application/vnd.openxmlformats-officedocument.wordprocessingml.document
     ```

### **Option B: Using SQL Script**
Run the `setup-supabase-storage.sql` script in your Supabase SQL Editor:

```sql
-- Create the media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true, -- Public bucket
  26214400, -- 25MB limit
  ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/x-msvideo','audio/mpeg','audio/wav','audio/ogg','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;
```

## 🔐 **Step 2: Set Up RLS Policies**

In your Supabase SQL Editor, run these policies:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload their own media files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access (Facebook needs this)
CREATE POLICY "Public can view media files" ON storage.objects
FOR SELECT USING (bucket_id = 'media');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own media files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## 🧪 **Step 3: Test the Setup**

Run the test script to verify everything works:

```bash
cd /Users/codemedavid/Downloads/public_html/nextjs-app
node test-supabase-storage.js
```

Expected output:
```
🧪 Testing Supabase Storage Setup...

1. Checking if media bucket exists...
✅ Media bucket exists: { id: 'media', name: 'media', public: true, ... }

2. Testing file upload...
✅ File uploaded successfully: { path: 'test/test-1234567890.txt', ... }

3. Testing public URL generation...
✅ Public URL generated: https://your-project.supabase.co/storage/v1/object/public/media/test/test-1234567890.txt

4. Testing URL accessibility...
✅ URL is publicly accessible
✅ Content matches: true

5. Cleaning up test file...
✅ Test file cleaned up

🎉 Supabase Storage is working correctly!
```

## 📁 **Step 4: File Structure**

Your uploaded files will be organized like this:
```
media/
├── user-123/
│   ├── 1703123456789-image.jpg
│   ├── 1703123456790-video.mp4
│   └── 1703123456791-document.pdf
└── user-456/
    └── 1703123456792-audio.mp3
```

## 🔗 **Step 5: Public URLs**

Files will be accessible via URLs like:
```
https://your-project.supabase.co/storage/v1/object/public/media/user-123/1703123456789-image.jpg
```

These URLs are:
- ✅ **Publicly accessible** (no authentication required)
- ✅ **HTTPS** (Facebook requirement)
- ✅ **No robots.txt restrictions**
- ✅ **Fast CDN delivery**

## 🎯 **Step 6: Update Your App**

The compose page is already updated to use `/api/upload-supabase`. Just make sure your Supabase credentials are set in your environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🚨 **Troubleshooting**

### **Error: "Bucket not found"**
- Make sure you created the `media` bucket
- Check that the bucket is public

### **Error: "RLS policy violation"**
- Make sure you set up the RLS policies
- Check that the user is authenticated

### **Error: "File too large"**
- Check the file size limit (25MB max)
- Compress large files before upload

### **Error: "MIME type not allowed"**
- Check the allowed MIME types in bucket settings
- Add your file type to the allowed list

## 🎉 **You're Ready!**

Once the test passes, your media upload system will:
1. Upload files to Supabase Storage
2. Generate public URLs
3. Store URLs in your database
4. Send media to Facebook using the URLs
5. Facebook can access the URLs without issues

**No more robots.txt errors!** 🚀
