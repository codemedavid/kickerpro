import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

interface UploadedMedia {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  is_reusable?: boolean;
  filename?: string;
  size?: number;
  mime_type?: string;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    console.log('[Upload Supabase API] Processing', files.length, 'files for user:', userId);

    const supabase = await createClient();
    const uploadedFiles: UploadedMedia[] = [];

    // Process files one by one to avoid Facebook API conflicts
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const maxSize = 25 * 1024 * 1024; // 25MB
      
      if (file.size > maxSize) {
        console.warn(`[Upload Supabase API] File ${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Max is 25MB.`);
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
        // Generate unique filename with index to avoid conflicts
        const timestamp = Date.now();
        // const fileExtension = file.name.split('.').pop() || '';
        const fileName = `${timestamp}-${i}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `media/${userId}/${fileName}`;

        console.log(`[Upload Supabase API] Uploading ${file.name} (${i + 1}/${files.length}) to Supabase Storage as ${filePath}`);

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error(`[Upload Supabase API] Supabase upload error for ${file.name}:`, uploadError);
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

        console.log(`[Upload Supabase API] Successfully uploaded ${file.name} to Supabase. Public URL: ${publicUrl}`);

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
        console.error(`[Upload Supabase API] Network error during Supabase upload for ${file.name}:`, uploadError);
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

    return NextResponse.json({ 
      success: true, 
      files: uploadedFiles,
      message: `Successfully processed ${uploadedFiles.length} file(s)`
    });

  } catch (error) {
    console.error('[Upload Supabase API] Caught error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload files' },
      { status: 500 }
    );
  }
}
