/**
 * API Route: Seed Contact Interaction Events
 * POST /api/contact-timing/seed-events
 * 
 * Generates interaction events from existing conversation data
 * to bootstrap the best time to contact algorithm with historical patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';

interface EventPattern {
  preferredHours: number[];
  preferredDays: number[];
  eventCount: number;
  successRate: number;
  activityLevel: 'high' | 'medium' | 'low';
}

/**
 * Generate a consistent but unique pattern for each contact
 * based on their sender_id, ensuring repeatability
 */
function generateContactPattern(senderId: string, messageCount: number): EventPattern {
  // Use sender_id as seed for consistent randomization
  const hash = Array.from(senderId).reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  // Generate pseudo-random but consistent values
  const seed1 = (hash * 9301 + 49297) % 233280;
  const seed2 = (hash * 7919 + 31397) % 233280;
  const seed3 = (hash * 5107 + 17389) % 233280;

  const random1 = seed1 / 233280;
  const random2 = seed2 / 233280;
  const random3 = seed3 / 233280;

  // Determine activity level based on message count and randomness
  let activityLevel: 'high' | 'medium' | 'low';
  let baseEventCount: number;
  
  if (messageCount > 10 || random1 > 0.7) {
    activityLevel = 'high';
    baseEventCount = 20 + Math.floor(random1 * 15);
  } else if (messageCount > 5 || random1 > 0.4) {
    activityLevel = 'medium';
    baseEventCount = 10 + Math.floor(random1 * 10);
  } else {
    activityLevel = 'low';
    baseEventCount = 3 + Math.floor(random1 * 7);
  }

  // Generate 1-3 preferred hours (creates distinct patterns)
  const hourCount = 1 + Math.floor(random2 * 3);
  const preferredHours: number[] = [];
  
  // Choose time of day preference
  const timePreference = random2;
  if (timePreference < 0.33) {
    // Morning person (7am-11am)
    for (let i = 0; i < hourCount; i++) {
      preferredHours.push(7 + Math.floor((hash * (i + 1)) % 5));
    }
  } else if (timePreference < 0.66) {
    // Afternoon person (1pm-5pm)
    for (let i = 0; i < hourCount; i++) {
      preferredHours.push(13 + Math.floor((hash * (i + 1)) % 5));
    }
  } else {
    // Evening person (6pm-10pm)
    for (let i = 0; i < hourCount; i++) {
      preferredHours.push(18 + Math.floor((hash * (i + 1)) % 5));
    }
  }

  // Generate preferred days (1-5 days)
  const dayCount = 2 + Math.floor(random3 * 4);
  const preferredDays: number[] = [];
  const startDay = Math.floor(random3 * 7);
  
  for (let i = 0; i < dayCount; i++) {
    preferredDays.push((startDay + i) % 7);
  }

  // Success rate varies by contact
  const successRate = 0.3 + random1 * 0.6; // 30-90%

  return {
    preferredHours: [...new Set(preferredHours)], // Remove duplicates
    preferredDays: [...new Set(preferredDays)].sort(),
    eventCount: baseEventCount,
    successRate,
    activityLevel,
  };
}

/**
 * Generate events for a conversation based on its unique pattern
 */
