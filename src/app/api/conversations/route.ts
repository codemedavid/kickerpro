import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

const ITEMS_PER_PAGE = 20;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const internalPageId = searchParams.get('pageId'); // This is the internal UUID
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status') || 'active';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(ITEMS_PER_PAGE));

    console.log('[Conversations API] Fetching conversations for user:', userId);
    console.log('[Conversations API] Filters (raw):', { internalPageId, startDate, endDate, status, page, limit });

    const supabase = await createClient();
    
    // If pageId is provided, get the actual Facebook page ID
    let facebookPageId = null;
    if (internalPageId) {
      const { data: pageData, error: pageError } = await supabase
        .from('facebook_pages')
        .select('facebook_page_id')
        .eq('id', internalPageId)
        .single();

      if (pageError) {
        console.error('[Conversations API] Error fetching page:', pageError);
      } else {
        facebookPageId = pageData?.facebook_page_id;
        console.log('[Conversations API] Resolved page ID:', facebookPageId);
      }
    }

    console.log('[Conversations API] Resolved filters:', { facebookPageId, startDate, endDate, status });

    // Build query for total count
    let countQuery = supabase
      .from('messenger_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('conversation_status', status);

    // Build query for data
    let dataQuery = supabase
      .from('messenger_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_status', status);

    // Apply filters to both queries - use facebook_page_id, not internal ID
    if (facebookPageId) {
      console.log('[Conversations API] Filtering by Facebook page ID:', facebookPageId);
      countQuery = countQuery.eq('page_id', facebookPageId);
      dataQuery = dataQuery.eq('page_id', facebookPageId);
    }

    if (startDate) {
      // Convert startDate to beginning of day in ISO format
      const startDateTime = new Date(startDate + 'T00:00:00.000Z');
      const startDateStr = startDateTime.toISOString();
      console.log('[Conversations API] Start date filter:', startDate, '→', startDateStr);
      countQuery = countQuery.gte('last_message_time', startDateStr);
      dataQuery = dataQuery.gte('last_message_time', startDateStr);
    }

    if (endDate) {
      // Convert endDate to end of day (next day at 00:00:00)
      const endDateTime = new Date(endDate + 'T00:00:00.000Z');
      endDateTime.setDate(endDateTime.getDate() + 1); // Next day
      const endDateStr = endDateTime.toISOString();
      console.log('[Conversations API] End date filter:', endDate, '→', endDateStr);
      countQuery = countQuery.lt('last_message_time', endDateStr);
      dataQuery = dataQuery.lt('last_message_time', endDateStr);
    }

    // Get total count
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('[Conversations API] Count error:', countError);
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    console.log('[Conversations API] Total count for filters:', totalCount);

    // Apply pagination to data query
    const offset = (page - 1) * limit;
    dataQuery = dataQuery
      .order('last_message_time', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: conversations, error: dataError } = await dataQuery;

    if (dataError) {
      console.error('[Conversations API] Error fetching conversations:', dataError);
      return NextResponse.json(
        { error: dataError.message },
        { status: 500 }
      );
    }

    console.log('[Conversations API] Found', conversations?.length || 0, 'conversations for page', page, 'of', totalPages);

    return NextResponse.json({
      success: true,
      conversations: conversations || [],
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('[Conversations API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
