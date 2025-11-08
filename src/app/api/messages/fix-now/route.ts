import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Immediate fix for stuck messages - triggers processing right now
 * GET /api/messages/fix-now?messageId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 });
    }

    console.log('[Fix Now] Triggering processing for message:', messageId);

    const origin = request.nextUrl.origin;
    
    // Trigger batch processing
    const processResponse = await fetch(
      `${origin}/api/messages/${messageId}/batches/process`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') || ''
        }
      }
    );

    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      console.error('[Fix Now] Processing failed:', errorText);
      
      return NextResponse.json({
        success: false,
        error: errorText,
        message: 'Failed to trigger processing'
      }, { status: 500 });
    }

    const result = await processResponse.json();
    console.log('[Fix Now] Processing result:', result);

    return NextResponse.json({
      success: true,
      message: 'Processing triggered successfully',
      result
    });

  } catch (error) {
    console.error('[Fix Now] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fix' },
      { status: 500 }
    );
  }
}



