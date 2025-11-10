/**
 * Test Data Generator for Best Time to Contact
 * 
 * Generates 50+ synthetic contacts with varied interaction patterns
 * Covers: clear patterns, sparse data, different timezones, edge cases
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

interface TestContactScenario {
  name: string;
  pattern: 'morning' | 'evening' | 'afternoon' | 'random' | 'sparse' | 'irregular';
  timezone: string;
  eventCount: number;
  successRate: number;
  quietHours?: { start: string; end: string };
  preferredDays?: number[];
}

const TEST_SCENARIOS: TestContactScenario[] = [
  // Clear patterns - High confidence expected (10 contacts)
  { name: 'Alice Morning', pattern: 'morning', timezone: 'America/New_York', eventCount: 20, successRate: 0.8 },
  { name: 'Bob Evening', pattern: 'evening', timezone: 'America/Los_Angeles', eventCount: 25, successRate: 0.75 },
  { name: 'Charlie Afternoon', pattern: 'afternoon', timezone: 'Europe/London', eventCount: 18, successRate: 0.85 },
  { name: 'Diana Consistent', pattern: 'morning', timezone: 'America/Chicago', eventCount: 30, successRate: 0.9 },
  { name: 'Eve Predictable', pattern: 'afternoon', timezone: 'Europe/Paris', eventCount: 22, successRate: 0.82 },
  { name: 'Frank Regular', pattern: 'morning', timezone: 'Asia/Tokyo', eventCount: 28, successRate: 0.78 },
  { name: 'Grace Stable', pattern: 'evening', timezone: 'America/Denver', eventCount: 24, successRate: 0.88 },
  { name: 'Henry Reliable', pattern: 'afternoon', timezone: 'Europe/Berlin', eventCount: 26, successRate: 0.84 },
  { name: 'Iris Steady', pattern: 'morning', timezone: 'Australia/Sydney', eventCount: 21, successRate: 0.86 },
  { name: 'Jack Pattern', pattern: 'evening', timezone: 'Asia/Singapore', eventCount: 23, successRate: 0.79 },

  // Sparse data - Low confidence, cold start (10 contacts)
  { name: 'Kate Sparse', pattern: 'random', timezone: 'America/New_York', eventCount: 2, successRate: 0.5 },
  { name: 'Leo Minimal', pattern: 'sparse', timezone: 'Europe/London', eventCount: 3, successRate: 0.33 },
  { name: 'Maya New', pattern: 'morning', timezone: 'Asia/Kolkata', eventCount: 1, successRate: 1.0 },
  { name: 'Noah Cold', pattern: 'random', timezone: 'America/Chicago', eventCount: 4, successRate: 0.25 },
  { name: 'Olivia Limited', pattern: 'afternoon', timezone: 'Europe/Paris', eventCount: 2, successRate: 0.5 },
  { name: 'Paul Scarce', pattern: 'evening', timezone: 'Australia/Melbourne', eventCount: 3, successRate: 0.67 },
  { name: 'Quinn Few', pattern: 'random', timezone: 'America/Phoenix', eventCount: 2, successRate: 0 },
  { name: 'Rachel Start', pattern: 'morning', timezone: 'Asia/Shanghai', eventCount: 1, successRate: 0 },
  { name: 'Sam Beginner', pattern: 'sparse', timezone: 'Europe/Madrid', eventCount: 3, successRate: 0.33 },
  { name: 'Tina Nascent', pattern: 'random', timezone: 'America/Toronto', eventCount: 2, successRate: 1.0 },

  // Different timezones (10 contacts)
  { name: 'Uma Mumbai', pattern: 'morning', timezone: 'Asia/Kolkata', eventCount: 15, successRate: 0.8 },
  { name: 'Victor Tokyo', pattern: 'afternoon', timezone: 'Asia/Tokyo', eventCount: 18, successRate: 0.75 },
  { name: 'Wendy Sydney', pattern: 'evening', timezone: 'Australia/Sydney', eventCount: 16, successRate: 0.82 },
  { name: 'Xavier London', pattern: 'morning', timezone: 'Europe/London', eventCount: 20, successRate: 0.85 },
  { name: 'Yara Paris', pattern: 'afternoon', timezone: 'Europe/Paris', eventCount: 17, successRate: 0.78 },
  { name: 'Zack Berlin', pattern: 'evening', timezone: 'Europe/Berlin', eventCount: 19, successRate: 0.81 },
  { name: 'Amy Pacific', pattern: 'morning', timezone: 'America/Los_Angeles', eventCount: 21, successRate: 0.83 },
  { name: 'Ben Mountain', pattern: 'afternoon', timezone: 'America/Denver', eventCount: 16, successRate: 0.76 },
  { name: 'Cara Central', pattern: 'evening', timezone: 'America/Chicago', eventCount: 18, successRate: 0.79 },
  { name: 'Dan Singapore', pattern: 'morning', timezone: 'Asia/Singapore', eventCount: 22, successRate: 0.87 },

  // Irregular patterns (10 contacts)
  { name: 'Emma Chaotic', pattern: 'irregular', timezone: 'America/New_York', eventCount: 15, successRate: 0.4 },
  { name: 'Fred Random', pattern: 'irregular', timezone: 'Europe/London', eventCount: 18, successRate: 0.35 },
  { name: 'Gina Erratic', pattern: 'irregular', timezone: 'Asia/Tokyo', eventCount: 16, successRate: 0.38 },
  { name: 'Hugo Unpredictable', pattern: 'irregular', timezone: 'America/Los_Angeles', eventCount: 20, successRate: 0.42 },
  { name: 'Iris Scattered', pattern: 'irregular', timezone: 'Europe/Paris', eventCount: 17, successRate: 0.36 },
  { name: 'Jake Inconsistent', pattern: 'irregular', timezone: 'Australia/Sydney', eventCount: 19, successRate: 0.39 },
  { name: 'Kim Variable', pattern: 'irregular', timezone: 'Asia/Singapore', eventCount: 14, successRate: 0.41 },
  { name: 'Luke Mixed', pattern: 'irregular', timezone: 'America/Chicago', eventCount: 21, successRate: 0.37 },
  { name: 'Mia Volatile', pattern: 'irregular', timezone: 'Europe/Berlin', eventCount: 16, successRate: 0.43 },
  { name: 'Nick Sporadic', pattern: 'irregular', timezone: 'Asia/Kolkata', eventCount: 15, successRate: 0.34 },

  // Edge cases with constraints (10 contacts)
  { name: 'Oscar QuietHours', pattern: 'morning', timezone: 'America/New_York', eventCount: 20, successRate: 0.8, quietHours: { start: '21:00', end: '07:00' } },
  { name: 'Penny WeekdaysOnly', pattern: 'afternoon', timezone: 'Europe/London', eventCount: 18, successRate: 0.75, preferredDays: [1,2,3,4,5] },
  { name: 'Quinn NoWeekends', pattern: 'morning', timezone: 'Asia/Tokyo', eventCount: 22, successRate: 0.83, preferredDays: [1,2,3,4,5] },
  { name: 'Rose LateNight', pattern: 'evening', timezone: 'America/Los_Angeles', eventCount: 16, successRate: 0.72, quietHours: { start: '23:00', end: '09:00' } },
  { name: 'Steve Weekends', pattern: 'afternoon', timezone: 'Europe/Paris', eventCount: 14, successRate: 0.68, preferredDays: [0,6] },
  { name: 'Tara BusinessHours', pattern: 'morning', timezone: 'America/Chicago', eventCount: 19, successRate: 0.81, quietHours: { start: '18:00', end: '08:00' } },
  { name: 'Uma Restricted', pattern: 'afternoon', timezone: 'Asia/Singapore', eventCount: 17, successRate: 0.74, quietHours: { start: '20:00', end: '06:00' } },
  { name: 'Victor NoMondays', pattern: 'morning', timezone: 'Australia/Sydney', eventCount: 15, successRate: 0.76, preferredDays: [2,3,4,5,6] },
  { name: 'Wanda MidWeek', pattern: 'afternoon', timezone: 'Europe/Berlin', eventCount: 20, successRate: 0.82, preferredDays: [2,3,4] },
  { name: 'Xavier Custom', pattern: 'evening', timezone: 'America/Denver', eventCount: 18, successRate: 0.79, quietHours: { start: '22:00', end: '08:00' } },

  // Various event types (10 contacts)
  { name: 'Yvonne Messenger', pattern: 'morning', timezone: 'America/New_York', eventCount: 20, successRate: 0.8 },
  { name: 'Zane MultiChannel', pattern: 'afternoon', timezone: 'Europe/London', eventCount: 25, successRate: 0.75 },
  { name: 'Amy CallMostly', pattern: 'morning', timezone: 'Asia/Tokyo', eventCount: 18, successRate: 0.82 },
  { name: 'Ben Meetings', pattern: 'afternoon', timezone: 'America/Los_Angeles', eventCount: 16, successRate: 0.78 },
  { name: 'Clara Emails', pattern: 'morning', timezone: 'Europe/Paris', eventCount: 22, successRate: 0.84 },
  { name: 'Dave SMS', pattern: 'evening', timezone: 'America/Chicago', eventCount: 14, successRate: 0.71 },
  { name: 'Eva Mixed', pattern: 'afternoon', timezone: 'Asia/Singapore', eventCount: 24, successRate: 0.8 },
  { name: 'Fred AllChannels', pattern: 'morning', timezone: 'Australia/Sydney', eventCount: 28, successRate: 0.86 },
  { name: 'Grace Diverse', pattern: 'evening', timezone: 'Europe/Berlin', eventCount: 19, successRate: 0.77 },
  { name: 'Hank Varied', pattern: 'afternoon', timezone: 'America/Denver', eventCount: 21, successRate: 0.83 },
];

export async function generateTestData(userId: string, testPageId: string) {
  console.log('🧪 Generating test data for Best Time to Contact...\n');
  
  const generatedContacts: string[] = [];
  const generatedEvents: number[] = [];
  
  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    const scenario = TEST_SCENARIOS[i];
    console.log(`\n[${i + 1}/${TEST_SCENARIOS.length}] Creating: ${scenario.name}`);
    
    try {
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('messenger_conversations')
        .insert({
          user_id: userId,
          page_id: testPageId,
          sender_id: `TEST_${Date.now()}_${i}`,
          sender_name: scenario.name,
          last_message: `Test message from ${scenario.name}`,
          last_message_time: new Date().toISOString(),
          conversation_status: 'active',
        })
        .select()
        .single();

      if (convError || !conversation) {
        console.error(`  ❌ Failed to create conversation: ${convError?.message}`);
        continue;
      }

      console.log(`  ✓ Created conversation ID: ${conversation.id}`);
      generatedContacts.push(conversation.id);

      // Generate events based on pattern
      const events = generateEventsForPattern(
        userId,
        conversation.id,
        conversation.sender_id,
        scenario
      );

      console.log(`  ✓ Generated ${events.length} events`);

      // Insert events in batches of 50
      for (let j = 0; j < events.length; j += 50) {
        const batch = events.slice(j, j + 50);
        const { error: eventError } = await supabase
          .from('contact_interaction_events')
          .insert(batch);

        if (eventError) {
          console.error(`  ❌ Failed to insert events: ${eventError.message}`);
        } else {
          generatedEvents.push(batch.length);
        }
      }

      // Store preferences if any
      if (scenario.quietHours || scenario.preferredDays) {
        await supabase
          .from('contact_timing_recommendations')
          .insert({
            user_id: userId,
            conversation_id: conversation.id,
            sender_id: conversation.sender_id,
            sender_name: scenario.name,
            timezone: scenario.timezone,
            quiet_hours_start: scenario.quietHours?.start || null,
            quiet_hours_end: scenario.quietHours?.end || null,
            preferred_days: scenario.preferredDays || null,
            is_active: true,
            recommended_windows: [],
          });
      }

      console.log(`  ✓ Contact created successfully`);
    } catch (error) {
      console.error(`  ❌ Error creating ${scenario.name}:`, error);
    }
  }

  console.log(`\n\n✅ Test data generation complete!`);
  console.log(`📊 Summary:`);
  console.log(`  - Contacts created: ${generatedContacts.length}`);
  console.log(`  - Total events: ${generatedEvents.reduce((a, b) => a + b, 0)}`);
  console.log(`  - Average events per contact: ${(generatedEvents.reduce((a, b) => a + b, 0) / generatedContacts.length).toFixed(1)}`);

  return {
    contacts: generatedContacts,
    totalEvents: generatedEvents.reduce((a, b) => a + b, 0),
  };
}

function generateEventsForPattern(
  userId: string,
  conversationId: string,
  senderId: string,
  scenario: TestContactScenario
) {
  const events = [];
  const now = new Date();
  const daysBack = 60; // Generate events over past 60 days

  for (let i = 0; i < scenario.eventCount; i++) {
    // Random day in the past
    const daysAgo = Math.random() * daysBack;
    const eventDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Set hour based on pattern
    let hour: number;
    switch (scenario.pattern) {
      case 'morning':
        hour = 8 + Math.floor(Math.random() * 4); // 8am-11am
        break;
      case 'afternoon':
        hour = 13 + Math.floor(Math.random() * 4); // 1pm-4pm
        break;
      case 'evening':
        hour = 18 + Math.floor(Math.random() * 4); // 6pm-9pm
        break;
      case 'sparse':
      case 'irregular':
      case 'random':
      default:
        hour = Math.floor(Math.random() * 24); // Any time
        break;
    }

    eventDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

    // Determine if outbound or reply
    const isOutbound = Math.random() > 0.5;
    const isSuccess = Math.random() < scenario.successRate;

    // Event type based on success
    let eventType: string;
    let successWeight = 0;

    if (isOutbound) {
      eventType = 'message_sent';
    } else {
      if (isSuccess) {
        // Vary the success types
        const successRoll = Math.random();
        if (successRoll < 0.6) {
          eventType = 'message_replied';
          successWeight = 1.0;
        } else if (successRoll < 0.85) {
          eventType = 'message_clicked';
          successWeight = 0.5;
        } else {
          eventType = 'message_opened';
          successWeight = 0.25;
        }
      } else {
        eventType = 'message_sent';
      }
    }

    // Response timestamp for successful events
    const responseTimestamp = isSuccess && isOutbound
      ? new Date(eventDate.getTime() + (1 + Math.random() * 12) * 60 * 60 * 1000) // 1-12h later
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
      channel: 'messenger',
      is_outbound: isOutbound,
      is_success: isSuccess,
      success_weight: successWeight,
      metadata: {
        test: true,
        scenario: scenario.pattern,
        generated_at: new Date().toISOString(),
      },
    });
  }

  return events;
}

// CLI execution
if (require.main === module) {
  const userId = process.argv[2];
  const testPageId = process.argv[3];

  if (!userId || !testPageId) {
    console.error('Usage: ts-node scripts/generate-test-data.ts <user_id> <test_page_id>');
    process.exit(1);
  }

  generateTestData(userId, testPageId)
    .then((result) => {
      console.log('\n✅ Generation complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Generation failed:', error);
      process.exit(1);
    });
}

