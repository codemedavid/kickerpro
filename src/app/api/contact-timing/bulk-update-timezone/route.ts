/**
 * API Route: Bulk Update Contact Timezones
 * POST /api/contact-timing/bulk-update-timezone
 * 
 * Update timezone for multiple contacts at once
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { isValidTimezone } from '@/lib/contact-timing/timezone';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from cookie
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { conversation_ids, timezone } = body;

    if (!conversation_ids || !Array.isArray(conversation_ids) || conversation_ids.length === 0) {
      return NextResponse.json(
        { error: 'conversation_ids array is required' },
        { status: 400 }
      );
    }

    if (!timezone) {
      return NextResponse.json(
        { error: 'timezone is required' },
        { status: 400 }
      );
    }

    // Validate timezone
    if (!isValidTimezone(timezone)) {
      return NextResponse.json(
        { error: 'Invalid timezone' },
        { status: 400 }
      );
    }

    // Update all recommendations with new timezone
    const { error: updateError, count } = await supabase
      .from('contact_timing_recommendations')
      .update({
        timezone,
        timezone_confidence: 'high' as const,
        timezone_source: 'manual_override',
        last_computed_at: new Date().toISOString(),
      })
      .in('conversation_id', conversation_ids)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error bulk updating timezone:', updateError);
      return NextResponse.json(
        { error: 'Failed to update timezones' },
        { status: 500 }
      );
    }

    // Trigger recomputation for these contacts in background
    try {
      await fetch(`${request.nextUrl.origin}/api/contact-timing/compute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          conversation_ids,
          recompute_all: false,
        }),
      });
    } catch (computeError) {
      console.error('Error triggering bulk recomputation:', computeError);
      // Continue even if compute fails - timezones are still updated
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${conversation_ids.length} contact(s)`,
      count: conversation_ids.length,
      timezone,
    });
  } catch (error) {
    console.error('Error bulk updating timezones:', error);
    return NextResponse.json(
      { error: 'Failed to update timezones' },
      { status: 500 }
    );
  }
}

