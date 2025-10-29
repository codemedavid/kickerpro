import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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

    const { searchParams } = new URL(request.url);
    const includeTags = searchParams.get('include_tags')?.split(',').filter(Boolean) || [];
    const excludeTags = searchParams.get('exclude_tags')?.split(',').filter(Boolean) || [];
    const search = searchParams.get('search') || '';
    const facebookPageId = searchParams.get('facebookPageId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    // Allow up to 2000 limit for bulk selection (MAX_SELECTABLE_CONTACTS)
    const limit = Math.min(2000, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    console.log('[Conversations API] Request params:', {
      includeTags,
      excludeTags,
      search,
      facebookPageId,
      startDate,
      endDate,
      page,
      limit,
      offset
    });

    const supabase = await createClient();

    const { data: accessiblePages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('facebook_page_id')
      .eq('user_id', userId);

    if (pagesError) {
      console.error('[Conversations API] Error fetching accessible pages:', pagesError);
      return NextResponse.json(
        { error: 'Failed to fetch accessible pages' },
        { status: 500 }
      );
    }

    const accessiblePageIds = (accessiblePages || []).map((p: { facebook_page_id: string }) => p.facebook_page_id);

    if (accessiblePageIds.length === 0) {
      return NextResponse.json({
        conversations: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      });
    }

    // Build the base query with proper filtering
    let query = supabase
      .from('messenger_conversations')
      .select(`
        id,
        sender_id,
        sender_name,
        last_message,
        last_message_time,
        conversation_status,
        message_count,
        page_id,
        created_at,
        updated_at
      `)
      .in('page_id', accessiblePageIds);

    // Apply page filter
    if (facebookPageId && facebookPageId !== 'all') {
      query = query.eq('page_id', facebookPageId);
    }

    // Apply date range filters
    if (startDate) {
      query = query.gte('last_message_time', startDate);
    }
    if (endDate) {
      // Add 23:59:59 to end date to include the entire day
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte('last_message_time', endDateTime.toISOString());
    }

    // Apply include tags filter (conversations that have ANY of these tags)
    if (includeTags.length > 0) {
      const { data: includedConversationIds } = await supabase
        .from('conversation_tags')
        .select('conversation_id')
        .in('tag_id', includeTags);

      if (includedConversationIds && includedConversationIds.length > 0) {
        const conversationIds = includedConversationIds.map((ct: { conversation_id: string }) => ct.conversation_id);
        query = query.in('id', conversationIds);
      } else {
        // No conversations have these tags, return empty result
        return NextResponse.json({
          conversations: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0
          }
        });
      }
    }

    // Apply exclude tags filter (conversations that DON'T have ANY of these tags)
    if (excludeTags.length > 0) {
      const { data: excludedConversationIds } = await supabase
        .from('conversation_tags')
        .select('conversation_id')
        .in('tag_id', excludeTags);

      if (excludedConversationIds && excludedConversationIds.length > 0) {
        const excludedIds = excludedConversationIds.map((ct: { conversation_id: string }) => ct.conversation_id);
        query = query.not('id', 'in', `(${excludedIds.join(',')})`);
      }
    }

    // Apply search filtering
    if (search.trim()) {
      query = query.or(`sender_name.ilike.%${search.trim()}%,last_message.ilike.%${search.trim()}%`);
    }

    // Apply ordering and pagination
    query = query
      .order('last_message_time', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: conversations, error } = await query;

    if (error) {
      console.error('[Conversations API] Error fetching conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    let conversationsWithTags = conversations || [];

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map((c: { id: string }) => c.id);

      const { data: tagsData, error: tagsError } = await supabase
        .from('conversation_tags')
        .select(`
          id,
          conversation_id,
          tag:tags(id, name, color)
        `)
        .in('conversation_id', conversationIds);

      if (tagsError) {
        console.error('[Conversations API] Error fetching conversation tags:', tagsError);
      }

      const tagsByConversation = new Map<string, Array<{ id: string; tag: { id: string; name: string; color: string } }>>();

      type ConversationTagRow = {
        id: string;
        conversation_id: string;
        tag:
          | { id: string; name: string; color: string }
          | Array<{ id: string; name: string; color: string }>
          | null;
      };

      (tagsData ?? []).forEach((row: ConversationTagRow) => {
        const castRow = row as ConversationTagRow;
        const tagRecord = Array.isArray(castRow.tag) ? castRow.tag[0] : castRow.tag;

        if (!tagRecord) {
          return;
        }

        const tagsForConversation =
          tagsByConversation.get(castRow.conversation_id) ?? [];

        tagsForConversation.push({
          id: castRow.id,
          tag: {
            id: tagRecord.id,
            name: tagRecord.name,
            color: tagRecord.color
          }
        });

        tagsByConversation.set(castRow.conversation_id, tagsForConversation);
      });

      conversationsWithTags = conversations.map((conversation: {
        id: string;
        sender_id: string;
        sender_name: string;
        last_message: string;
        last_message_time: string;
        conversation_status: string;
        message_count: number;
        page_id: string;
        created_at: string;
        updated_at: string;
      }) => ({
        ...conversation,
        conversation_tags: tagsByConversation.get(conversation.id) || []
      }));
    }

    // Get total count for pagination with same filters
    let countQuery = supabase
      .from('messenger_conversations')
      .select('id', { count: 'exact', head: true })
      .in('page_id', accessiblePageIds);

    // Apply same page filter for count
    if (facebookPageId && facebookPageId !== 'all') {
      countQuery = countQuery.eq('page_id', facebookPageId);
    }

    // Apply same date range filters for count
    if (startDate) {
      countQuery = countQuery.gte('last_message_time', startDate);
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      countQuery = countQuery.lte('last_message_time', endDateTime.toISOString());
    }

    // Apply same include tags filter for count
    if (includeTags.length > 0) {
      const { data: includedConversationIds } = await supabase
        .from('conversation_tags')
        .select('conversation_id')
        .in('tag_id', includeTags);

      if (includedConversationIds && includedConversationIds.length > 0) {
        const conversationIds = includedConversationIds.map((ct: { conversation_id: string }) => ct.conversation_id);
        countQuery = countQuery.in('id', conversationIds);
      } else {
        return NextResponse.json({
          conversations: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0
          }
        });
      }
    }

    // Apply same exclude tags filter for count
    if (excludeTags.length > 0) {
      const { data: excludedConversationIds } = await supabase
        .from('conversation_tags')
        .select('conversation_id')
        .in('tag_id', excludeTags);

      if (excludedConversationIds && excludedConversationIds.length > 0) {
        const excludedIds = excludedConversationIds.map((ct: { conversation_id: string }) => ct.conversation_id);
        countQuery = countQuery.not('id', 'in', `(${excludedIds.join(',')})`);
      }
    }

    // Apply same search filter for count
    if (search.trim()) {
      countQuery = countQuery.or(`sender_name.ilike.%${search.trim()}%,last_message.ilike.%${search.trim()}%`);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('[Conversations API] Error counting conversations:', countError);
    }

    const total = count || 0;
    const pages = Math.ceil(total / limit);

    console.log('[Conversations API] Response:', {
      conversationsCount: conversations?.length || 0,
      total,
      page,
      limit,
      pages,
      filters: {
        facebookPageId: facebookPageId || 'all',
        startDate: startDate || 'none',
        endDate: endDate || 'none',
        includeTags: includeTags.length,
        excludeTags: excludeTags.length,
        search: search || 'none'
      }
    });

    return NextResponse.json({
      conversations: conversationsWithTags,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('[Conversations API] Caught error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
