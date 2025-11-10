/**
 * Mathematics Validation Script
 * 
 * Validates mathematical correctness of all algorithm components
 * Prints detailed step-by-step calculations for verification
 */

import {
  computeDecayWeight,
  getHourOfWeek,
  initializeBins,
  aggregateEventsToBins,
  computeRawProbabilities,
  applySmoothig,
  computeRecencyScore,
  computeCompositeScore,
  getDefaultConfig,
  type ContactEvent,
  type HourBin,
} from '../src/lib/contact-timing/algorithm';

console.log('═══════════════════════════════════════════════════════════');
console.log('  MATHEMATICS VALIDATION - Best Time to Contact Algorithm');
console.log('═══════════════════════════════════════════════════════════\n');

let allTestsPassed = true;

// Test 1: Beta-Binomial Posterior Calculation
console.log('📊 TEST 1: Beta-Binomial Posterior Calculation');
console.log('─────────────────────────────────────────────────');
{
  const config = getDefaultConfig();
  const bins: HourBin[] = [{
    hour_of_week: 34,
    trials_count: 10,
    success_count: 8,
    raw_probability: 0,
    smoothed_probability: 0,
    calibrated_probability: 0,
  }];

  console.log('Input:');
  console.log(`  N (trials) = ${bins[0].trials_count}`);
  console.log(`  S (successes) = ${bins[0].success_count}`);
  console.log(`  α (alpha prior) = ${config.alpha_prior}`);
  console.log(`  β (beta prior) = ${config.beta_prior}`);
  
  computeRawProbabilities(bins, null, config);
  
  console.log('\nCalculation:');
  console.log(`  p̂ = (S + α) / (N + α + β)`);
  console.log(`     = (${bins[0].success_count} + ${config.alpha_prior}) / (${bins[0].trials_count} + ${config.alpha_prior} + ${config.beta_prior})`);
  console.log(`     = ${bins[0].success_count + config.alpha_prior} / ${bins[0].trials_count + config.alpha_prior + config.beta_prior}`);
  console.log(`     = ${bins[0].raw_probability.toFixed(4)}`);
  
  const expected = (8 + 1) / (10 + 1 + 1); // 9/12 = 0.75
  const pass = Math.abs(bins[0].raw_probability - expected) < 0.001;
  console.log(`\nExpected: ${expected.toFixed(4)}`);
  console.log(`Got: ${bins[0].raw_probability.toFixed(4)}`);
  console.log(`Status: ${pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  if (!pass) allTestsPassed = false;
}

// Test 2: Time Decay Function
console.log('⏰ TEST 2: Two-Timescale Time Decay');
console.log('─────────────────────────────────────────────────');
{
  const ageDays = 14;
  const lambdaFast = 0.05;
  const lambdaSlow = 0.01;
  
  console.log('Input:');
  console.log(`  age = ${ageDays} days`);
  console.log(`  λ_fast = ${lambdaFast} (half-life ≈ ${(Math.log(2) / lambdaFast).toFixed(1)} days)`);
  console.log(`  λ_slow = ${lambdaSlow} (half-life ≈ ${(Math.log(2) / lambdaSlow).toFixed(1)} days)`);
  
  const weight = computeDecayWeight(ageDays, lambdaFast, lambdaSlow);
  
  const fastComponent = Math.exp(-lambdaFast * ageDays);
  const slowComponent = Math.exp(-lambdaSlow * ageDays);
  const expected = 0.5 * fastComponent + 0.5 * slowComponent;
  
  console.log('\nCalculation:');
  console.log(`  Fast component: e^(-${lambdaFast} × ${ageDays}) = ${fastComponent.toFixed(4)}`);
  console.log(`  Slow component: e^(-${lambdaSlow} × ${ageDays}) = ${slowComponent.toFixed(4)}`);
  console.log(`  weight = 0.5 × ${fastComponent.toFixed(4)} + 0.5 × ${slowComponent.toFixed(4)}`);
  console.log(`         = ${weight.toFixed(4)}`);
  
  const pass = Math.abs(weight - expected) < 0.001;
  console.log(`\nExpected: ${expected.toFixed(4)}`);
  console.log(`Got: ${weight.toFixed(4)}`);
  console.log(`Status: ${pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  if (!pass) allTestsPassed = false;
}

// Test 3: Monotonic Decay Property
console.log('📉 TEST 3: Monotonic Decay Property');
console.log('─────────────────────────────────────────────────');
{
  const ages = [0, 7, 14, 30, 60, 90];
  const weights = ages.map(age => computeDecayWeight(age, 0.05, 0.01));
  
  console.log('Age (days) → Weight:');
  ages.forEach((age, i) => {
    console.log(`  ${age.toString().padStart(3)} days → ${weights[i].toFixed(4)}`);
  });
  
  let isMonotonic = true;
  for (let i = 1; i < weights.length; i++) {
    if (weights[i] >= weights[i - 1]) {
      isMonotonic = false;
      console.log(`\n❌ Not monotonic: weight[${ages[i]}] = ${weights[i].toFixed(4)} >= weight[${ages[i-1]}] = ${weights[i-1].toFixed(4)}`);
    }
  }
  
  console.log(`\nStatus: ${isMonotonic ? '✅ PASS - Strictly decreasing' : '❌ FAIL'}\n`);
  
  if (!isMonotonic) allTestsPassed = false;
}

// Test 4: Smoothing Produces Valid Probabilities
console.log('🔄 TEST 4: Smoothing Validity (0 ≤ p̃ ≤ 1)');
console.log('─────────────────────────────────────────────────');
{
  const bins = initializeBins();
  
  // Set random probabilities
  for (let i = 0; i < 168; i++) {
    bins[i].raw_probability = Math.random();
  }
  
  applySmoothig(bins);
  
  let minSmoothed = 1.0;
  let maxSmoothed = 0.0;
  let invalidCount = 0;
  
  bins.forEach(bin => {
    if (bin.smoothed_probability < 0 || bin.smoothed_probability > 1) {
      invalidCount++;
    }
    minSmoothed = Math.min(minSmoothed, bin.smoothed_probability);
    maxSmoothed = Math.max(maxSmoothed, bin.smoothed_probability);
  });
  
  console.log(`Smoothed ${bins.length} bins:`);
  console.log(`  Min: ${minSmoothed.toFixed(4)}`);
  console.log(`  Max: ${maxSmoothed.toFixed(4)}`);
  console.log(`  Invalid (outside [0,1]): ${invalidCount}`);
  
  const pass = invalidCount === 0 && minSmoothed >= 0 && maxSmoothed <= 1;
  console.log(`\nStatus: ${pass ? '✅ PASS - All probabilities valid' : '❌ FAIL'}\n`);
  
  if (!pass) allTestsPassed = false;
}

// Test 5: Composite Score Weights Sum to 1.0
console.log('⚖️  TEST 5: Composite Score Weights Sum to 1.0');
console.log('─────────────────────────────────────────────────');
{
  const config = getDefaultConfig();
  const sum = config.w1_confidence + config.w2_recency + config.w3_priority;
  
  console.log('Weights:');
  console.log(`  w1 (confidence) = ${config.w1_confidence}`);
  console.log(`  w2 (recency)    = ${config.w2_recency}`);
  console.log(`  w3 (priority)   = ${config.w3_priority}`);
  console.log(`  Sum             = ${sum.toFixed(10)}`);
  
  const pass = Math.abs(sum - 1.0) < 0.0001;
  console.log(`\nExpected: 1.0000000000`);
  console.log(`Got: ${sum.toFixed(10)}`);
  console.log(`Status: ${pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  if (!pass) allTestsPassed = false;
}

// Test 6: Composite Score Boundary Test
console.log('🎯 TEST 6: Composite Score Boundaries');
console.log('─────────────────────────────────────────────────');
{
  const config = getDefaultConfig();
  
  const score000 = computeCompositeScore(0, 0, 0, config);
  const score111 = computeCompositeScore(1, 1, 1, config);
  const score050 = computeCompositeScore(0.5, 0, 0, config);
  
  console.log('Test cases:');
  console.log(`  score(0, 0, 0) = ${score000.toFixed(4)} (expected: 0.0000)`);
  console.log(`  score(1, 1, 1) = ${score111.toFixed(4)} (expected: 1.0000)`);
  console.log(`  score(0.5, 0, 0) = ${score050.toFixed(4)} (expected: ${(0.5 * config.w1_confidence).toFixed(4)})`);
  
  const pass1 = score000 === 0;
  const pass2 = score111 === 1;
  const pass3 = Math.abs(score050 - 0.5 * config.w1_confidence) < 0.001;
  
  const pass = pass1 && pass2 && pass3;
  console.log(`\nStatus: ${pass ? '✅ PASS - All boundaries correct' : '❌ FAIL'}\n`);
  
  if (!pass) allTestsPassed = false;
}

// Test 7: Recency Score Decay
console.log('📅 TEST 7: Recency Score Exponential Decay');
console.log('─────────────────────────────────────────────────');
{
  const now = new Date();
  const μ = 0.03;
  const halfLife = Math.log(2) / μ;
  
  console.log(`μ = ${μ} → Half-life ≈ ${halfLife.toFixed(1)} days\n`);
  
  const testDays = [0, 23, 46, 69];
  console.log('Days ago → Recency score:');
  
  let previousScore = 1.0;
  let isDecreasing = true;
  
  testDays.forEach(days => {
    const then = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const score = computeRecencyScore(then, now, μ);
    const expected = Math.exp(-μ * days);
    
    console.log(`  ${days.toString().padStart(3)} days → ${score.toFixed(4)} (expected: ${expected.toFixed(4)})`);
    
    if (score >= previousScore && days > 0) {
      isDecreasing = false;
    }
    previousScore = score;
  });
  
  // Check half-life
  const halfLifeTest = new Date(now.getTime() - halfLife * 24 * 60 * 60 * 1000);
  const halfLifeScore = computeRecencyScore(halfLifeTest, now, μ);
  const passHalfLife = Math.abs(halfLifeScore - 0.5) < 0.01;
  
  console.log(`\nHalf-life check: ${halfLife.toFixed(1)} days → ${halfLifeScore.toFixed(4)} (expected: ~0.5)`);
  console.log(`Status: ${isDecreasing && passHalfLife ? '✅ PASS - Exponential decay correct' : '❌ FAIL'}\n`);
  
  if (!isDecreasing || !passHalfLife) allTestsPassed = false;
}

// Test 8: Window Spacing Constraint
console.log('📏 TEST 8: Window Spacing Constraints');
console.log('─────────────────────────────────────────────────');
{
  const config = getDefaultConfig();
  const bins = initializeBins();
  
  // Create closely spaced high-probability bins
  bins[34].smoothed_probability = 0.9;  // Monday 10am
  bins[35].smoothed_probability = 0.89; // Monday 11am (1h apart)
  bins[36].smoothed_probability = 0.88; // Monday 12pm (2h apart)
  bins[37].smoothed_probability = 0.87; // Monday 1pm (3h apart)
  bins[38].smoothed_probability = 0.86; // Monday 2pm (4h apart)
  bins[58].smoothed_probability = 0.85; // Tuesday 10am (24h apart)
  
  // Import at runtime to avoid build issues
  const algorithmModule = await import('../src/lib/contact-timing/algorithm');
  const windows = algorithmModule.selectTopWindows(bins, config, false);
  
  console.log(`Min spacing required: ${config.min_spacing_hours} hours\n`);
  console.log('Selected windows:');
  windows.forEach((w: any, idx: number) => {
    console.log(`  ${idx + 1}. ${w.dow} ${w.start}-${w.end} (confidence: ${w.confidence}, bin: ${w.hour_of_week})`);
  });
  
  // Validate spacing
  let spacingViolation = false;
  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      const diff = Math.abs(windows[i].hour_of_week - windows[j].hour_of_week);
      const minDiff = Math.min(diff, 168 - diff); // Wraparound
      
      if (minDiff < config.min_spacing_hours) {
        console.log(`\n❌ Spacing violation: ${windows[i].dow} ${windows[i].start} and ${windows[j].dow} ${windows[j].start} are only ${minDiff}h apart`);
        spacingViolation = true;
      }
    }
  }
  
  console.log(`\nStatus: ${!spacingViolation ? '✅ PASS - All spacing constraints met' : '❌ FAIL'}\n`);
  
  if (spacingViolation) allTestsPassed = false;
}

// Test 9: Smoothing Formula Verification
console.log('🔄 TEST 9: Structured Smoothing Formula');
console.log('─────────────────────────────────────────────────');
{
  const bins = initializeBins();
  
  // Set up specific pattern for bin 34 (Monday 10am)
  bins[33].raw_probability = 0.6;  // Mon 9am
  bins[34].raw_probability = 0.8;  // Mon 10am (target)
  bins[35].raw_probability = 0.7;  // Mon 11am
  bins[10].raw_probability = 0.65; // Sun 10am (h-24)
  bins[58].raw_probability = 0.75; // Tue 10am (h+24)
  
  // Same hour across all days
  const sameHourBins = [10, 34, 58, 82, 106, 130, 154]; // All 10am slots
  sameHourBins.forEach((h, idx) => {
    if (h !== 34) {
      bins[h].raw_probability = 0.6 + Math.random() * 0.2;
    }
  });
  
  console.log('Input for bin 34 (Monday 10am):');
  console.log(`  p̂[34] (self) = ${bins[34].raw_probability.toFixed(4)}`);
  console.log(`  p̂[33] (h-1)  = ${bins[33].raw_probability.toFixed(4)}`);
  console.log(`  p̂[35] (h+1)  = ${bins[35].raw_probability.toFixed(4)}`);
  console.log(`  p̂[10] (h-24) = ${bins[10].raw_probability.toFixed(4)}`);
  console.log(`  p̂[58] (h+24) = ${bins[58].raw_probability.toFixed(4)}`);
  
  applySmoothig(bins);
  
  // Manual calculation
  const avgAdj = (bins[33].raw_probability + bins[35].raw_probability) / 2;
  const avgDay = (bins[10].raw_probability + bins[58].raw_probability) / 2;
  const avgSameHour = sameHourBins
    .filter(h => h !== 34)
    .reduce((sum, h) => sum + bins[h].raw_probability, 0) / 6;
  
  const expectedSmooth = 
    0.5 * bins[34].raw_probability +
    0.2 * avgAdj +
    0.2 * avgDay +
    0.1 * avgSameHour;
  
  console.log('\nCalculation:');
  console.log(`  p̃[34] = 0.5 × ${bins[34].raw_probability.toFixed(4)}`);
  console.log(`        + 0.2 × ${avgAdj.toFixed(4)} (avg of ±1h)`);
  console.log(`        + 0.2 × ${avgDay.toFixed(4)} (avg of ±24h)`);
  console.log(`        + 0.1 × ${avgSameHour.toFixed(4)} (avg same hour)`);
  console.log(`        = ${expectedSmooth.toFixed(4)}`);
  
  const pass = Math.abs(bins[34].smoothed_probability - expectedSmooth) < 0.01;
  console.log(`\nExpected: ${expectedSmooth.toFixed(4)}`);
  console.log(`Got: ${bins[34].smoothed_probability.toFixed(4)}`);
  console.log(`Status: ${pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  if (!pass) allTestsPassed = false;
}

// Test 10: Event Aggregation with Decay
console.log('📊 TEST 10: Event Aggregation with Decay');
console.log('─────────────────────────────────────────────────');
{
  const config = getDefaultConfig();
  const now = new Date();
  
  const events: ContactEvent[] = [
    {
      event_type: 'message_sent',
      event_timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 34,
    },
    {
      event_type: 'message_sent',
      event_timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      is_outbound: true,
      is_success: true,
      success_weight: 1.0,
      hour_of_week: 34,
    },
  ];
  
  console.log('Events:');
  console.log(`  Event 1: 7 days ago, success`);
  console.log(`  Event 2: 30 days ago, success`);
  
  const bins = aggregateEventsToBins(events, config, now);
  
  const weight7 = computeDecayWeight(7, config.lambda_fast, config.lambda_slow);
  const weight30 = computeDecayWeight(30, config.lambda_fast, config.lambda_slow);
  
  console.log(`\nDecay weights:`);
  console.log(`  7 days:  ${weight7.toFixed(4)}`);
  console.log(`  30 days: ${weight30.toFixed(4)}`);
  
  const expectedTrials = weight7 + weight30;
  const expectedSuccesses = weight7 * 1.0 + weight30 * 1.0;
  
  console.log(`\nBin 34 (Monday 10am):`);
  console.log(`  Expected trials: ${expectedTrials.toFixed(4)}`);
  console.log(`  Got trials: ${bins[34].trials_count.toFixed(4)}`);
  console.log(`  Expected successes: ${expectedSuccesses.toFixed(4)}`);
  console.log(`  Got successes: ${bins[34].success_count.toFixed(4)}`);
  
  const pass = 
    Math.abs(bins[34].trials_count - expectedTrials) < 0.01 &&
    Math.abs(bins[34].success_count - expectedSuccesses) < 0.01;
  
  console.log(`\nStatus: ${pass ? '✅ PASS - Aggregation correct' : '❌ FAIL'}\n`);
  
  if (!pass) allTestsPassed = false;
}

// Test 11: Hour-of-Week Calculation Across Timezones
console.log('🌍 TEST 11: Hour-of-Week Calculation (Timezones)');
console.log('─────────────────────────────────────────────────');
{
  const date = new Date('2025-11-10T15:00:00Z'); // 3pm UTC on Monday
  
  const timezones = [
    { tz: 'UTC', expected: 1 * 24 + 15, desc: 'Mon 15:00' },
    { tz: 'America/New_York', expected: 1 * 24 + 10, desc: 'Mon 10:00 (EST)' },
    { tz: 'America/Los_Angeles', expected: 1 * 24 + 7, desc: 'Mon 07:00 (PST)' },
    { tz: 'Europe/London', expected: 1 * 24 + 15, desc: 'Mon 15:00 (GMT)' },
    { tz: 'Asia/Tokyo', expected: 2 * 24 + 0, desc: 'Tue 00:00 (JST)' },
    { tz: 'Australia/Sydney', expected: 2 * 24 + 2, desc: 'Tue 02:00 (AEDT)' },
  ];
  
  console.log(`UTC time: ${date.toISOString()}\n`);
  
  let allPass = true;
  timezones.forEach(({ tz, expected, desc }) => {
    const hourOfWeek = getHourOfWeek(date, tz);
    const pass = hourOfWeek === expected;
    
    console.log(`  ${tz.padEnd(25)} → bin ${hourOfWeek.toString().padStart(3)} (${desc}) ${pass ? '✅' : '❌'}`);
    
    if (!pass) {
      console.log(`    Expected: ${expected}, Got: ${hourOfWeek}`);
      allPass = false;
    }
  });
  
  console.log(`\nStatus: ${allPass ? '✅ PASS - All timezones correct' : '❌ FAIL'}\n`);
  
  if (!allPass) allTestsPassed = false;
}

// Test 12: Hierarchical Prior Integration
console.log('🏛️  TEST 12: Hierarchical Bayesian Pooling');
console.log('─────────────────────────────────────────────────');
{
  const config = getDefaultConfig();
  const bins: HourBin[] = [{
    hour_of_week: 34,
    trials_count: 2,
    success_count: 1,
    raw_probability: 0,
    smoothed_probability: 0,
    calibrated_probability: 0,
  }];
  
  const segmentPriors = new Map();
  segmentPriors.set(34, {
    hour_of_week: 34,
    trials_count: 100,
    success_count: 60,
    response_rate: 0.6,
  });
  
  const segPrior = segmentPriors.get(34);
  
  console.log('Contact data:');
  console.log('  N (trials) =', bins[0].trials_count);
  console.log('  S (successes) =', bins[0].success_count);
  console.log('\nSegment prior:');
  console.log('  N_segment =', segPrior.trials_count);
  console.log('  S_segment =', segPrior.success_count);
  console.log('  kappa =', config.hierarchical_kappa);
  
  computeRawProbabilities(bins, segmentPriors, config);
  
  const alpha = config.alpha_prior + config.hierarchical_kappa * segPrior.success_count;
  const beta = config.beta_prior + config.hierarchical_kappa * (segPrior.trials_count - segPrior.success_count);
  const expected = (bins[0].success_count + alpha) / (bins[0].trials_count + alpha + beta);
  
  console.log('\nCalculation:');
  console.log('  alpha =', config.alpha_prior, '+', config.hierarchical_kappa, '*', segPrior.success_count, '=', alpha);
  console.log('  beta =', config.beta_prior, '+', config.hierarchical_kappa, '*', (segPrior.trials_count - segPrior.success_count), '=', beta);
  console.log('  p_hat = (' + bins[0].success_count + ' + ' + alpha + ') / (' + bins[0].trials_count + ' + ' + alpha + ' + ' + beta + ')');
  console.log('        =', (bins[0].success_count + alpha), '/', (bins[0].trials_count + alpha + beta));
  console.log('        =', bins[0].raw_probability.toFixed(4));
  
  const pass = Math.abs(bins[0].raw_probability - expected) < 0.001;
  console.log(`\nExpected: ${expected.toFixed(4)}`);
  console.log(`Got: ${bins[0].raw_probability.toFixed(4)}`);
  console.log(`Status: ${pass ? '✅ PASS - Hierarchical pooling correct' : '❌ FAIL'}\n`);
  
  if (!pass) allTestsPassed = false;
}

// Final Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('  VALIDATION COMPLETE');
console.log('═══════════════════════════════════════════════════════════\n');

if (allTestsPassed) {
  console.log('✅ ALL TESTS PASSED - Mathematics is correct!\n');
  console.log('The algorithm implements:');
  console.log('  ✓ Beta-Binomial posterior calculation');
  console.log('  ✓ Two-timescale exponential decay');
  console.log('  ✓ Hierarchical Bayesian pooling');
  console.log('  ✓ Structured smoothing with neighbor averaging');
  console.log('  ✓ Composite scoring with proper weighting');
  console.log('  ✓ Timezone-aware hour-of-week calculation');
  console.log('  ✓ Window selection with spacing constraints');
  console.log('  ✓ Recency scoring with exponential decay\n');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED - Review output above\n');
  process.exit(1);
}
