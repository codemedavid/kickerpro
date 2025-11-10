/**
 * Backtesting Framework for Best Time to Contact
 * 
 * Train/test split, predict, and validate against actual outcomes
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

interface BacktestResult {
  contact_name: string;
  total_events: number;
  train_events: number;
  test_events: number;
  predicted_top_hour: number;
  actual_best_hour: number;
  hit_in_top_3: boolean;
  hit_in_top_5: boolean;
  precision_at_3: number;
  recall_at_3: number;
}

export async function runBacktest(userId: string) {
  console.log('🔬 BACKTESTING: Best Time to Contact Algorithm\n');
  console.log('='.repeat(70));

  // Fetch all test contacts with events
  const { data: events, error } = await supabase
    .from('contact_interaction_events')
    .select(`
      *,
      conversation:messenger_conversations(
        id,
        sender_name,
        page_id
      )
    `)
    .eq('user_id', userId)
    .eq('metadata->>test', 'true')
    .order('event_timestamp', { ascending: true });

  if (error || !events || events.length === 0) {
    console.error('❌ No test events found');
    return;
  }

  // Group events by conversation
  const eventsByConv = new Map<string, any[]>();
  for (const event of events) {
    const convId = event.conversation_id;
    if (!eventsByConv.has(convId)) {
      eventsByConv.set(convId, []);
    }
    eventsByConv.get(convId)!.push(event);
  }

  console.log(`\n📊 Dataset: ${eventsByConv.size} contacts, ${events.length} total events\n`);

  const results: BacktestResult[] = [];
  const config = getDefaultConfig();

  for (const [convId, convEvents] of eventsByConv.entries()) {
    if (convEvents.length < 10) {
      console.log(`⏭️  Skipping contact with <10 events`);
      continue; // Skip contacts with too few events
    }

    const conversation = Array.isArray(convEvents[0].conversation) 
      ? convEvents[0].conversation[0] 
      : convEvents[0].conversation;
    const contactName = conversation?.sender_name || 'Unknown';

    console.log(`\n📈 Contact: ${contactName} (${convEvents.length} events)`);

    // Split: 70% train, 30% test
    const splitIdx = Math.floor(convEvents.length * 0.7);
    const trainEvents = convEvents.slice(0, splitIdx);
    const testEvents = convEvents.slice(splitIdx);

    console.log(`  Train: ${trainEvents.length} events`);
    console.log(`  Test: ${testEvents.length} events`);

    // Transform to ContactEvent format with timezone
    const timezone = 'America/New_York'; // Use consistent timezone for backtesting
    const trainContactEvents: ContactEvent[] = trainEvents.map(e => ({
      event_type: e.event_type,
      event_timestamp: new Date(e.event_timestamp),
      response_timestamp: e.response_timestamp ? new Date(e.response_timestamp) : undefined,
      is_outbound: e.is_outbound,
      is_success: e.is_success,
      success_weight: e.success_weight,
      hour_of_week: getHourOfWeek(new Date(e.event_timestamp), timezone),
    }));

    // Run algorithm on training data
    const result = computeBestContactTimes(
      trainContactEvents,
      null,
      config,
      null,
      0.5
    );

    console.log(`  Predicted top 3 windows:`);
    result.recommended_windows.slice(0, 3).forEach((w, i) => {
      console.log(`    ${i + 1}. ${w.dow} ${w.start} (conf: ${(w.confidence * 100).toFixed(1)}%)`);
    });

    // Analyze test data: find actual best hour
    const testHourCounts = new Map<number, { total: number; successes: number }>();
    for (const event of testEvents) {
      if (!event.is_outbound) continue;
      
      const hour = getHourOfWeek(new Date(event.event_timestamp), timezone);
      const existing = testHourCounts.get(hour) || { total: 0, successes: 0 };
      existing.total++;
      if (event.is_success) existing.successes++;
      testHourCounts.set(hour, existing);
    }

    // Find hour with highest success rate in test set
    let bestTestHour = -1;
    let bestTestRate = 0;
    for (const [hour, counts] of testHourCounts.entries()) {
      const rate = counts.total > 0 ? counts.successes / counts.total : 0;
      if (rate > bestTestRate) {
        bestTestRate = rate;
        bestTestHour = hour;
      }
    }

    if (bestTestHour === -1) {
      console.log(`  ⚠️ No outbound test events to validate`);
      continue;
    }

    console.log(`  Actual best hour in test set: ${bestTestHour} (${(bestTestRate * 100).toFixed(1)}% success rate)`);

    // Check if prediction hit
    const predictedHours = result.recommended_windows.map(w => w.hour_of_week);
    const hitInTop3 = predictedHours.slice(0, 3).includes(bestTestHour);
    const hitInTop5 = predictedHours.slice(0, 5).includes(bestTestHour);

    console.log(`  ${hitInTop3 ? '✅' : '❌'} Predicted hour in top 3: ${hitInTop3}`);
    console.log(`  ${hitInTop5 ? '✅' : '❌'} Predicted hour in top 5: ${hitInTop5}`);

    // Calculate precision and recall at k=3
    const top3Predicted = predictedHours.slice(0, 3);
    const topActualHours = Array.from(testHourCounts.entries())
      .filter(([_, counts]) => counts.total >= 2) // Only hours with 2+ attempts
      .sort((a, b) => {
        const rateA = a[1].successes / a[1].total;
        const rateB = b[1].successes / b[1].total;
        return rateB - rateA;
      })
      .slice(0, 3)
      .map(([hour, _]) => hour);

    const intersection = top3Predicted.filter(h => topActualHours.includes(h)).length;
    const precision = top3Predicted.length > 0 ? intersection / top3Predicted.length : 0;
    const recall = topActualHours.length > 0 ? intersection / topActualHours.length : 0;

    console.log(`  Precision@3: ${(precision * 100).toFixed(1)}%`);
    console.log(`  Recall@3: ${(recall * 100).toFixed(1)}%`);

    results.push({
      contact_name: contactName,
      total_events: convEvents.length,
      train_events: trainEvents.length,
      test_events: testEvents.length,
      predicted_top_hour: predictedHours[0] || -1,
      actual_best_hour: bestTestHour,
      hit_in_top_3: hitInTop3,
      hit_in_top_5: hitInTop5,
      precision_at_3: precision,
      recall_at_3: recall,
    });
  }

  // Summary statistics
  console.log('\n' + '='.repeat(70));
  console.log('📊 BACKTEST SUMMARY');
  console.log('='.repeat(70));

  const validResults = results.length;
  const top3Hits = results.filter(r => r.hit_in_top_3).length;
  const top5Hits = results.filter(r => r.hit_in_top_5).length;
  const avgPrecision = results.reduce((sum, r) => sum + r.precision_at_3, 0) / validResults;
  const avgRecall = results.reduce((sum, r) => sum + r.recall_at_3, 0) / validResults;

  console.log(`\nContacts tested: ${validResults}`);
  console.log(`Hit rate@3: ${top3Hits}/${validResults} (${(top3Hits / validResults * 100).toFixed(1)}%)`);
  console.log(`Hit rate@5: ${top5Hits}/${validResults} (${(top5Hits / validResults * 100).toFixed(1)}%)`);
  console.log(`Average Precision@3: ${(avgPrecision * 100).toFixed(1)}%`);
  console.log(`Average Recall@3: ${(avgRecall * 100).toFixed(1)}%`);
  console.log(`F1-Score@3: ${(2 * avgPrecision * avgRecall / (avgPrecision + avgRecall) * 100).toFixed(1)}%`);

  // Baseline comparison (random would be ~1.8% hit rate in top 3 out of 168 bins)
  const randomBaseline = 3 / 168;
  const improvement = (top3Hits / validResults) / randomBaseline;
  console.log(`\nBaseline (random): ${(randomBaseline * 100).toFixed(1)}%`);
  console.log(`Improvement over random: ${improvement.toFixed(1)}x`);

  // Success criteria
  const minHitRate = 0.40; // 40% hit rate minimum
  const minImprovement = 10; // 10x better than random

  console.log('\n🎯 SUCCESS CRITERIA:');
  console.log(`  ✓ Hit rate@3 > ${(minHitRate * 100).toFixed(0)}%: ${top3Hits / validResults >= minHitRate ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  ✓ Improvement > ${minImprovement}x: ${improvement >= minImprovement ? '✅ PASS' : '❌ FAIL'}`);

  const passed = (top3Hits / validResults >= minHitRate) && (improvement >= minImprovement);

  if (passed) {
    console.log('\n🎉 BACKTEST PASSED! Algorithm performs well on holdout data.');
  } else {
    console.log('\n⚠️ BACKTEST FAILED! Algorithm needs improvement.');
  }

  console.log('\n');

  return {
    passed,
    results,
    summary: {
      validResults,
      top3Hits,
      top5Hits,
      avgPrecision,
      avgRecall,
      improvement,
    },
  };
}

// CLI execution
if (require.main === module) {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: ts-node scripts/backtest-algorithm.ts <user_id>');
    process.exit(1);
  }

  runBacktest(userId)
    .then((result) => {
      process.exit(result?.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Backtest failed:', error);
      process.exit(1);
    });
}

export { runBacktest };

