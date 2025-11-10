/**
 * API Route: Update Contact Timezone
 * POST /api/contact-timing/update-timezone
 * 
 * Manually override the detected timezone for a contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';
import { isValidTimezone } from '@/lib/contact-timing/timezone';

export async function POST(request: NextRequest) {
  try {
    console.log('[Update Timezone API] Request received');
    
    // Get authenticated user from cookie
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    console.log('[Update Timezone API] User ID:', userId ? 'Found' : 'Missing');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { conversation_id, timezone } = body;

    console.log('[Update Timezone API] Request body:', { conversation_id, timezone });

    if (!conversation_id || !timezone) {
      return NextResponse.json(
        { error: 'conversation_id and timezone are required' },
        { status: 400 }
      );
    }

    // Validate timezone
    console.log('[Update Timezone API] Validating timezone...');
    let isValid = false;
    try {
      isValid = isValidTimezone(timezone);
      console.log('[Update Timezone API] Timezone valid:', isValid);
    } catch (validationError) {
      console.error('[Update Timezone API] Validation error:', validationError);
      return NextResponse.json(
        { error: 'Timezone validation failed', details: String(validationError) },
        { status: 400 }
      );
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid timezone' },
        { status: 400 }
      );
    }

    // Update the recommendation with new timezone
    console.log('[Update Timezone API] Updating database...');
    console.log('[Update Timezone API] Query params:', {
      conversation_id,
      user_id: userId,
      timezone
    });
    
    const { data: updatedRows, error: updateError } = await supabase
      .from('contact_timing_recommendations')
      .update({
        timezone,
        timezone_confidence: 'high' as const,
        timezone_source: 'manual_override',
        last_computed_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversation_id)
      .eq('user_id', userId)
      .select('id, conversation_id, timezone');

    const count = updatedRows?.length || 0;
    console.log('[Update Timezone API] Update result:', { 
      error: updateError, 
      count,
      updatedRows
    });

    if (updateError) {
      console.error('[Update Timezone API] Database error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update timezone', details: updateError.message },
        { status: 500 }
      );
    }

    // Trigger recomputation for this contact
    console.log('[Update Timezone API] Triggering recomputation...');
    try {
      const computeResponse = await fetch(`${request.nextUrl.origin}/api/contact-timing/compute`, {
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
      console.log('[Update Timezone API] Compute triggered:', computeResponse.status);
    } catch (computeError) {
      console.error('[Update Timezone API] Compute error:', computeError);
      // Continue even if compute fails - timezone is still updated
    }

    console.log('[Update Timezone API] Success!');
    return NextResponse.json({
      success: true,
      message: 'Timezone updated successfully',
      timezone,
    });
  } catch (error) {
    console.error('[Update Timezone API] Unhandled error:', error);
    console.error('[Update Timezone API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { 
        error: 'Failed to update timezone', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

