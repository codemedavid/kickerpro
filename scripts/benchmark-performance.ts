/**
 * Performance Benchmarking
 * 
 * Measures computation speed, database performance, and identifies bottlenecks
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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface BenchmarkResult {
  contactCount: number;
  totalDurationMs: number;
  avgPerContact: number;
  contactsPerSecond: number;
  memoryUsedMB?: number;
}

export async function runPerformanceBenchmark(userId: string) {
  console.log('⚡ PERFORMANCE BENCHMARK - Best Time to Contact\n');
  console.log('='.repeat(80));

  const benchmarks: BenchmarkResult[] = [];

  // ================================================================
  // BENCHMARK 1: Algorithm performance (in-memory)
  // ================================================================
  console.log('\n📊 BENCHMARK 1: Pure Algorithm Performance (In-Memory)');
  console.log('-'.repeat(80));

  const config = getDefaultConfig();
  const now = new Date();

  // Generate sample events
  function generateSampleEvents(count: number): ContactEvent[] {
    const events: ContactEvent[] = [];
    for (let i = 0; i < count; i++) {
      events.push({
        event_type: 'message_sent',
        event_timestamp: new Date(now.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        is_outbound: true,
        is_success: Math.random() > 0.5,
        success_weight: Math.random(),
        hour_of_week: Math.floor(Math.random() * 168),
      });
    }
    return events;
  }

  const testCases = [
    { events: 5, description: 'Sparse (5 events)' },
    { events: 20, description: 'Normal (20 events)' },
    { events: 50, description: 'Active (50 events)' },
    { events: 100, description: 'Heavy (100 events)' },
  ];

  console.log('\nSingle contact computation time:\n');

  for (const testCase of testCases) {
    const events = generateSampleEvents(testCase.events);
    const iterations = 100;
    
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      computeBestContactTimes(events, null, config, now, 0.5);
    }
    const duration = Date.now() - start;
    const avgMs = duration / iterations;

    console.log(`  ${testCase.description.padEnd(20)} → ${avgMs.toFixed(2)}ms per contact`);
  }

  // ================================================================
  // BENCHMARK 2: Database query performance
  // ================================================================
  console.log('\n\n📊 BENCHMARK 2: Database Query Performance');
  console.log('-'.repeat(80));

  // Test: Fetch events for single contact
  const { data: testConv } = await supabase
    .from('messenger_conversations')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (testConv) {
    const queryStart = Date.now();
    const { data: events } = await supabase
      .from('contact_interaction_events')
      .select('*')
      .eq('conversation_id', testConv.id);
    const queryDuration = Date.now() - queryStart;

    console.log(`\n  Fetch events for 1 contact: ${queryDuration}ms (${events?.length || 0} events)`);
  }

  // Test: Fetch recommendations (paginated)
  const recStart = Date.now();
  const { data: recs } = await supabase
    .from('contact_timing_recommendations')
    .select('*')
    .eq('user_id', userId)
    .order('composite_score', { ascending: false })
    .limit(50);
  const recDuration = Date.now() - recStart;

  console.log(`  Fetch 50 recommendations: ${recDuration}ms`);

  // Test: Count queries
  const countStart = Date.now();
  const { count } = await supabase
    .from('contact_timing_recommendations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const countDuration = Date.now() - countStart;

  console.log(`  Count query: ${countDuration}ms (${count} records)`);

  // ================================================================
  // BENCHMARK 3: API endpoint performance
  // ================================================================
  console.log('\n\n📊 BENCHMARK 3: API Endpoint Performance');
  console.log('-'.repeat(80));

  const targetCounts = [10, 50, 100];

  for (const target of targetCounts) {
    // Get test conversation IDs
    const { data: testConvs } = await supabase
      .from('messenger_conversations')
      .select('id')
      .eq('user_id', userId)
      .limit(target);

    if (!testConvs || testConvs.length === 0) {
      console.log(`\n  Skipping ${target} contacts (not enough data)`);
      continue;
    }

    const convIds = testConvs.map(c => c.id);

    console.log(`\n  Computing ${convIds.length} contacts via API:`);

    const apiStart = Date.now();
    const response = await fetch(`${BASE_URL}/api/contact-timing/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_ids: convIds, recompute_all: false }),
    });

    const data = await response.json();
    const apiDuration = Date.now() - apiStart;

    if (data.success) {
      const speed = (data.processed / (data.duration_ms / 1000)).toFixed(1);
      console.log(`    Total: ${apiDuration}ms (API overhead: ${apiDuration - data.duration_ms}ms)`);
      console.log(`    Server: ${data.duration_ms}ms`);
      console.log(`    Speed: ${speed} contacts/second`);
      console.log(`    Per contact: ${(data.duration_ms / data.processed).toFixed(2)}ms`);

      benchmarks.push({
        contactCount: data.processed,
        totalDurationMs: data.duration_ms,
        avgPerContact: data.duration_ms / data.processed,
        contactsPerSecond: parseFloat(speed),
      });
    } else {
      console.log(`    ❌ Failed: ${data.error}`);
    }
  }

  // ================================================================
  // BENCHMARK 4: Scaling analysis
  // ================================================================
  console.log('\n\n📊 BENCHMARK 4: Scaling Analysis');
  console.log('-'.repeat(80));

  if (benchmarks.length >= 2) {
    console.log('\nComputational complexity analysis:\n');
    console.log('  Contacts  |  Duration  |  Per Contact  |  Contacts/sec');
    console.log('  ' + '-'.repeat(65));

    benchmarks.forEach(b => {
      console.log(`  ${b.contactCount.toString().padStart(8)}  |  ${b.totalDurationMs.toString().padStart(8)}ms  |  ${b.avgPerContact.toFixed(2).padStart(11)}ms  |  ${b.contactsPerSecond.toString().padStart(13)}`);
    });

    // Extrapolate
    if (benchmarks.length > 1) {
      const avgPerContact = benchmarks.reduce((sum, b) => sum + b.avgPerContact, 0) / benchmarks.length;
      
      console.log('\n  Extrapolated performance:');
      console.log(`    1,000 contacts:  ~${(avgPerContact * 1000 / 1000).toFixed(1)}s`);
      console.log(`    5,000 contacts:  ~${(avgPerContact * 5000 / 1000).toFixed(1)}s`);
      console.log(`    10,000 contacts: ~${(avgPerContact * 10000 / 1000).toFixed(1)}s`);
    }
  }

  // ================================================================
  // BENCHMARK 5: Memory profiling
  // ================================================================
  console.log('\n\n📊 BENCHMARK 5: Memory Usage');
  console.log('-'.repeat(80));

  if (typeof global.gc === 'function') {
    global.gc();
    const memBefore = process.memoryUsage();
    
    // Compute 100 contacts
    const events = generateSampleEvents(20);
    for (let i = 0; i < 100; i++) {
      computeBestContactTimes(events, null, config, now, 0.5);
    }
    
    const memAfter = process.memoryUsage();
    const heapUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

    console.log(`\n  Memory delta after 100 computations:`);
    console.log(`    Heap used: ${heapUsed.toFixed(2)} MB`);
    console.log(`    Per contact: ${(heapUsed / 100).toFixed(3)} MB`);
  } else {
    console.log('\n  ℹ️  Run with --expose-gc flag for memory profiling');
  }

  // ================================================================
  // TARGET VALIDATION
  // ================================================================
  console.log('\n\n🎯 TARGET VALIDATION');
  console.log('-'.repeat(80));

  const targetSpeed = 50; // 50 contacts/second minimum

  if (benchmarks.length > 0) {
    const avgSpeed = benchmarks.reduce((sum, b) => sum + b.contactsPerSecond, 0) / benchmarks.length;
    
    console.log(`\n  Target: ≥${targetSpeed} contacts/second`);
    console.log(`  Achieved: ${avgSpeed.toFixed(1)} contacts/second`);
    console.log(`  Status: ${avgSpeed >= targetSpeed ? '✅ PASS - Meets target' : '⚠️  FAIL - Below target'}`);

    // Identify bottlenecks
    console.log('\n  Bottleneck analysis:');
    const maxAvgPerContact = Math.max(...benchmarks.map(b => b.avgPerContact));
    const minAvgPerContact = Math.min(...benchmarks.map(b => b.avgPerContact));
    const scalingRatio = maxAvgPerContact / minAvgPerContact;

    if (scalingRatio > 1.5) {
      console.log(`    ⚠️  Performance degrades with scale (${scalingRatio.toFixed(2)}x slower for larger batches)`);
      console.log(`    → Likely bottleneck: Database I/O`);
    } else {
      console.log(`    ✅ Good scaling (${scalingRatio.toFixed(2)}x ratio)`);
      console.log(`    → Computation is O(n)`);
    }
  }

  // ================================================================
  // SUMMARY
  // ================================================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 PERFORMANCE BENCHMARK SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nTests completed: ${benchmarks.length}`);
  
  if (benchmarks.length > 0) {
    const avgSpeed = benchmarks.reduce((sum, b) => sum + b.contactsPerSecond, 0) / benchmarks.length;
    const passed = avgSpeed >= targetSpeed;

    console.log(`Average speed: ${avgSpeed.toFixed(1)} contacts/second`);
    console.log(`\n${passed ? '✅ PERFORMANCE BENCHMARKS PASSED!' : '⚠️  PERFORMANCE BELOW TARGET'}`);

    return { passed, benchmarks, avgSpeed };
  } else {
    console.log('\n⚠️  No benchmarks completed');
    return { passed: false, benchmarks, avgSpeed: 0 };
  }
}

// CLI execution
if (require.main === module) {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: ts-node scripts/benchmark-performance.ts <user_id>');
    process.exit(1);
  }

  runPerformanceBenchmark(userId)
    .then((result) => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Benchmark failed:', error);
      process.exit(1);
    });
}

