import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

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

    console.log('[Upload API] Processing', files.length, 'files');

    const uploadedFiles = [];

    for (const file of files) {
      // Validate file size (25MB limit)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `File ${file.name} is too large. Maximum size is 25MB.` },
          { status: 400 }
        );
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/mov', 'video/avi', 'video/webm',
        'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type} is not supported.` },
          { status: 400 }
        );
      }

      // For now, we'll use a public CDN approach
      // In production, you'd upload to AWS S3, Cloudinary, or similar
      const fileBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(fileBuffer).toString('base64');
      
      // Create a data URL (this is a temporary solution)
      const dataUrl = `data:${file.type};base64,${base64}`;
      
      // Determine media type
      let mediaType: 'image' | 'video' | 'audio' | 'file' = 'file';
      if (file.type.startsWith('image/')) {
        mediaType = 'image';
      } else if (file.type.startsWith('video/')) {
        mediaType = 'video';
      } else if (file.type.startsWith('audio/')) {
        mediaType = 'audio';
      }

      uploadedFiles.push({
        type: mediaType,
        url: dataUrl, // Using data URL for now
        is_reusable: true,
        filename: file.name,
        size: file.size,
        mime_type: file.type
      });

      console.log('[Upload API] Processed file:', file.name, 'Type:', mediaType, 'Size:', file.size);
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}
