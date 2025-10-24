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
    const tagIds = searchParams.get('tagIds');
    const exceptTagIds = searchParams.get('exceptTagIds');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(ITEMS_PER_PAGE));

    console.log('[Conversations API] Fetching conversations for user:', userId);
    console.log('[Conversations API] Filters (raw):', { internalPageId, startDate, endDate, status, tagIds, exceptTagIds, page, limit });

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

    console.log('[Conversations API] Resolved filters:', { facebookPageId, startDate, endDate, status, tagIds, exceptTagIds });

    // Parse tag IDs if provided
    const tagIdArray = tagIds ? tagIds.split(',').filter(id => id.trim()) : [];
    const exceptTagIdArray = exceptTagIds ? exceptTagIds.split(',').filter(id => id.trim()) : [];
    
    console.log('[Conversations API] Parsed tag arrays:', { 
      tagIdArray, 
      exceptTagIdArray, 
      tagIds, 
      exceptTagIds 
    });

    // Get conversation IDs for tag filtering
    let conversationIds: string[] | null = null;
    if (tagIdArray.length > 0) {
      console.log('[Conversations API] Filtering by tags:', tagIdArray);
      
      const { data: taggedConversations, error: tagError } = await supabase
        .from('conversation_tags')
        .select('conversation_id')
        .in('tag_id', tagIdArray);

      if (tagError) {
        console.error('[Conversations API] Error fetching tagged conversations:', tagError);
        return NextResponse.json(
          { error: 'Failed to filter by tags' },
          { status: 500 }
        );
      }

      conversationIds = taggedConversations?.map(ct => ct.conversation_id) || [];
      
      if (conversationIds.length === 0) {
        return NextResponse.json({
          success: true,
          conversations: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasMore: false
          }
        });
      }
    }

    // Get conversation IDs to exclude (optimized query)
    let exceptedConversationIds: string[] | null = null;
    if (exceptTagIdArray.length > 0) {
      console.log('[Conversations API] Excluding conversations with tags:', exceptTagIdArray);
      
      // Use a more efficient query with distinct to avoid duplicates
      const { data: exceptedConversations, error: exceptError } = await supabase
        .from('conversation_tags')
        .select('conversation_id')
        .in('tag_id', exceptTagIdArray);

      if (exceptError) {
        console.error('[Conversations API] Error fetching excepted conversations:', exceptError);
        return NextResponse.json(
          { error: 'Failed to filter by except tags' },
          { status: 500 }
        );
      }

      exceptedConversationIds = exceptedConversations?.map(ct => ct.conversation_id) || [];
      console.log('[Conversations API] Excluding', exceptedConversationIds.length, 'conversations with except tags');
    }

    // Build base query
    let baseQuery = supabase
      .from('messenger_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_status', status);

    console.log('[Conversations API] Base query created for user:', userId, 'status:', status);

    // Apply include tag filter first
    if (conversationIds && conversationIds.length > 0) {
      console.log('[Conversations API] Applying include tag filter with', conversationIds.length, 'conversation IDs');
      baseQuery = baseQuery.in('id', conversationIds);
    } else {
      console.log('[Conversations API] No include tag filter - loading all conversations');
    }
    
    // Apply except tag filter - we'll handle this after getting the data
    // to avoid Supabase parsing issues with large arrays

    // Create count and data queries from base query
    let countQuery = baseQuery.select('*', { count: 'exact', head: true });
    let dataQuery = baseQuery.select('*');

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
    
    // If we have exclusions, get more data to account for filtered results
    const queryLimit = exceptedConversationIds && exceptedConversationIds.length > 0 
      ? limit * 3  // Get 3x the limit to account for exclusions
      : limit;
    
    dataQuery = dataQuery
      .order('last_message_time', { ascending: false })
      .range(offset, offset + queryLimit - 1);

    const { data: conversations, error: dataError } = await dataQuery;

    if (dataError) {
      console.error('[Conversations API] Error fetching conversations:', dataError);
      return NextResponse.json(
        { error: dataError.message },
        { status: 500 }
      );
    }

    console.log('[Conversations API] Found', conversations?.length || 0, 'conversations for page', page, 'of', totalPages);

    // Apply exclude filter after getting the data
    let finalConversations = conversations || [];
    if (exceptedConversationIds && exceptedConversationIds.length > 0) {
      console.log('[Conversations API] Filtering out excluded conversations in application layer');
      finalConversations = finalConversations.filter(conv => 
        !exceptedConversationIds.includes(conv.id)
      );
      console.log('[Conversations API] After exclude filter:', finalConversations.length, 'conversations remaining');
      
      // Take only the first 'limit' conversations to maintain pagination
      finalConversations = finalConversations.slice(0, limit);
    }

    return NextResponse.json({
      success: true,
      conversations: finalConversations,
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