function generateEventsForConversation(
  userId: string,
  conversationId: string,
  senderId: string,
  pattern: EventPattern,
  lastMessageTime: Date
) {
  const events = [];
  const now = new Date();
  const daysBack = 90; // Generate events over past 90 days
  
  // Don't go back further than the last message time
  const earliestDate = new Date(Math.max(
    now.getTime() - daysBack * 24 * 60 * 60 * 1000,
    lastMessageTime.getTime() - 30 * 24 * 60 * 60 * 1000
  ));

  for (let i = 0; i < pattern.eventCount; i++) {
    // Generate date within the valid range
    const dayRange = (now.getTime() - earliestDate.getTime()) / (24 * 60 * 60 * 1000);
    const daysAgo = Math.random() * dayRange;
    const eventDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Set day of week (prefer the contact's preferred days 70% of the time)
    const usePreferredDay = Math.random() < 0.7;
    if (usePreferredDay && pattern.preferredDays.length > 0) {
      const targetDay = pattern.preferredDays[Math.floor(Math.random() * pattern.preferredDays.length)];
      const currentDay = eventDate.getDay();
      const dayDiff = targetDay - currentDay;
      eventDate.setDate(eventDate.getDate() + dayDiff);
    }

    // Set hour (prefer the contact's preferred hours 80% of the time)
    const usePreferredHour = Math.random() < 0.8;
    let hour: number;
    
    if (usePreferredHour && pattern.preferredHours.length > 0) {
      hour = pattern.preferredHours[Math.floor(Math.random() * pattern.preferredHours.length)];
      // Add some variance (±1 hour)
      hour = Math.max(0, Math.min(23, hour + Math.floor(Math.random() * 3) - 1));
    } else {
      // Random hour during waking hours (6am-11pm)
      hour = 6 + Math.floor(Math.random() * 17);
    }

    eventDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

    // Alternate between outbound and inbound events
    const isOutbound = i % 2 === 0;
    const isSuccess = Math.random() < pattern.successRate;

    // Event type based on success
    let eventType: string;
    let successWeight = 0;

    if (isOutbound) {
      eventType = 'message_sent';
    } else if (isSuccess) {
      // Vary the success types
      const successRoll = Math.random();
      if (successRoll < 0.7) {
        eventType = 'message_replied';
        successWeight = 1.0;
      } else if (successRoll < 0.9) {
        eventType = 'message_clicked';
        successWeight = 0.5;
      } else {
        eventType = 'message_opened';
        successWeight = 0.25;
      }
    } else {
      eventType = 'message_sent';
    }

    // Response timestamp for successful events
    const responseTimestamp = isSuccess && isOutbound
      ? new Date(eventDate.getTime() + (0.5 + Math.random() * 6) * 60 * 60 * 1000) // 0.5-6.5h later
      : null;

    const responseLatencyHours = responseTimestamp
      ? (responseTimestamp.getTime() - eventDate.getTime()) / (1000 * 60 * 60)
      : null;

    events.push({
      user_id: userId,
      conversation_id: conversationId,
      sender_id: senderId,
      event_type: eventType,
      event_timestamp: eventDate.toISOString(),
      response_timestamp: responseTimestamp?.toISOString() || null,
      response_latency_hours: responseLatencyHours,
      channel: 'messenger' as const,
      is_outbound: isOutbound,
      is_success: isSuccess,
      success_weight: successWeight,
      metadata: {
        seeded: true,
        pattern: pattern.activityLevel,
        generated_at: new Date().toISOString(),
      },
    });
  }

  return events;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from cookie
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const startTime = Date.now();

    const body = await request.json();
    const { force = false } = body;

    console.log('[Seed Events] Starting event generation...');

    // Get all conversations for this user
    const { data: conversations, error: convError } = await supabase
      .from('messenger_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_time', { ascending: false });

    if (convError) {
      return NextResponse.json({ error: convError.message }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No conversations found. Please sync conversations first.',
        processed: 0,
      });
    }

    console.log(`[Seed Events] Found ${conversations.length} conversations`);

    // Get existing event counts per conversation
    const { data: existingEvents } = await supabase
      .from('contact_interaction_events')
      .select('conversation_id, id')
      .eq('user_id', userId);

    const eventCounts = new Map<string, number>();
    if (existingEvents) {
      for (const event of existingEvents) {
        eventCounts.set(
          event.conversation_id,
          (eventCounts.get(event.conversation_id) || 0) + 1
        );
      }
    }

    let processed = 0;
    let skipped = 0;
    let totalEventsGenerated = 0;

    for (const conversation of conversations) {
      try {
        // Skip if already has events (unless force flag is set)
        const existingCount = eventCounts.get(conversation.id) || 0;
        if (existingCount > 0 && !force) {
          skipped++;
          continue;
        }

        // Generate unique pattern for this contact
        const pattern = generateContactPattern(
          conversation.sender_id,
          conversation.message_count || 1
        );

        console.log(
          `[Seed Events] ${conversation.sender_name}: ${pattern.activityLevel} activity, ` +
          `${pattern.eventCount} events, preferred hours: ${pattern.preferredHours.join(',')}`
        );

        // Generate events
        const events = generateEventsForConversation(
          userId,
          conversation.id,
          conversation.sender_id,
          pattern,
          new Date(conversation.last_message_time)
        );

        // Insert events in batches of 100
        for (let i = 0; i < events.length; i += 100) {
          const batch = events.slice(i, i + 100);
          const { error: insertError } = await supabase
            .from('contact_interaction_events')
            .insert(batch);

          if (insertError) {
            console.error(`[Seed Events] Error inserting events:`, insertError);
          } else {
            totalEventsGenerated += batch.length;
          }
        }

        processed++;
      } catch (error) {
        console.error(`[Seed Events] Error processing ${conversation.sender_name}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[Seed Events] Complete! Processed ${processed}, skipped ${skipped}, generated ${totalEventsGenerated} events`);

    return NextResponse.json({
      success: true,
      processed,
      skipped,
      totalConversations: conversations.length,
      totalEventsGenerated,
      duration_ms: duration,
      message: `Generated ${totalEventsGenerated} events for ${processed} contacts. Recompute recommended times to see results.`,
    });
  } catch (error) {
    console.error('[Seed Events] Error:', error);
    return NextResponse.json(
      { error: 'Failed to seed events' },
      { status: 500 }
    );
  }
}

