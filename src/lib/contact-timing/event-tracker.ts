/**
 * Contact Timing Event Tracker
 * 
 * Tracks interaction events for the best-time-to-contact algorithm
 */

import { createClient } from '@/lib/supabase/server';

export interface EventTrackingData {
  user_id: string;
  conversation_id: string;
  sender_id: string;
  event_type:
    | 'message_sent'
    | 'message_delivered'
    | 'message_opened'
    | 'message_clicked'
    | 'message_replied'
    | 'call_initiated'
    | 'call_completed'
    | 'meeting_scheduled'
    | 'meeting_attended';
  event_timestamp: Date;
  response_timestamp?: Date;
  message_id?: string;
  channel?: 'messenger' | 'email' | 'call' | 'sms' | 'meeting';
  is_outbound: boolean;
  is_success?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Track a contact interaction event
 */
export async function trackContactEvent(data: EventTrackingData): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Determine success weight based on event type
    let successWeight = 0;
    let isSuccess = data.is_success ?? false;

    if (data.event_type === 'message_replied') {
      successWeight = 1.0; // Full success
      isSuccess = true;
    } else if (data.event_type === 'message_clicked') {
      successWeight = 0.5; // Medium success
      isSuccess = true;
    } else if (data.event_type === 'message_opened') {
      successWeight = 0.25; // Low success
      isSuccess = true;
    } else if (data.event_type === 'call_completed' || data.event_type === 'meeting_attended') {
      successWeight = 1.0; // Full success
      isSuccess = true;
    }

    // Calculate response latency if applicable
    let responseLatencyHours: number | null = null;
    if (data.response_timestamp && data.event_timestamp) {
      responseLatencyHours =
        (data.response_timestamp.getTime() - data.event_timestamp.getTime()) / (1000 * 60 * 60);
    }

    // Insert event
    const { error } = await supabase.from('contact_interaction_events').insert({
      user_id: data.user_id,
      conversation_id: data.conversation_id,
      sender_id: data.sender_id,
      event_type: data.event_type,
      event_timestamp: data.event_timestamp.toISOString(),
      response_timestamp: data.response_timestamp?.toISOString() || null,
      response_latency_hours: responseLatencyHours,
      message_id: data.message_id || null,
      channel: data.channel || 'messenger',
      is_outbound: data.is_outbound,
      is_success: isSuccess,
      success_weight: successWeight,
      metadata: data.metadata || null,
    });

    if (error) {
      console.error('Error tracking contact event:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in trackContactEvent:', error);
    return false;
  }
}

/**
 * Track message sent event (called when a message is sent via bulk or individual send)
 */
export async function trackMessageSent(
  userId: string,
  conversationId: string,
  senderId: string,
  messageId: string,
  timestamp: Date = new Date()
): Promise<void> {
  await trackContactEvent({
    user_id: userId,
    conversation_id: conversationId,
    sender_id: senderId,
    event_type: 'message_sent',
    event_timestamp: timestamp,
    message_id: messageId,
    channel: 'messenger',
    is_outbound: true,
  });
}

/**
 * Track message reply event (called when a user replies)
 */
export async function trackMessageReply(
  userId: string,
  conversationId: string,
  senderId: string,
  originalMessageTimestamp: Date,
  replyTimestamp: Date = new Date()
): Promise<void> {
  await trackContactEvent({
    user_id: userId,
    conversation_id: conversationId,
    sender_id: senderId,
    event_type: 'message_replied',
    event_timestamp: originalMessageTimestamp,
    response_timestamp: replyTimestamp,
    channel: 'messenger',
    is_outbound: false,
    is_success: true,
  });
}

/**
 * Batch track message sends (for bulk sends)
 */
export async function trackBulkMessageSends(
  userId: string,
  messageId: string,
  recipients: Array<{ conversation_id: string; sender_id: string }>,
  timestamp: Date = new Date()
): Promise<void> {
  const supabase = await createClient();

  const events = recipients.map((recipient) => ({
    user_id: userId,
    conversation_id: recipient.conversation_id,
    sender_id: recipient.sender_id,
    event_type: 'message_sent' as const,
    event_timestamp: timestamp.toISOString(),
    message_id: messageId,
    channel: 'messenger' as const,
    is_outbound: true,
    is_success: false,
    success_weight: 0,
  }));

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const { error } = await supabase.from('contact_interaction_events').insert(batch);
    
    if (error) {
      console.error('Error tracking bulk message sends:', error);
    }
  }
}

/**
 * Auto-trigger computation after significant event batch
 * (e.g., after syncing conversations or sending bulk messages)
 */
export async function triggerComputationIfNeeded(
  userId: string,
  conversationIds?: string[]
): Promise<void> {
  try {
    // Trigger computation in the background (non-blocking)
    const computeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/contact-timing/compute`;
    
    fetch(computeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_ids: conversationIds,
        recompute_all: !conversationIds,
      }),
    }).catch((error) => {
      console.error('Error triggering computation:', error);
    });
  } catch (error) {
    console.error('Error in triggerComputationIfNeeded:', error);
  }
}

/**
 * Get conversation ID from sender_id and page_id
 */
export async function getConversationId(
  userId: string,
  senderId: string,
  pageId: string
): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('messenger_conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('sender_id', senderId)
      .eq('page_id', pageId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error getting conversation ID:', error);
    return null;
  }
}

