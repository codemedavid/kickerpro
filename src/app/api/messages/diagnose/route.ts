import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Comprehensive diagnostics for message sending issues
 * GET /api/messages/diagnose?messageId=xxx
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

    const supabase = await createClient();

    // Get all sending messages if no specific ID
    const query = supabase
      .from('messages')
      .select('*')
      .eq('status', 'sending')
      .order('created_at', { ascending: false });

    if (messageId) {
      query.eq('id', messageId);
    }

    const { data: messages, error: messageError } = await query;

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        status: 'ok',
        message: 'No messages stuck in sending status',
        stuck_messages: []
      });
    }

    const diagnostics = [];

    for (const message of messages) {
      console.log(`[Diagnose] Checking message: ${message.id} - ${message.title}`);

      // Get all batches for this message
      const { data: batches } = await supabase
        .from('message_batches')
        .select('*')
        .eq('message_id', message.id)
        .order('batch_number', { ascending: true });

      // Get page info
      const { data: page } = await supabase
        .from('facebook_pages')
        .select('name, facebook_page_id, access_token')
        .eq('id', message.page_id)
        .single();

      const batchSummary = {
        total: batches?.length || 0,
        pending: batches?.filter(b => b.status === 'pending').length || 0,
        processing: batches?.filter(b => b.status === 'processing').length || 0,
        completed: batches?.filter(b => b.status === 'completed').length || 0,
        failed: batches?.filter(b => b.status === 'failed').length || 0,
        total_sent: batches?.reduce((sum, b) => sum + (b.sent_count || 0), 0) || 0,
        total_failed: batches?.reduce((sum, b) => sum + (b.failed_count || 0), 0) || 0
      };

      const stuckFor = message.created_at 
        ? Math.floor((Date.now() - new Date(message.created_at).getTime()) / 1000)
        : 0;

      diagnostics.push({
        message: {
          id: message.id,
          title: message.title,
          status: message.status,
          recipient_count: message.recipient_count,
          delivered_count: message.delivered_count,
          created_at: message.created_at,
          stuck_for_seconds: stuckFor,
          stuck_for_minutes: Math.floor(stuckFor / 60),
          error_message: message.error_message
        },
        page: {
          name: page?.name || 'Unknown',
          facebook_page_id: page?.facebook_page_id || 'Unknown',
          has_access_token: !!page?.access_token
        },
        batches: batchSummary,
        batch_details: batches?.map(b => ({
          batch_number: b.batch_number,
          status: b.status,
          recipient_count: b.recipient_count,
          sent_count: b.sent_count || 0,
          failed_count: b.failed_count || 0,
          started_at: b.started_at,
          completed_at: b.completed_at,
          has_recipients: Array.isArray(b.recipients) && b.recipients.length > 0
        })),
        diagnosis: diagnoseIssue(message, batches, page, stuckFor)
      });
    }

    return NextResponse.json({
      status: 'found_issues',
      total_stuck: diagnostics.length,
      diagnostics
    });

  } catch (error) {
    console.error('[Diagnose] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Diagnostic failed' },
      { status: 500 }
    );
  }
}

