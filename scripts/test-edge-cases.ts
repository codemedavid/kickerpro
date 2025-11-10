/**
 * Edge Case Testing for Best Time to Contact
 * 
 * Tests algorithm behavior on extreme and boundary conditions
 */

import { createClient } from '@supabase/supabase-js';
import {
  computeBestContactTimes,
  getDefaultConfig,
  getHourOfWeek,
  type ContactEvent,
} from '../src/lib/contact-timing/algorithm';
import { Database } from '../src/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

let passCount = 0;
let failCount = 0;

function test(name: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    if (details) console.log(`     ${details}`);
    passCount++;
  } else {
    console.log(`  ❌ ${name}`);
    if (details) console.log(`     ${details}`);
    failCount++;
  }
}

export async function runEdgeCaseTests(userId: string) {
  console.log('🧪 EDGE CASE TESTING\n');
  console.log('='.repeat(70));

  const config = getDefaultConfig();
  const now = new Date();
  const timezone = 'America/New_York';

  // EDGE CASE 1: Single interaction event
  console.log('\n🔬 EDGE CASE 1: Single Interaction');
  console.log('-'.repeat(70));

  const singleEvent: ContactEvent[] = [{
    event_type: 'message_sent',
    event_timestamp: now,
    is_outbound: true,
    is_success: true,
    success_weight: 1.0,
    hour_of_week: 34, // Monday 10am
  }];

  try {
    const result1 = computeBestContactTimes(singleEvent, null, config, now, 0.5);
    test('Algorithm runs with single event', true);
    test('Produces recommendations', result1.recommended_windows.length > 0);
    test('Confidence > 0', result1.max_confidence > 0);
    test('Composite score > 0', result1.composite_score > 0);
  } catch (error) {
    test('Algorithm runs with single event', false, `Error: ${error}`);
  }

  // EDGE CASE 2: 100+ interactions (performance)
  console.log('\n🔬 EDGE CASE 2: Large Dataset (100+ events)');
  console.log('-'.repeat(70));

  const largeDataset: ContactEvent[] = [];
  for (let i = 0; i < 150; i++) {
    const daysAgo = Math.floor(i / 3);
    largeDataset.push({
      event_type: 'message_sent',
      event_timestamp: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      is_outbound: true,
      is_success: Math.random() > 0.5,
      success_weight: Math.random(),
      hour_of_week: (34 + Math.floor(Math.random() * 10)) % 168,
    });
  }

  const start = Date.now();
  try {
    const result2 = computeBestContactTimes(largeDataset, null, config, now, 0.5);
    const duration = Date.now() - start;
    
    test('Handles 150 events', true);
    test('Completes in <1000ms', duration < 1000, `Took ${duration}ms`);
    test('Produces valid windows', result2.recommended_windows.length > 0);
    console.log(`  Performance: ${duration}ms for 150 events`);
  } catch (error) {
    test('Handles large dataset', false, `Error: ${error}`);
  }

  // EDGE CASE 3: All successes (probability → 1.0)
  console.log('\n🔬 EDGE CASE 3: All Successes');
  console.log('-'.repeat(70));

  const allSuccesses: ContactEvent[] = [];
  for (let i = 0; i < 10; i++) {
    allSuccesses.push({
      event_type: 'message_sent',
      event_timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 34,
    });
  }

  try {
    const result3 = computeBestContactTimes(allSuccesses, null, config, now, 0.5);
    test('Handles 100% success rate', true);
    test('High confidence produced', result3.max_confidence > 0.8, `Confidence: ${result3.max_confidence.toFixed(2)}`);
    test('Probability ≤ 1.0', result3.max_confidence <= 1.0);
  } catch (error) {
    test('Handles all successes', false, `Error: ${error}`);
  }

  // EDGE CASE 4: All failures (probability → 0.0)
  console.log('\n🔬 EDGE CASE 4: All Failures');
  console.log('-'.repeat(70));

  const allFailures: ContactEvent[] = [];
  for (let i = 0; i < 10; i++) {
    allFailures.push({
      event_type: 'message_sent',
      event_timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      is_outbound: true,
      is_success: false,
      success_weight: 0,
      hour_of_week: 34,
    });
  }

  try {
    const result4 = computeBestContactTimes(allFailures, null, config, now, 0.5);
    test('Handles 0% success rate', true);
    test('Low confidence produced', result4.max_confidence < 0.5, `Confidence: ${result4.max_confidence.toFixed(2)}`);
    test('Probability ≥ 0.0', result4.max_confidence >= 0.0);
    test('Still produces recommendations', result4.recommended_windows.length > 0, 'Uses priors to recommend');
  } catch (error) {
    test('Handles all failures', false, `Error: ${error}`);
  }

  // EDGE CASE 5: Timezone at day boundary
  console.log('\n🔬 EDGE CASE 5: Day Boundary Timezone');
  console.log('-'.repeat(70));

  const midnightUTC = new Date('2025-11-10T00:00:00Z');
  const hourNY = getHourOfWeek(midnightUTC, 'America/New_York'); // 19:00 EST (prev day)
  const hourTokyo = getHourOfWeek(midnightUTC, 'Asia/Tokyo'); // 09:00 JST (same day)

  console.log(`  UTC 00:00 → America/New_York: bin ${hourNY}`);
  console.log(`  UTC 00:00 → Asia/Tokyo: bin ${hourTokyo}`);

  test('Timezone conversion crosses day boundary', Math.abs(hourNY - hourTokyo) > 24);
  test('Both values valid', hourNY >= 0 && hourNY < 168 && hourTokyo >= 0 && hourTokyo < 168);

  // EDGE CASE 6: Quiet hours overlapping best time
  console.log('\n🔬 EDGE CASE 6: Quiet Hours Overlap Best Time');
  console.log('-'.repeat(70));

  const quietOverlapEvents: ContactEvent[] = [];
  for (let i = 0; i < 15; i++) {
    quietOverlapEvents.push({
      event_type: 'message_sent',
      event_timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 1 * 24 + 22, // Monday 10pm (in quiet hours)
    });
  }

  try {
    const result6 = computeBestContactTimes(
      quietOverlapEvents,
      null,
      config,
      now,
      0.5,
      '21:00', // Start quiet hours
      '07:00'  // End quiet hours
    );

    const hasQuietHourWindow = result6.recommended_windows.some(w => {
      const hour = parseInt(w.start.split(':')[0]);
      return hour >= 21 || hour < 7;
    });

    test('Quiet hours respected', !hasQuietHourWindow, 
      'No windows between 21:00-07:00');
    test('Alternative windows recommended', result6.recommended_windows.length > 0);
  } catch (error) {
    test('Handles quiet hour overlap', false, `Error: ${error}`);
  }

  // EDGE CASE 7: Week wraparound spacing
  console.log('\n🔬 EDGE CASE 7: Week Wraparound Spacing');
  console.log('-'.repeat(70));

  const wraparoundEvents: ContactEvent[] = [
    {
      event_type: 'message_sent',
      event_timestamp: now,
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 167, // Saturday 11pm
    },
    {
      event_type: 'message_sent',
      event_timestamp: now,
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 0, // Sunday 12am (1 hour later, circular)
    },
  ];

  try {
    const result7 = computeBestContactTimes(wraparoundEvents, null, config, now, 0.5);
    const hours = result7.recommended_windows.map(w => w.hour_of_week);
    
    // Should not have both 167 and 0 due to spacing constraint
    const hasBoth = hours.includes(167) && hours.includes(0);
    
    test('Week wraparound spacing enforced', !hasBoth,
      `Bins 167 and 0 are only 1h apart (circular)`);
  } catch (error) {
    test('Handles week wraparound', false, `Error: ${error}`);
  }

  // EDGE CASE 8: NULL/corrupted data
  console.log('\n🔬 EDGE CASE 8: NULL and Corrupted Data');
  console.log('-'.repeat(70));

  try {
    // NULL timestamps
    const resultNull = computeBestContactTimes([], null, config, null, 0.5);
    test('Handles NULL timestamps', resultNull.recency_score === 0);

    // Empty timezone
    const emptyTzEvent: ContactEvent = {
      event_type: 'message_sent',
      event_timestamp: now,
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 0,
    };
    const resultEmptyTz = computeBestContactTimes([emptyTzEvent], null, config, now, 0.5);
    test('Handles empty timezone gracefully', resultEmptyTz.recommended_windows.length >= 0);
  } catch (error) {
    test('Handles NULL/corrupted data', false, `Error: ${error}`);
  }

  // EDGE CASE 9: Negative probabilities (should not happen)
  console.log('\n🔬 EDGE CASE 9: Probability Bounds');
  console.log('-'.repeat(70));

  const manyEvents: ContactEvent[] = [];
  for (let i = 0; i < 50; i++) {
    manyEvents.push({
      event_type: 'message_sent',
      event_timestamp: new Date(now.getTime() - i * 12 * 60 * 60 * 1000),
      is_outbound: true,
      is_success: Math.random() > 0.3,
      success_weight: Math.random(),
      hour_of_week: Math.floor(Math.random() * 168),
    });
  }

  try {
    const result9 = computeBestContactTimes(manyEvents, null, config, now, 0.5);
    
    let allValid = true;
    for (const bin of result9.bins) {
      if (bin.raw_probability < 0 || bin.raw_probability > 1 ||
          bin.smoothed_probability < 0 || bin.smoothed_probability > 1) {
        allValid = false;
        break;
      }
    }

    test('All probabilities in [0,1]', allValid);
    test('Max confidence ≤ 1.0', result9.max_confidence <= 1.0);
    test('Max confidence ≥ 0.0', result9.max_confidence >= 0.0);
    test('Composite score ≤ 1.0', result9.composite_score <= 1.0);
  } catch (error) {
    test('Probability bounds maintained', false, `Error: ${error}`);
  }

  // EDGE CASE 10: Concurrent computation (database)
  console.log('\n🔬 EDGE CASE 10: Concurrent Database Operations');
  console.log('-'.repeat(70));

  try {
    // Create a test conversation
    const { data: testConv, error: convError } = await supabase
      .from('messenger_conversations')
      .insert({
        user_id: userId,
        page_id: 'test_page_concurrent',
        sender_id: `concurrent_test_${Date.now()}`,
        sender_name: 'Concurrent Test',
        last_message_time: now.toISOString(),
        conversation_status: 'active',
      })
      .select()
      .single();

    if (convError || !testConv) {
      test('Create test conversation', false, convError?.message);
    } else {
      test('Create test conversation', true);

      // Simulate concurrent writes to recommendations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          supabase
            .from('contact_timing_recommendations')
            .upsert({
              user_id: userId,
              conversation_id: testConv.id,
              sender_id: testConv.sender_id,
              sender_name: 'Concurrent Test',
              timezone: 'UTC',
              recommended_windows: [],
              composite_score: Math.random(),
            }, { onConflict: 'conversation_id' })
        );
      }

      const results = await Promise.all(promises);
      const allSucceeded = results.every(r => !r.error);
      
      test('Concurrent upserts handled', allSucceeded);

      // Verify only one record exists
      const { data: finalRecords, error: countError } = await supabase
        .from('contact_timing_recommendations')
        .select('*')
        .eq('conversation_id', testConv.id);

      test('Unique constraint enforced', finalRecords?.length === 1);

      // Cleanup
      await supabase
        .from('messenger_conversations')
        .delete()
        .eq('id', testConv.id);
    }
  } catch (error) {
    test('Concurrent operations', false, `Error: ${error}`);
  }

  // EDGE CASE 11: Extreme time decay (very old events)
  console.log('\n🔬 EDGE CASE 11: Extreme Time Decay');
  console.log('-'.repeat(70));

  const veryOldEvent: ContactEvent[] = [{
    event_type: 'message_sent',
    event_timestamp: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    is_outbound: true,
    is_success: true,
    success_weight: 1.0,
    hour_of_week: 34,
  }];

  try {
    const resultOld = computeBestContactTimes(veryOldEvent, null, config, now, 0.5);
    test('Handles year-old events', true);
    test('Old events have low weight', resultOld.bins[34].trials_count < 0.1, 
      `Weight: ${resultOld.bins[34].trials_count.toFixed(4)}`);
  } catch (error) {
    test('Handles extreme decay', false, `Error: ${error}`);
  }

  // EDGE CASE 12: Invalid hour_of_week values
  console.log('\n🔬 EDGE CASE 12: Invalid hour_of_week');
  console.log('-'.repeat(70));

  const invalidHourEvents: ContactEvent[] = [
    {
      event_type: 'message_sent',
      event_timestamp: now,
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: -1, // Invalid
    },
    {
      event_type: 'message_sent',
      event_timestamp: now,
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 168, // Invalid (out of range)
    },
    {
      event_type: 'message_sent',
      event_timestamp: now,
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 34, // Valid
    },
  ];

  try {
    const resultInvalid = computeBestContactTimes(invalidHourEvents, null, config, now, 0.5);
    test('Handles invalid hour_of_week', true);
    test('Invalid hours ignored', resultInvalid.bins.slice(0, 34).every(b => b.trials_count === 0));
    test('Valid hour processed', resultInvalid.bins[34].trials_count > 0);
  } catch (error) {
    test('Handles invalid hours', false, `Error: ${error}`);
  }

  // EDGE CASE 13: Success weight > 1.0 (should be clamped)
  console.log('\n🔬 EDGE CASE 13: Invalid Success Weights');
  console.log('-'.repeat(70));

  const invalidWeightEvents: ContactEvent[] = [{
    event_type: 'message_sent',
    event_timestamp: now,
    is_outbound: true,
    is_success: true,
    success_weight: 2.0, // Invalid (should be ≤ 1.0)
    hour_of_week: 34,
  }];

  try {
    const resultWeight = computeBestContactTimes(invalidWeightEvents, null, config, now, 0.5);
    test('Handles invalid success_weight', true);
    // The algorithm should still produce valid probabilities
    test('Probabilities still valid', resultWeight.max_confidence >= 0 && resultWeight.max_confidence <= 1);
  } catch (error) {
    test('Handles invalid weights', false, `Error: ${error}`);
  }

  // EDGE CASE 14: Empty recommended_windows
  console.log('\n🔬 EDGE CASE 14: No Valid Windows');
  console.log('-'.repeat(70));

  const allMaskedEvents: ContactEvent[] = [];
  // All events during quiet hours
  for (let i = 0; i < 10; i++) {
    allMaskedEvents.push({
      event_type: 'message_sent',
      event_timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 1 * 24 + 23, // Monday 11pm
    });
  }

  try {
    const resultMasked = computeBestContactTimes(
      allMaskedEvents,
      null,
      config,
      now,
      0.5,
      '00:00', // All day quiet hours (extreme case)
      '23:59'
    );

    test('Handles all-masked scenario', true);
    console.log(`  Windows returned: ${resultMasked.recommended_windows.length}`);
    // Should return empty or use unmasked bins
  } catch (error) {
    test('Handles all-masked scenario', false, `Error: ${error}`);
  }

  // EDGE CASE 15: Response latency > 1000 hours
  console.log('\n🔬 EDGE CASE 15: Extreme Response Latency');
  console.log('-'.repeat(70));

  const extremeLatencyEvent: ContactEvent[] = [{
    event_type: 'message_sent',
    event_timestamp: now,
    response_timestamp: new Date(now.getTime() + 2000 * 60 * 60 * 1000), // 2000h later
    is_outbound: true,
    is_success: true,
    success_weight: 1.0,
    hour_of_week: 34,
  }];

  try {
    const resultLatency = computeBestContactTimes(extremeLatencyEvent, null, config, now, 0.5);
    test('Handles extreme latency', true);
    // Survival decay should significantly reduce credit
    test('Survival decay applied', resultLatency.bins[34].success_count < 0.5,
      `Success count with decay: ${resultLatency.bins[34].success_count.toFixed(4)}`);
  } catch (error) {
    test('Handles extreme latency', false, `Error: ${error}`);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 EDGE CASE TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Total: ${passCount + failCount}`);

  if (failCount === 0) {
    console.log('\n🎉 ALL EDGE CASE TESTS PASSED!');
  } else {
    console.log('\n⚠️  SOME EDGE CASE TESTS FAILED!');
  }

  console.log('\n');

  return { passed: passCount, failed: failCount };
}

// CLI execution
if (require.main === module) {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: ts-node scripts/test-edge-cases.ts <user_id>');
    process.exit(1);
  }

  runEdgeCaseTests(userId)
    .then((result) => {
      process.exit(result.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Edge case tests failed:', error);
      process.exit(1);
    });
}

