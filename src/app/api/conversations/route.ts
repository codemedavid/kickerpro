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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    console.log('[Conversations API] Request params:', {
      includeTags,
      excludeTags,
      search,
      page,
      limit,
      offset
    });

    const supabase = await createClient();

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
        created_at,
        updated_at,
        conversation_tags(
          id,
          tag:tags(id, name, color)
        )
      `)
      .eq('user_id', userId);

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

    // Get total count for pagination with same filters
    let countQuery = supabase
      .from('messenger_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

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
      pages
    });

    return NextResponse.json({
      conversations: conversations || [],
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