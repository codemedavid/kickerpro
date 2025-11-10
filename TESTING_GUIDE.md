# Best Time to Contact - Testing Guide

## Quick Start (5 Minutes)

### 1. Run Unit Tests

```bash
npm test
```

This runs Jest tests for all algorithm and timezone functions (65+ tests).

### 2. Generate Test Data

```bash
ts-node scripts/generate-test-data.ts YOUR_USER_ID YOUR_PAGE_ID
```

Creates 52 test contacts with 1,200+ interaction events.

### 3. Run All Tests

```bash
ts-node scripts/run-all-tests.ts YOUR_USER_ID YOUR_PAGE_ID
```

Executes complete test suite: generation → computation → validation → cleanup.

---

## Detailed Testing

### Unit Tests (Jest)

**What it tests:** Individual functions in isolation

```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run specific test file
npm test algorithm.test.ts
npm test timezone.test.ts

# Watch mode (auto-rerun on changes)
npm run test
```

**Expected output:**
```
Test Suites: 2 passed, 2 total
Tests: 65 passed, 65 total
Coverage: 100%
```

---

### Mathematics Validation

**What it tests:** Mathematical correctness of formulas

```bash
ts-node scripts/validate-mathematics.ts
```

**Validates:**
- Beta-Binomial posterior calculation
- Two-timescale time decay
- Monotonic decay property
- Smoothing validity
- Weight constraints
- Composite score boundaries
- Timezone conversions
- Hierarchical pooling

**Expected output:**
```
✅ PASS - Beta-Binomial correct
✅ PASS - Time decay correct  
✅ PASS - Smoothing valid
...
✅ ALL TESTS PASSED - Mathematics is correct!
```

---

### API Integration Tests

**What it tests:** HTTP endpoints, request/response, database writes

```bash
ts-node scripts/test-api-endpoints.ts YOUR_USER_ID
```

**Tests:**
- POST /api/contact-timing/compute (empty, partial, full)
- GET /api/contact-timing/recommendations (pagination, sorting, filtering)
- Response structure validation
- Page information inclusion

**Expected output:**
```
✅ PASS - POST compute empty dataset
✅ PASS - POST compute specific IDs
✅ PASS - GET recommendations basic
...
🎉 ALL API TESTS PASSED!
```

---

### Backtesting

**What it tests:** Predictive accuracy on holdout data

```bash
ts-node scripts/backtest-algorithm.ts YOUR_USER_ID
```

**Methodology:**
1. Split data: 70% train, 30% test
2. Train on first 70%
3. Predict best times
4. Validate against last 30%
5. Calculate hit rates, precision, recall

**Success criteria:**
- Hit rate@3 > 40%
- Improvement > 10x random

**Expected output:**
```
Hit rate@3: 46.2% ✅
Improvement over random: 25.7x ✅
🎉 BACKTEST PASSED!
```

---

### Edge Case Tests

**What it tests:** Boundary conditions and extreme scenarios

```bash
ts-node scripts/test-edge-cases.ts YOUR_USER_ID
```

**Scenarios:**
- Single interaction (minimum data)
- 150+ interactions (performance)
- 100% success rate
- 0% success rate
- Timezone day boundaries
- Quiet hours overlap
- Week wraparound spacing
- NULL/corrupted data
- Invalid hour_of_week
- Extreme latency
- Concurrent database operations

**Expected output:**
```
✅ PASS - Single interaction handled
✅ PASS - Large dataset < 1000ms
✅ PASS - All successes valid
...
🎉 ALL EDGE CASE TESTS PASSED!
```

---

### Performance Benchmarking

**What it tests:** Speed, scaling, bottlenecks

```bash
ts-node scripts/benchmark-performance.ts YOUR_USER_ID

# With memory profiling:
node --expose-gc -r ts-node/register scripts/benchmark-performance.ts YOUR_USER_ID
```

**Measures:**
- Computation time per contact
- Contacts processed per second
- Database query performance
- Scaling characteristics
- Memory usage

**Target:** ≥50 contacts/second

**Expected output:**
```
10 contacts:  120 contacts/second ✅
50 contacts:  118 contacts/second ✅
100 contacts: 115 contacts/second ✅

✅ PERFORMANCE BENCHMARKS PASSED!
```

---

### Database Verification

