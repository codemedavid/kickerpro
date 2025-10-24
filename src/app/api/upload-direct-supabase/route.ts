import { NextRequest, NextResponse } from 'next/server';
// import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// interface UploadedMedia {
//   type: 'image' | 'video' | 'audio' | 'file';
//   url: string;
//   is_reusable?: boolean;
//   filename?: string;
//   size?: number;
//   mime_type?: string;
//   error?: string;
// }

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Not authenticated',
          files: []
        },
        { status: 401 }
      );
    }

    // This endpoint just returns the Supabase configuration for client-side upload
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Supabase configuration missing',
          files: []
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      supabaseUrl,
      supabaseAnonKey,
      bucketName: 'media',
      message: 'Use these credentials for direct client-side upload'
    });

  } catch (error) {
    console.error('[Upload Direct Supabase API] Caught error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get upload configuration',
        files: []
      },
      { status: 500 }
    );
  }
}
