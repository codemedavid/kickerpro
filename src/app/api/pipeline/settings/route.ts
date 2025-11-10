import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getUserIdFromCookies } from '@/lib/auth/cookies';

/**
 * GET /api/pipeline/settings
 * Fetch pipeline settings for the current user
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: settings, error } = await supabase
      .from('pipeline_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If no settings exist, return defaults
    if (error || !settings) {
      return NextResponse.json({
        success: true,
        settings: {
          global_analysis_prompt: '',
          auto_analyze: true
        },
        isNew: true
      });
    }

    return NextResponse.json({
      success: true,
      settings,
      isNew: false
    });
  } catch (error) {
    console.error('[Pipeline Settings API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipeline/settings
 * Create or update pipeline settings
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = getUserIdFromCookies(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { global_analysis_prompt, auto_analyze } = body;

    if (!global_analysis_prompt) {
      return NextResponse.json(
        { error: 'global_analysis_prompt is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Try to update first, if not exists then insert
    const { data: existingSettings } = await supabase
      .from('pipeline_settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    let settings;
    let error;

    if (existingSettings) {
      // Update existing settings
      const result = await supabase
        .from('pipeline_settings')
        .update({
          global_analysis_prompt,
          auto_analyze: auto_analyze !== undefined ? auto_analyze : true
        })
        .eq('user_id', userId)
        .select()
        .single();

      settings = result.data;
      error = result.error;
    } else {
      // Insert new settings
      const result = await supabase
        .from('pipeline_settings')
        .insert({
          user_id: userId,
          global_analysis_prompt,
          auto_analyze: auto_analyze !== undefined ? auto_analyze : true
        })
        .select()
        .single();

      settings = result.data;
      error = result.error;
    }

    if (error) {
      console.error('[Pipeline Settings API] Error saving settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('[Pipeline Settings API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save pipeline settings' },
      { status: 500 }
    );
  }
}