**What it tests:** Schema, RLS, constraints, indexes

```bash
# In Supabase SQL Editor, run:
scripts/verify-database-state.sql
```

**Checks:**
- All 6 tables created
- RLS enabled on all tables
- 12 RLS policies exist
- 12 indexes created
- CHECK constraints valid
- Foreign keys correct
- Triggers functional

**Expected output:**
```
✅ PASS - All 6 tables exist
✅ PASS - RLS enabled on all tables
✅ PASS - All probabilities valid
...
```

---

### Complete Workflow Test

**What it tests:** End-to-end system integration

```bash
ts-node scripts/test-complete-workflow.ts YOUR_USER_ID YOUR_PAGE_ID
```

**Steps:**
1. Generate 50+ test contacts
2. Trigger computation via API
3. Fetch recommendations
4. Validate data quality
5. Test UI features
6. Verify database state

**Expected output:**
```
✅ Generated 52 contacts
✅ Computed 52 contacts in 891ms
✅ Retrieved 52 recommendations
✅ All validation checks passed
🎉 COMPLETE WORKFLOW TEST PASSED!
```

---

### Cleanup Test Data

**What it does:** Removes all test data safely

```bash
# Preview only (dry run)
ts-node scripts/cleanup-test-data.ts YOUR_USER_ID --dry-run

# Actually delete
ts-node scripts/cleanup-test-data.ts YOUR_USER_ID
```

**Removes:**
- Test conversations (sender_id starts with TEST_)
- Test events (metadata.test = true)
- Associated bins
- Associated recommendations

**Safety:** Only affects test data, production data untouched

---

## Master Test Runner

### Run Everything At Once

```bash
ts-node scripts/run-all-tests.ts YOUR_USER_ID YOUR_PAGE_ID

# Keep test data after (for inspection)
ts-node scripts/run-all-tests.ts YOUR_USER_ID YOUR_PAGE_ID --no-skip-cleanup
```

This executes all 7 phases in order:
1. Generate test data
2. API integration tests
3. Edge case tests
4. Backtesting
5. Performance benchmarking
6. Complete workflow
7. Cleanup

**Duration:** ~2-5 minutes (depending on data size)

**Expected output:**
```
Phase 1: ✅ Data Generation - Created 52 contacts
Phase 2: ✅ API Tests - Passed: 11, Failed: 0
Phase 3: ✅ Edge Cases - Passed: 15, Failed: 0
Phase 4: ✅ Backtest - Hit rate@3: 46.2%
Phase 5: ✅ Performance - Speed: 120 contacts/sec
Phase 6: ✅ Workflow - All steps completed
Phase 7: ✅ Cleanup - Removed test data

🎉 ALL TESTS PASSED! 🎉
✨ Ready to deploy to production! ✨
```

---

## Test Data Scenarios

The test suite includes 52 contacts covering:

### 1. Clear Patterns (10 contacts)
- Morning people (8am-11am), 80%+ success rate
- Evening people (6pm-9pm), 75%+ success rate
- Afternoon people (1pm-4pm), 80%+ success rate
- **Expected:** High confidence (>70%)

### 2. Sparse Data (10 contacts)
- 1-4 events each
- Various success rates
- **Expected:** Low confidence (<40%), uses segment priors

### 3. Different Timezones (10 contacts)
- US Eastern, Pacific, Central, Mountain
- Europe: London, Paris, Berlin
- Asia: India, Singapore, Tokyo
- Australia: Sydney
- **Expected:** Correct timezone inference

### 4. Irregular Patterns (10 contacts)
- Random timing
- 35-43% success rates
- **Expected:** Medium confidence, multiple windows

### 5. Edge Cases (10 contacts)
- Quiet hours constraints
- Preferred days (weekdays/weekends only)
- Business hours only
- **Expected:** Constraints respected in recommendations

### 6. Various Channels (10 contacts + 2 extra)
- Messenger, calls, meetings, email, SMS
- Mixed channels
- **Expected:** Channel-agnostic recommendations

---

## Troubleshooting

### Tests Failing?

**Problem:** `npm test` fails

**Solutions:**
1. Ensure Jest installed: `npm install --save-dev jest@30.2.0`
2. Check TypeScript: `npm install --save-dev typescript@5`
3. Verify jest.config.js exists
4. Run: `npm install` to install all deps

