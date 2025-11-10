import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';
import { createClient } from '@/lib/supabase/server';

/**
 * Get all AI automation rules for the current user
 * GET /api/ai-automations
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: rules, error } = await supabase
      .from('ai_automation_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AI Automations] Error fetching rules:', error);
      return NextResponse.json({ error: 'Failed to fetch automation rules' }, { status: 500 });
    }

    return NextResponse.json({ rules: rules || [] });

  } catch (error) {
    console.error('[AI Automations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create a new AI automation rule
 * POST /api/ai-automations
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    console.log('[AI Automations POST] User ID:', userId);

    if (!userId) {
      console.error('[AI Automations POST] Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[AI Automations POST] Request body:', JSON.stringify(body, null, 2));

    const {
      name,
      description,
      enabled = true,
      trigger_type = 'time_based',
      time_interval_minutes,
      time_interval_hours,
      time_interval_days,
      page_id,
      include_tag_ids,
      exclude_tag_ids,
      custom_prompt,
      language_style = 'taglish',
      message_tag = 'ACCOUNT_UPDATE',
      max_messages_per_day = 100,
      active_hours_start = 9,
      active_hours_end = 21,
      active_hours_start_minutes = 0,
      active_hours_end_minutes = 0,
      run_24_7 = false,
      max_follow_ups,
      follow_up_sequence,
      stop_on_reply,
      remove_tag_on_reply
    } = body;

    console.log('[AI Automations POST] Validation - name:', name);
    console.log('[AI Automations POST] Validation - custom_prompt:', custom_prompt);
    console.log('[AI Automations POST] Validation - intervals:', { 
      minutes: time_interval_minutes, 
      hours: time_interval_hours, 
      days: time_interval_days 
    });

    if (!name || !custom_prompt) {
      console.error('[AI Automations POST] Missing required fields:', { name: !!name, custom_prompt: !!custom_prompt });
      return NextResponse.json(
        { error: 'Name and custom_prompt are required' },
        { status: 400 }
      );
    }

    if (!time_interval_minutes && !time_interval_hours && !time_interval_days) {
      console.error('[AI Automations POST] No time interval specified');
      return NextResponse.json(
        { error: 'At least one time interval (minutes, hours, or days) is required' },
        { status: 400 }
      );
    }

    // Validate that include and exclude tags don't overlap
    if (include_tag_ids && exclude_tag_ids) {
      const includeSet = new Set(include_tag_ids);
      const overlappingTags = exclude_tag_ids.filter((tagId: string) => includeSet.has(tagId));
      
      if (overlappingTags.length > 0) {
        console.error('[AI Automations POST] Overlapping tags detected:', overlappingTags);
        return NextResponse.json(
          { error: 'Cannot include and exclude the same tag(s). Please remove duplicate tags.' },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Build rule data object, only including fields that are defined
    const ruleData: Record<string, unknown> = {
      user_id: userId,
      name,
      description,
      enabled,
      trigger_type,
      custom_prompt,
      language_style,
      message_tag,
      max_messages_per_day,
      active_hours_start,
      active_hours_end,
      active_hours_start_minutes,
      active_hours_end_minutes,
      run_24_7,
      include_tag_ids: include_tag_ids || [],
      exclude_tag_ids: exclude_tag_ids || []
    };

    // Add optional time intervals
    if (time_interval_minutes) ruleData.time_interval_minutes = time_interval_minutes;
    if (time_interval_hours) ruleData.time_interval_hours = time_interval_hours;
    if (time_interval_days) ruleData.time_interval_days = time_interval_days;

    // Add optional fields (may not exist in database)
    if (page_id) ruleData.page_id = page_id;
    if (max_follow_ups !== null && max_follow_ups !== undefined) ruleData.max_follow_ups = max_follow_ups;
    if (follow_up_sequence) ruleData.follow_up_sequence = follow_up_sequence;
    if (stop_on_reply !== undefined) ruleData.stop_on_reply = stop_on_reply;
    if (remove_tag_on_reply) ruleData.remove_tag_on_reply = remove_tag_on_reply;

    console.log('[AI Automations POST] Rule data to insert:', JSON.stringify(ruleData, null, 2));

    const { data: rule, error } = await supabase
      .from('ai_automation_rules')
      .insert(ruleData)
      .select()
      .single();

    if (error) {
      console.error('[AI Automations POST] Database error:', error);
      console.error('[AI Automations POST] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Return DETAILED error to browser
      return NextResponse.json({ 
        error: 'Failed to create automation rule',
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        errorCode: error.code,
        debugInfo: {
          attempted_insert: Object.keys(ruleData),
          user_id_present: !!userId,
          data_sent: ruleData
        }
      }, { status: 500 });
    }

    console.log('[AI Automations] Created rule:', rule.id, rule.name);

    return NextResponse.json({ rule }, { status: 201 });

  } catch (error) {
    console.error('[AI Automations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

