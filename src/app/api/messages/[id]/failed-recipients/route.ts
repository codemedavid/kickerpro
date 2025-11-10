import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getUserIdFromCookies } from '@/lib/auth/cookies';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Verify message ownership
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, created_by, max_retry_attempts')
      .eq('id', messageId)
      .eq('created_by', userId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const maxRetryAttempts = message.max_retry_attempts || 3;

    // Get failed deliveries with retry eligibility
    const { data: failedDeliveries, error: deliveriesError } = await supabase
      .rpc('get_retryable_recipients', {
        p_message_id: messageId,
        p_max_attempts: maxRetryAttempts
      });

    if (deliveriesError) {
      console.error('[Failed Recipients API] Error fetching failed deliveries:', deliveriesError);
      return NextResponse.json(
        { error: 'Failed to fetch failed recipients' },
        { status: 500 }
      );
    }

    // Get summary by error type
    const { data: errorSummary } = await supabase
      .from('message_deliveries')
      .select('error_type, status')
      .eq('message_id', messageId)
      .eq('status', 'failed');

    const errorTypeCounts = errorSummary?.reduce((acc: Record<string, number>, curr: { error_type: string | null }) => {
      const type = curr.error_type || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Get total delivery stats
    const { data: totalStats } = await supabase
      .from('message_deliveries')
      .select('status')
      .eq('message_id', messageId);

    const stats = totalStats?.reduce((acc: { sent: number; failed: number; total: number }, curr: { status: string }) => {
      acc.total++;
      if (curr.status === 'sent') acc.sent++;
      if (curr.status === 'failed') acc.failed++;
      return acc;
    }, { sent: 0, failed: 0, total: 0 });

    return NextResponse.json({
      success: true,
      message_id: messageId,
      failed_recipients: failedDeliveries || [],
      retryable_count: failedDeliveries?.length || 0,
      error_type_counts: errorTypeCounts || {},
      stats: stats || { sent: 0, failed: 0, total: 0 },
      max_retry_attempts: maxRetryAttempts
    });
  } catch (error) {
    console.error('[Failed Recipients API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch failed recipients' },
      { status: 500 }
    );
  }
}

