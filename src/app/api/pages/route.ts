import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data: pages, error } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Pages API] Error fetching pages:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(pages || []);
  } catch (error) {
    console.error('[Pages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pages } = body;

    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: 'No pages provided' },
        { status: 400 }
      );
    }

    console.log('[Pages API] Connecting', pages.length, 'pages for user:', userId);

    const supabase = await createClient();
    const results = [];

    for (const page of pages) {
      try {
        // Check if page already exists
        const { data: existing } = await supabase
          .from('facebook_pages')
          .select('*')
          .eq('facebook_page_id', page.id)
          .single();

        if (existing) {
          // Update existing page
          const { data: updated, error: updateError } = await supabase
            .from('facebook_pages')
            .update({
              name: page.name,
              category: page.category || null,
              profile_picture: page.picture?.data?.url || null,
              follower_count: page.fan_count || 0,
              access_token: page.access_token,
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('facebook_page_id', page.id)
            .select()
            .single();

          if (updateError) {
            console.error('[Pages API] Update error for page', page.id, updateError);
            results.push({ id: page.id, success: false, error: updateError.message });
          } else {
            console.log('[Pages API] Updated page:', page.name);
            results.push({ id: page.id, success: true, data: updated });
          }
        } else {
          // Insert new page
          const { data: inserted, error: insertError } = await supabase
            .from('facebook_pages')
            .insert({
              facebook_page_id: page.id,
              user_id: userId,
              name: page.name,
              category: page.category || null,
              profile_picture: page.picture?.data?.url || null,
              follower_count: page.fan_count || 0,
              access_token: page.access_token,
              is_active: true
            })
            .select()
            .single();

          if (insertError) {
            console.error('[Pages API] Insert error for page', page.id, insertError);
            results.push({ id: page.id, success: false, error: insertError.message });
          } else {
            console.log('[Pages API] Inserted new page:', page.name);
            results.push({ id: page.id, success: true, data: inserted });
          }
        }
      } catch (error) {
        console.error('[Pages API] Error processing page', page.id, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ id: page.id, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log('[Pages API] Connected', successCount, 'pages successfully,', failCount, 'failed');

    return NextResponse.json({
      success: true,
      connected: successCount,
      failed: failCount,
      results
    });
  } catch (error) {
    console.error('[Pages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to connect pages' },
      { status: 500 }
    );
  }
}

