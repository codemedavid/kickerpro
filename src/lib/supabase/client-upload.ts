import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface UploadedMedia {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  is_reusable?: boolean;
  filename?: string;
  size?: number;
  mime_type?: string;
  error?: string;
}

export async function uploadFilesDirectly(
  files: File[],
  userId: string
): Promise<{ success: boolean; files: UploadedMedia[]; message: string }> {
  const uploadedFiles: UploadedMedia[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const maxSize = 25 * 1024 * 1024; // 25MB
    
    if (file.size > maxSize) {
      console.warn(`[Direct Upload] File ${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Max is 25MB.`);
      uploadedFiles.push({
        type: 'file',
        url: '',
        filename: file.name,
        size: file.size,
        mime_type: file.type,
        error: `File too large (>${(maxSize / (1024 * 1024)).toFixed(0)}MB)`
      });
      continue;
    }

    // Determine media type
    let mediaType: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (file.type.startsWith('image/')) {
      mediaType = 'image';
    } else if (file.type.startsWith('video/')) {
      mediaType = 'video';
    } else if (file.type.startsWith('audio/')) {
      mediaType = 'audio';
    }

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}-${i}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `media/${userId}/${fileName}`;

      console.log(`[Direct Upload] Uploading ${file.name} to Supabase Storage as ${filePath}`);

       // Upload to Supabase Storage directly from client
       const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error(`[Direct Upload] Supabase upload error for ${file.name}:`, uploadError);
        uploadedFiles.push({
          type: mediaType,
          url: '',
          filename: file.name,
          size: file.size,
          mime_type: file.type,
          error: uploadError.message
        });
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      console.log(`[Direct Upload] Successfully uploaded ${file.name} to Supabase. Public URL: ${publicUrl}`);

      uploadedFiles.push({
        type: mediaType,
        url: publicUrl,
        is_reusable: true,
        filename: file.name,
        size: file.size,
        mime_type: file.type
      });

      // Add a small delay between uploads to avoid rate limiting
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (uploadError) {
      console.error(`[Direct Upload] Network error during Supabase upload for ${file.name}:`, uploadError);
      uploadedFiles.push({
        type: mediaType,
        url: '',
        filename: file.name,
        size: file.size,
        mime_type: file.type,
        error: uploadError instanceof Error ? uploadError.message : 'Network error during upload'
      });
    }
  }

  return {
    success: true,
    files: uploadedFiles,
    message: `Successfully processed ${uploadedFiles.length} file(s)`
  };
}
