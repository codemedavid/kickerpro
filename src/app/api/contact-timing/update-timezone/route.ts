/**
 * API Route: Update Contact Timezone
 * POST /api/contact-timing/update-timezone
 * 
 * Manually override the detected timezone for a contact
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
    const { conversation_id, timezone } = body;

    if (!conversation_id || !timezone) {
      return NextResponse.json(
        { error: 'conversation_id and timezone are required' },
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

    // Update the recommendation with new timezone
    const { error: updateError } = await supabase
      .from('contact_timing_recommendations')
      .update({
        timezone,
        timezone_confidence: 'high' as const,
        timezone_source: 'manual_override',
        last_computed_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversation_id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating timezone:', updateError);
      return NextResponse.json(
        { error: 'Failed to update timezone' },
        { status: 500 }
      );
    }

    // Trigger recomputation for this contact
    try {
      await fetch(`${request.nextUrl.origin}/api/contact-timing/compute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          conversation_ids: [conversation_id],
          recompute_all: false,
        }),
      });
    } catch (computeError) {
      console.error('Error triggering recomputation:', computeError);
      // Continue even if compute fails - timezone is still updated
    }

    return NextResponse.json({
      success: true,
      message: 'Timezone updated successfully',
      timezone,
    });
  } catch (error) {
    console.error('Error updating timezone:', error);
    return NextResponse.json(
      { error: 'Failed to update timezone' },
      { status: 500 }
    );
  }
}

