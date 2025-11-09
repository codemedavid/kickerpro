import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { batchScoreLeads } from '@/lib/ai/lead-scorer';
import { ScoringConfig, DEFAULT_SCORING_CONFIG, QUALITY_TAGS } from '@/lib/config/lead-scoring-config';

/**
 * Score lead quality using AI analysis
 * POST /api/ai/score-leads
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationIds, pageId, autoTag = true, autoCreateOpportunities = false, scoringConfig } = body;

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: 'conversationIds array is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user's scoring configuration
    let config: ScoringConfig = DEFAULT_SCORING_CONFIG;
    if (scoringConfig) {
      config = { ...DEFAULT_SCORING_CONFIG, ...scoringConfig };
    } else {
      const { data: settings } = await supabase
        .from('lead_scoring_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settings) {
        config = {
          priceShopperThreshold: settings.price_shopper_threshold,
          priceShopperMessageLimit: settings.price_shopper_message_limit,
          minEngagementForWarm: settings.min_engagement_warm,
          minEngagementForHot: settings.min_engagement_hot,
          strictPriceShopperMode: settings.strict_mode
        };
      }
    }

    // Get page info
    const { data: page } = await supabase
      .from('facebook_pages')
      .select('facebook_page_id, access_token')
      .eq('user_id', userId)
      .or(`id.eq.${pageId},facebook_page_id.eq.${pageId}`)
      .single();

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Get conversations
    const { data: conversations } = await supabase
      .from('messenger_conversations')
      .select('id, sender_id, sender_name, page_id')
      .in('id', conversationIds)
      .eq('page_id', page.facebook_page_id);

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ error: 'No conversations found' }, { status: 404 });
    }

    console.log(`[Lead Scoring] Analyzing ${conversations.length} conversations`);

    // Fetch messages and prepare for scoring
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv) => {
        let messages: Array<{ from: string; message: string }> = [];

        try {
          const conversationUrl = `https://graph.facebook.com/v18.0/me/conversations?user_id=${conv.sender_id}&fields=messages.limit(10){from,message}&access_token=${page.access_token}`;
          const response = await fetch(conversationUrl);

          if (response.ok) {
            const data = await response.json();
            const conversation = data.data?.[0];
            
            if (conversation?.messages?.data) {
              messages = conversation.messages.data.reverse().map((msg: any) => ({
                from: msg.from?.id === conv.sender_id ? 'customer' : 'business',
                message: msg.message || ''
              }));
            }
          }
        } catch (fetchError) {
          console.warn(`[Lead Scoring] Could not fetch messages for ${conv.id}`);
        }

        // Fallback if no messages
        if (messages.length === 0) {
          messages = [
            { from: 'customer', message: 'Initial contact' },
            { from: 'business', message: 'Hello! How can I help you?' }
          ];
        }

        return {
          id: conv.id,
          name: conv.sender_name || 'Customer',
          messages
        };
      })
    );

    // Batch score all leads
    const scores = await batchScoreLeads(conversationsWithMessages, config);

    // Save to history
    const historyRecords = scores.map(score => ({
      conversation_id: score.conversationId,
      user_id: userId,
      score: score.score,
      quality: score.quality,
      has_budget: score.qualificationData.hasBudget,
      has_authority: score.qualificationData.hasAuthority,
      has_need: score.qualificationData.hasNeed,
      has_timeline: score.qualificationData.hasTimeline,
      engagement_level: score.qualificationData.engagementLevel,
      signals: score.signals,
      reasoning: score.reasoning,
      recommended_action: score.recommendedAction
    }));

    await supabase.from('lead_scores_history').insert(historyRecords);

    // Auto-tag if enabled
    if (autoTag) {
      await autoTagConversations(supabase, userId, scores, config);
    }

    // Auto-create opportunities if enabled
    let opportunitiesCreated = 0;
    if (autoCreateOpportunities) {
      try {
        const autoCreateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/auto-create-opportunities`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': `fb-auth-user=${userId}`
          },
          body: JSON.stringify({
            conversationIds: scores.map(s => s.conversationId),
            pageId
          })
        });

        if (autoCreateResponse.ok) {
          const autoCreateData = await autoCreateResponse.json();
          opportunitiesCreated = autoCreateData.created || 0;
          console.log(`[Lead Scoring] Auto-created ${opportunitiesCreated} opportunities`);
        }
      } catch (error) {
        console.warn('[Lead Scoring] Auto-create opportunities failed:', error);
      }
    }

    return NextResponse.json({
      success: true,
      scored: scores.length,
      opportunitiesCreated,
      scores: scores.map(s => ({
        conversationId: s.conversationId,
        contactName: s.contactName,
        score: s.score,
        quality: s.quality,
        signals: s.signals,
        reasoning: s.reasoning,
        recommendedAction: s.recommendedAction,
        qualificationData: s.qualificationData
      }))
    });

  } catch (error) {
    console.error('[Lead Scoring] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to score leads' },
      { status: 500 }
    );
  }
}

/**
 * Auto-tag conversations based on scoring results
 */
async function autoTagConversations(
  supabase: any,
  userId: string,
  scores: any[],
  config: ScoringConfig
) {
  // Get or create quality tags
  const { data: existingTags } = await supabase
    .from('tags')
    .select('id, name')
    .eq('created_by', userId)
    .in('name', QUALITY_TAGS.map(t => t.name));

  const tagMap = new Map(existingTags?.map((t: any) => [t.name, t.id]) || []);

  // Create missing tags
  for (const tag of QUALITY_TAGS) {
    if (!tagMap.has(tag.name)) {
      const { data: newTag } = await supabase
        .from('tags')
        .insert({ name: tag.name, color: tag.color, created_by: userId })
        .select()
        .single();

      if (newTag) {
        tagMap.set(tag.name, newTag.id);
      }
    }
  }

  // Apply tags based on scores
  for (const score of scores) {
    const qualityTagName = QUALITY_TAGS.find(t => t.quality === score.quality)?.name;
    const qualityTagId = qualityTagName ? tagMap.get(qualityTagName) : null;

    // Check if it's a price shopper
    const isPriceShopper = score.score < config.priceShopperThreshold && 
      score.signals.some((s: string) => s.includes('💰') || s.toLowerCase().includes('price'));

    const tagsToApply = [];
    if (qualityTagId) tagsToApply.push(qualityTagId);
    if (isPriceShopper) {
      const priceShopperTagId = tagMap.get('💰 Price Shopper');
      if (priceShopperTagId) tagsToApply.push(priceShopperTagId);
    }

    // Remove old quality tags first
    await supabase
      .from('conversation_tags')
      .delete()
      .eq('conversation_id', score.conversationId)
      .in('tag_id', Array.from(tagMap.values()));

    // Apply new tags
    if (tagsToApply.length > 0) {
      await supabase
        .from('conversation_tags')
        .insert(
          tagsToApply.map(tagId => ({
            conversation_id: score.conversationId,
            tag_id: tagId
          }))
        );
    }
  }
}

