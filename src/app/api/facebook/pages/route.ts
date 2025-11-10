/**
 * Get User's Facebook Pages
 * Fetches and syncs Facebook Pages for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserPages } from '@/lib/facebook/token-manager';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current authenticated user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's Facebook token from database
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('facebook_access_token')
      .eq('id', authUser.id)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.facebook_access_token) {
      return NextResponse.json(
        { error: 'No Facebook token found. Please connect your Facebook account first.' },
        { status: 400 }
      );
    }

    // Fetch pages from Facebook
    const pagesData = await getUserPages(user.facebook_access_token);

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.json({
        pages: [],
        message: 'No Facebook Pages found for this account',
      });
    }

    // Sync pages to database
    const pagesToUpsert = pagesData.data.map((page) => ({
      user_id: authUser.id,
      facebook_page_id: page.id,
      name: page.name,
      category: page.category,
      profile_picture: page.picture?.data?.url,
      follower_count: page.followers_count || 0,
      access_token: page.access_token,
      is_active: true,
    }));

    // Upsert pages (insert or update)
    const { error: upsertError } = await supabase
      .from('facebook_pages')
      .upsert(pagesToUpsert, {
        onConflict: 'user_id,facebook_page_id',
      });

    if (upsertError) {
      console.error('Error syncing pages:', upsertError);
      throw upsertError;
    }

    // Return synced pages
    return NextResponse.json({
      pages: pagesData.data.map((page) => ({
        id: page.id,
        name: page.name,
        category: page.category,
        picture: page.picture?.data?.url,
        followers_count: page.followers_count || 0,
      })),
      message: `Successfully synced ${pagesData.data.length} pages`,
    });
  } catch (error) {
    console.error('Get pages error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to fetch pages';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Manually sync a specific page
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current authenticated user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pageId, action } = body;

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Handle different actions
    if (action === 'toggle') {
      // Toggle page active status
      const { data: page, error: fetchError } = await supabase
        .from('facebook_pages')
        .select('is_active')
        .eq('facebook_page_id', pageId)
        .eq('user_id', authUser.id)
        .single();

      if (fetchError || !page) {
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        );
      }

      const { error: updateError } = await supabase
        .from('facebook_pages')
        .update({ is_active: !page.is_active })
        .eq('facebook_page_id', pageId)
        .eq('user_id', authUser.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        message: 'Page status updated',
        is_active: !page.is_active,
      });
    }

    if (action === 'delete') {
      // Remove page from database
      const { error: deleteError } = await supabase
        .from('facebook_pages')
        .delete()
        .eq('facebook_page_id', pageId)
        .eq('user_id', authUser.id);

      if (deleteError) {
        throw deleteError;
      }

      return NextResponse.json({
        message: 'Page removed successfully',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Page action error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to perform action';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
