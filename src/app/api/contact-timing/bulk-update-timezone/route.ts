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
    console.log('[Bulk Update Timezone API] Request received');
    
    // Get authenticated user from cookie
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    console.log('[Bulk Update Timezone API] User ID:', userId ? 'Found' : 'Missing');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { conversation_ids, timezone } = body;

    console.log('[Bulk Update Timezone API] Request body:', { 
      count: conversation_ids?.length, 
      timezone 
    });

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
    console.log('[Bulk Update Timezone API] Validating timezone...');
    let isValid = false;
    try {
      isValid = isValidTimezone(timezone);
      console.log('[Bulk Update Timezone API] Timezone valid:', isValid);
    } catch (validationError) {
      console.error('[Bulk Update Timezone API] Validation error:', validationError);
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

    // Update all recommendations with new timezone
    console.log('[Bulk Update Timezone API] Updating database...');
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

    console.log('[Bulk Update Timezone API] Update result:', { error: updateError, count });

    if (updateError) {
      console.error('[Bulk Update Timezone API] Database error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update timezones', details: updateError.message },
        { status: 500 }
      );
    }

    // Trigger recomputation for these contacts in background
    console.log('[Bulk Update Timezone API] Triggering recomputation...');
    try {
      const computeResponse = await fetch(`${request.nextUrl.origin}/api/contact-timing/compute`, {
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
      console.log('[Bulk Update Timezone API] Compute triggered:', computeResponse.status);
    } catch (computeError) {
      console.error('[Bulk Update Timezone API] Compute error:', computeError);
      // Continue even if compute fails - timezones are still updated
    }

    console.log('[Bulk Update Timezone API] Success!');
    return NextResponse.json({
      success: true,
      message: `Updated ${conversation_ids.length} contact(s)`,
      count: conversation_ids.length,
      timezone,
    });
  } catch (error) {
    console.error('[Bulk Update Timezone API] Unhandled error:', error);
    console.error('[Bulk Update Timezone API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { 
        error: 'Failed to update timezones',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