---

**Problem:** `ts-node` command not found

**Solutions:**
```bash
npm install -g ts-node
# Or use npx:
npx ts-node scripts/validate-mathematics.ts
```

---

**Problem:** Supabase connection errors

**Solutions:**
1. Check .env file has NEXT_PUBLIC_SUPABASE_URL
2. Check NEXT_PUBLIC_SUPABASE_ANON_KEY
3. Verify keys are correct
4. Test connection: `ts-node scripts/test-api-endpoints.ts <user_id>`

---

**Problem:** No test data found

**Solutions:**
1. Run data generation first: `ts-node scripts/generate-test-data.ts <user_id> <page_id>`
2. Verify data created: Check Supabase dashboard
3. Check user_id is correct

---

**Problem:** Backtest shows low hit rate (<40%)

**Possible causes:**
1. Not enough events per contact (need 10+)
2. Very irregular patterns in test data
3. Algorithm needs tuning

**Solutions:**
1. Regenerate data with clearer patterns
2. Increase event count in generate-test-data.ts
3. Adjust hyperparameters in contact_timing_config

---

## Best Practices

### Before Deployment

1. ✅ Run `npm test` - All unit tests must pass
2. ✅ Run `ts-node scripts/validate-mathematics.ts` - Math must be correct
3. ✅ Run `ts-node scripts/run-all-tests.ts` - End-to-end must work
4. ✅ Check TEST_RESULTS.md - Review all metrics

### After Deployment

1. Monitor API error rates (<1%)
2. Track computation duration (<10ms/contact)
3. Compare production hit rates to backtest
4. Collect user feedback

### Regular Maintenance

- **Weekly:** Review confidence distribution
- **Monthly:** Re-run backtest on production data
- **Quarterly:** Performance benchmark
- **As needed:** Retune hyperparameters

---

## File Reference

```
__tests__/
├── lib/contact-timing/
│   ├── algorithm.test.ts       # Unit tests for core algorithm
│   └── timezone.test.ts        # Unit tests for timezone inference

scripts/
├── run-all-tests.ts            # Master test runner ⭐
├── generate-test-data.ts       # Creates 52 test contacts
├── backtest-algorithm.ts       # Train/test split validation
├── validate-mathematics.ts     # Formula verification
├── test-api-endpoints.ts       # HTTP endpoint tests
├── verify-database-state.sql   # Schema validation (SQL)
├── test-edge-cases.ts          # Boundary condition tests
├── test-complete-workflow.ts   # End-to-end test
├── benchmark-performance.ts    # Speed & scaling tests
└── cleanup-test-data.ts        # Remove test data

TEST_RESULTS.md                 # Comprehensive test report
TESTING_GUIDE.md                # This file
```

---

## Command Cheat Sheet

```bash
# Quick validation (30 seconds)
npm test
ts-node scripts/validate-mathematics.ts

# Full test suite (2-5 minutes)
ts-node scripts/run-all-tests.ts YOUR_USER_ID YOUR_PAGE_ID

# Individual tests
ts-node scripts/generate-test-data.ts YOUR_USER_ID YOUR_PAGE_ID
ts-node scripts/backtest-algorithm.ts YOUR_USER_ID
ts-node scripts/test-api-endpoints.ts YOUR_USER_ID
ts-node scripts/test-edge-cases.ts YOUR_USER_ID
ts-node scripts/benchmark-performance.ts YOUR_USER_ID

# Database verification
# Copy/paste scripts/verify-database-state.sql into Supabase SQL Editor

# Cleanup
ts-node scripts/cleanup-test-data.ts YOUR_USER_ID
```

---

## Success Criteria Summary

✅ **Unit tests:** 65+ tests passed  
✅ **Mathematics:** All formulas verified  
✅ **API tests:** 11/11 passed  
✅ **Edge cases:** 15/15 passed  
✅ **Backtest:** Hit rate >40%, Improvement >10x  
✅ **Performance:** >50 contacts/sec  
✅ **Database:** Schema valid, RLS working  
✅ **Workflow:** End-to-end functional  

**When all ✅:** System is production ready!

---

**Last Updated:** November 2025  
**Feature Version:** 1.0.0  
**Test Framework:** Jest 30.2.0 + TypeScript + Supabase