function diagnoseIssue(message: any, batches: any[] | null, page: any, stuckForSeconds: number): any {
  const issues = [];
  const recommendations = [];

  // Check 1: No batches created
  if (!batches || batches.length === 0) {
    issues.push('No batches were created for this message');
    recommendations.push('Run rescue endpoint to mark as failed or retry');
    return { issues, recommendations, severity: 'critical' };
  }

  // Check 2: All batches pending
  const allPending = batches.every(b => b.status === 'pending');
  if (allPending) {
    issues.push('All batches are still pending - processing never started');
    recommendations.push('Trigger batch processing manually via /api/messages/' + message.id + '/batches/process');
    return { issues, recommendations, severity: 'high' };
  }

  // Check 3: Some batches still processing
  const processing = batches.filter(b => b.status === 'processing');
  if (processing.length > 0) {
    issues.push(`${processing.length} batch(es) stuck in 'processing' status`);
    
    processing.forEach(b => {
      if (b.started_at) {
        const processingTime = Math.floor((Date.now() - new Date(b.started_at).getTime()) / 1000);
        if (processingTime > 300) { // 5 minutes
          issues.push(`Batch ${b.batch_number} has been processing for ${Math.floor(processingTime / 60)} minutes`);
        }
      }
    });
    
    recommendations.push('These batches may have crashed. Mark them as failed and retry.');
    return { issues, recommendations, severity: 'high' };
  }

  // Check 4: All batches completed but message still sending
  const allCompleted = batches.every(b => b.status === 'completed');
  if (allCompleted) {
    const totalSent = batches.reduce((sum, b) => sum + (b.sent_count || 0), 0);
    const totalFailed = batches.reduce((sum, b) => sum + (b.failed_count || 0), 0);
    
    issues.push('All batches completed but message status not updated');
    issues.push(`${totalSent} sent, ${totalFailed} failed`);
    
    const finalStatus = totalSent > 0 
      ? (totalFailed > 0 ? 'partially_sent' : 'sent')
      : 'failed';
    
    recommendations.push(`Update message status to: ${finalStatus}`);
    recommendations.push('Run rescue endpoint to fix this automatically');
    return { issues, recommendations, severity: 'medium', suggested_status: finalStatus };
  }

  // Check 5: No access token
  if (!page?.access_token) {
    issues.push('Facebook page access token is missing');
    recommendations.push('Reconnect Facebook page in settings');
    return { issues, recommendations, severity: 'critical' };
  }

  // Check 6: Stuck for too long
  if (stuckForSeconds > 600) { // 10 minutes
    issues.push(`Message stuck for ${Math.floor(stuckForSeconds / 60)} minutes`);
    recommendations.push('This is abnormal. Run rescue endpoint or manually mark as failed.');
    return { issues, recommendations, severity: 'high' };
  }

  // Default
  issues.push('Message status unclear - needs investigation');
  recommendations.push('Check server logs for errors');
  recommendations.push('Try rescue endpoint');
  return { issues, recommendations, severity: 'medium' };
}

/**
 * Force fix a stuck message
 * POST /api/messages/diagnose
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 });
    }

    console.log('[Diagnose] Force fixing message:', messageId);

    const supabase = await createClient();

    // Get message
    const { data: message } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Get batches
    const { data: batches } = await supabase
      .from('message_batches')
      .select('*')
      .eq('message_id', messageId);

    if (!batches || batches.length === 0) {
      // No batches - mark as failed
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          error_message: 'No batches created - force fixed by diagnostics'
        })
        .eq('id', messageId);

      return NextResponse.json({
        success: true,
        action: 'marked_failed',
        reason: 'no_batches'
      });
    }

    // Calculate totals
    const totalSent = batches.reduce((sum, b) => sum + (b.sent_count || 0), 0);
    const totalFailed = batches.reduce((sum, b) => sum + (b.failed_count || 0), 0);
    
    // Determine final status
    const finalStatus = totalSent > 0 
      ? (totalFailed > 0 ? 'partially_sent' : 'sent')
      : 'failed';

    // Update message
    await supabase
      .from('messages')
      .update({
        status: finalStatus,
        delivered_count: totalSent,
        sent_at: new Date().toISOString(),
        error_message: totalFailed > 0 ? `${totalFailed} failed, ${totalSent} sent` : null
      })
      .eq('id', messageId);

    // Mark any stuck batches as completed
    await supabase
      .from('message_batches')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('message_id', messageId)
      .in('status', ['pending', 'processing']);

    return NextResponse.json({
      success: true,
      action: 'force_fixed',
      final_status: finalStatus,
      sent: totalSent,
      failed: totalFailed
    });

  } catch (error) {
    console.error('[Diagnose] Force fix error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fix failed' },
      { status: 500 }
    );
  }
}






