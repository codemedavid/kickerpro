/**
 * API Route: Get Best Contact Time Recommendations
 * GET /api/contact-timing/recommendations
 * 
 * Retrieves ranked contact recommendations sorted by composite score
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from cookie
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sort_by') || 'composite_score';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const minConfidence = parseFloat(searchParams.get('min_confidence') || '0');
    const activeOnly = searchParams.get('active_only') === 'true';
    const search = searchParams.get('search') || '';
    const pageId = searchParams.get('page_id') || null;

    // Build query
    let query = supabase
      .from('contact_timing_recommendations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    // Filters
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (minConfidence > 0) {
      query = query.gte('max_confidence', minConfidence);
    }

    if (search) {
      query = query.ilike('sender_name', `%${search}%`);
    }

    // Remove contacts in cooldown
    const now = new Date().toISOString();
    query = query.or(`cooldown_until.is.null,cooldown_until.lt.${now}`);

    // Filter by page if specified
    if (pageId) {
      // Get conversation IDs for this page
      const { data: pageConvs } = await supabase
        .from('messenger_conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('page_id', pageId);
      
      const pageConvIds = (pageConvs || []).map(c => c.id);
      if (pageConvIds.length > 0) {
        query = query.in('conversation_id', pageConvIds);
      } else {
        // No conversations for this page, return empty
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, limit, offset, has_more: false },
        });
      }
    }

    // Sorting
    const ascending = sortOrder === 'asc';
    if (sortBy === 'composite_score') {
      query = query.order('composite_score', { ascending, nullsFirst: false });
    } else if (sortBy === 'max_confidence') {
      query = query.order('max_confidence', { ascending, nullsFirst: false });
    } else if (sortBy === 'recency_score') {
      query = query.order('recency_score', { ascending, nullsFirst: false });
    } else if (sortBy === 'last_contact_attempt_at') {
      query = query.order('last_contact_attempt_at', { ascending, nullsFirst: false });
    } else if (sortBy === 'sender_name') {
      query = query.order('sender_name', { ascending });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: recommendations, error: queryError, count } = await query;

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    // Fetch page information for each conversation
    const conversationIds = (recommendations || []).map(r => r.conversation_id);
    
    const { data: conversations } = await supabase
      .from('messenger_conversations')
      .select('id, page_id')
      .in('id', conversationIds);

    // Fetch page details
    const pageIds = [...new Set((conversations || []).map(c => c.page_id))];
    const { data: pages } = await supabase
      .from('facebook_pages')
      .select('facebook_page_id, name, profile_picture')
      .in('facebook_page_id', pageIds);

    // Create lookup maps
    const conversationToPage = new Map(
      (conversations || []).map(c => [c.id, c.page_id])
    );
    const pageDetails = new Map(
      (pages || []).map(p => [p.facebook_page_id, p])
    );

    // Format response
    const formatted = (recommendations || []).map((rec) => {
      const pageId = conversationToPage.get(rec.conversation_id);
      const page = pageId ? pageDetails.get(pageId) : null;
      
      return {
        id: rec.id,
        conversation_id: rec.conversation_id,
        sender_id: rec.sender_id,
        sender_name: rec.sender_name || 'Unknown',
        page_name: page?.name || 'Unknown Page',
        page_id: pageId || null,
        page_profile_picture: page?.profile_picture || null,
        timezone: rec.timezone,
        timezone_confidence: rec.timezone_confidence,
        timezone_source: rec.timezone_source,
        recommended_windows: rec.recommended_windows,
        max_confidence: Math.round(rec.max_confidence * 100) / 100,
        recency_score: Math.round(rec.recency_score * 100) / 100,
        priority_score: Math.round(rec.priority_score * 100) / 100,
        composite_score: Math.round(rec.composite_score * 100) / 100,
        last_positive_signal_at: rec.last_positive_signal_at,
        last_contact_attempt_at: rec.last_contact_attempt_at,
        total_attempts: rec.total_attempts,
        total_successes: rec.total_successes,
        overall_response_rate: Math.round(rec.overall_response_rate * 100),
        is_active: rec.is_active,
        cooldown_until: rec.cooldown_until,
        notes: rec.notes,
        last_computed_at: rec.last_computed_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: formatted,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

