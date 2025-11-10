/**
 * Complete Workflow Test
 * 
 * End-to-end test of the entire Best Time to Contact system
 * From data generation → computation → API → validation → cleanup
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database';
import { generateTestData } from './generate-test-data';
import { runBacktest } from './backtest-algorithm';
import { runAPITests } from './test-api-endpoints';
import { runEdgeCaseTests } from './test-edge-cases';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function runCompleteWorkflow(userId: string, testPageId: string) {
  console.log('🚀 COMPLETE WORKFLOW TEST - Best Time to Contact\n');
  console.log('='.repeat(80));
  console.log(`User ID: ${userId}`);
  console.log(`Page ID: ${testPageId}`);
  console.log('='.repeat(80));

  const results = {
    dataGeneration: { passed: false, contactsCreated: 0, eventsCreated: 0 },
    computation: { passed: false, processed: 0, durationMs: 0 },
    recommendations: { passed: false, count: 0 },
    validation: { passed: false, details: '' },
    cleanup: { passed: false, removed: 0 },
  };

  try {
    // ================================================================
    // STEP 1: Generate Test Data
    // ================================================================
    console.log('\n\n📝 STEP 1: Generate Test Data');
    console.log('='.repeat(80));

    const generateStart = Date.now();
    const generated = await generateTestData(userId, testPageId);
    const generateDuration = Date.now() - generateStart;

    console.log(`\n✅ Generated ${generated.contacts.length} contacts with ${generated.totalEvents} events`);
    console.log(`  Duration: ${(generateDuration / 1000).toFixed(1)}s`);

    results.dataGeneration = {
      passed: generated.contacts.length >= 50,
      contactsCreated: generated.contacts.length,
      eventsCreated: generated.totalEvents,
    };

    if (!results.dataGeneration.passed) {
      throw new Error('Failed to generate minimum 50 contacts');
    }

    // ================================================================
    // STEP 2: Trigger Computation
    // ================================================================
    console.log('\n\n⚙️  STEP 2: Trigger Contact Timing Computation');
    console.log('='.repeat(80));

    const computeStart = Date.now();
    const computeResponse = await fetch(`${BASE_URL}/api/contact-timing/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recompute_all: true }),
    });

    const computeData = await computeResponse.json();
    const computeDuration = Date.now() - computeStart;

    if (!computeResponse.ok || !computeData.success) {
      throw new Error(`Computation failed: ${computeData.error || 'Unknown error'}`);
    }

    console.log(`\n✅ Computed ${computeData.processed} contacts`);
    console.log(`  API Duration: ${computeDuration}ms`);
    console.log(`  Server Duration: ${computeData.duration_ms}ms`);
    console.log(`  Speed: ${(computeData.processed / (computeData.duration_ms / 1000)).toFixed(1)} contacts/second`);

    results.computation = {
      passed: computeData.processed >= 50,
      processed: computeData.processed,
      durationMs: computeData.duration_ms,
    };

    // ================================================================
    // STEP 3: Fetch Recommendations
    // ================================================================
    console.log('\n\n📊 STEP 3: Fetch Recommendations');
    console.log('='.repeat(80));

    const recResponse = await fetch(`${BASE_URL}/api/contact-timing/recommendations?limit=100&sort_by=composite_score&sort_order=desc`);
    const recData = await recResponse.json();

    if (!recResponse.ok || !recData.success) {
      throw new Error('Failed to fetch recommendations');
    }

    console.log(`\n✅ Fetched ${recData.data.length} recommendations`);
    console.log(`  Total available: ${recData.pagination.total}`);

    // Analyze results
    const highConfidence = recData.data.filter((r: any) => r.max_confidence >= 0.7).length;
    const mediumConfidence = recData.data.filter((r: any) => r.max_confidence >= 0.4 && r.max_confidence < 0.7).length;
    const lowConfidence = recData.data.filter((r: any) => r.max_confidence < 0.4).length;

    console.log(`\n  Confidence distribution:`);
    console.log(`    High (≥70%): ${highConfidence} (${(highConfidence / recData.data.length * 100).toFixed(1)}%)`);
    console.log(`    Medium (40-69%): ${mediumConfidence} (${(mediumConfidence / recData.data.length * 100).toFixed(1)}%)`);
    console.log(`    Low (<40%): ${lowConfidence} (${(lowConfidence / recData.data.length * 100).toFixed(1)}%)`);

    results.recommendations = {
      passed: recData.data.length >= 50,
      count: recData.data.length,
    };

    // ================================================================
    // STEP 4: Validate Data Quality
    // ================================================================
    console.log('\n\n✓ STEP 4: Validate Data Quality');
    console.log('='.repeat(80));

    let validationPassed = true;
    const validationDetails: string[] = [];

    // Check 1: All contacts have recommendations
    const { data: allConvs } = await supabase
      .from('messenger_conversations')
      .select('id')
      .eq('user_id', userId);

    const { data: allRecs } = await supabase
      .from('contact_timing_recommendations')
      .select('conversation_id')
      .eq('user_id', userId);

    const testConvs = (allConvs || []).filter(c => 
      generated.contacts.includes(c.id)
    );
    const testRecs = (allRecs || []).filter(r => 
      generated.contacts.includes(r.conversation_id)
    );

    const coverageRate = testConvs.length > 0 ? (testRecs.length / testConvs.length) : 0;
    console.log(`\n  Coverage: ${testRecs.length}/${testConvs.length} (${(coverageRate * 100).toFixed(1)}%)`);
    
    if (coverageRate < 0.9) {
      validationPassed = false;
      validationDetails.push(`Low coverage: ${(coverageRate * 100).toFixed(1)}%`);
    } else {
      console.log(`  ✅ Coverage ≥90%`);
    }

    // Check 2: Timezone inference worked
    const { data: timezones } = await supabase
      .from('contact_timing_recommendations')
      .select('timezone, timezone_confidence')
      .eq('user_id', userId)
      .limit(100);

    const tzInferred = (timezones || []).filter(t => t.timezone !== 'UTC').length;
    const tzRate = timezones ? (tzInferred / timezones.length) : 0;
    console.log(`  Timezone inference: ${tzInferred}/${timezones?.length} (${(tzRate * 100).toFixed(1)}%)`);

    // Check 3: Page information populated
    const firstThree = recData.data.slice(0, 3);
    const hasPageInfo = firstThree.every((r: any) => r.page_name && r.page_id);
    console.log(`  Page information: ${hasPageInfo ? '✅ Present' : '❌ Missing'}`);
    
    if (!hasPageInfo) {
      validationPassed = false;
      validationDetails.push('Page information missing');
    }

    // Check 4: Recommended windows structure
    const hasWindows = firstThree.every((r: any) => 
      Array.isArray(r.recommended_windows) && 
      r.recommended_windows.length > 0 &&
      r.recommended_windows[0].dow &&
      r.recommended_windows[0].start
    );
    console.log(`  Window structure: ${hasWindows ? '✅ Valid' : '❌ Invalid'}`);
    
    if (!hasWindows) {
      validationPassed = false;
      validationDetails.push('Invalid window structure');
    }

    // Check 5: Ranking order makes sense
    const scores = recData.data.slice(0, 10).map((r: any) => r.composite_score);
    const sortedCorrectly = scores.every((score: number, i: number) => 
      i === 0 || score <= scores[i - 1]
    );
    console.log(`  Ranking order: ${sortedCorrectly ? '✅ Correct' : '❌ Incorrect'}`);
    
    if (!sortedCorrectly) {
      validationPassed = false;
      validationDetails.push('Incorrect ranking order');
    }

    results.validation = {
      passed: validationPassed,
      details: validationDetails.join('; '),
    };

    if (validationPassed) {
      console.log(`\n✅ All validation checks passed`);
    } else {
      console.log(`\n⚠️  Some validation checks failed: ${validationDetails.join(', ')}`);
    }

    // ================================================================
    // STEP 5: Test Filtering and Sorting
    // ================================================================
    console.log('\n\n🔍 STEP 5: Test UI Features (Filtering & Sorting)');
    console.log('='.repeat(80));

    // Test confidence filter
    const highConfOnly = await fetch(`${BASE_URL}/api/contact-timing/recommendations?min_confidence=0.7&limit=20`);
    const highConfData = await highConfOnly.json();
    console.log(`  Filter (confidence ≥ 70%): ${highConfData.data?.length || 0} results`);

    // Test search
    const searchResults = await fetch(`${BASE_URL}/api/contact-timing/recommendations?search=Morning&limit=20`);
    const searchData = await searchResults.json();
    console.log(`  Search ("Morning"): ${searchData.data?.length || 0} results`);

    // Test pagination
    const page1 = await fetch(`${BASE_URL}/api/contact-timing/recommendations?limit=10&offset=0`);
    const page2 = await fetch(`${BASE_URL}/api/contact-timing/recommendations?limit=10&offset=10`);
    const p1Data = await page1.json();
    const p2Data = await page2.json();
    console.log(`  Pagination works: ${p1Data.data?.length === 10 && p2Data.data?.length > 0 ? '✅' : '❌'}`);

    // ================================================================
    // STEP 6: Verify Database State
    // ================================================================
    console.log('\n\n💾 STEP 6: Verify Database State');
    console.log('='.repeat(80));

    // Check bins exist
    const { data: bins } = await supabase
      .from('contact_timing_bins')
      .select('conversation_id, hour_of_week')
      .eq('user_id', userId)
      .in('conversation_id', generated.contacts.slice(0, 10));

    const binsPerContact = new Map<string, number>();
    (bins || []).forEach(b => {
      binsPerContact.set(b.conversation_id, (binsPerContact.get(b.conversation_id) || 0) + 1);
    });

    console.log(`\n  Bins created for ${binsPerContact.size} contacts`);
    const has168Bins = Array.from(binsPerContact.values()).filter(count => count === 168).length;
    console.log(`  Contacts with 168 bins: ${has168Bins}/${binsPerContact.size}`);

    // Check segment priors updated
    const { data: priors } = await supabase
      .from('contact_timing_segment_priors')
      .select('*')
      .eq('user_id', userId)
      .eq('segment_type', 'global');

    console.log(`  Segment priors: ${priors?.length || 0} hour-of-week entries`);

    // ================================================================
    // FINAL SUMMARY
    // ================================================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 COMPLETE WORKFLOW TEST SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n1. Data Generation:`);
    console.log(`   ${results.dataGeneration.passed ? '✅' : '❌'} ${results.dataGeneration.contactsCreated} contacts, ${results.dataGeneration.eventsCreated} events`);

    console.log(`\n2. Computation:`);
    console.log(`   ${results.computation.passed ? '✅' : '❌'} Processed ${results.computation.processed} contacts in ${results.computation.durationMs}ms`);

    console.log(`\n3. Recommendations:`);
    console.log(`   ${results.recommendations.passed ? '✅' : '❌'} Retrieved ${results.recommendations.count} recommendations`);

    console.log(`\n4. Validation:`);
    console.log(`   ${results.validation.passed ? '✅' : '❌'} ${results.validation.passed ? 'All checks passed' : results.validation.details}`);

    const overallPassed = 
      results.dataGeneration.passed &&
      results.computation.passed &&
      results.recommendations.passed &&
      results.validation.passed;

    console.log(`\n${'='.repeat(80)}`);
    if (overallPassed) {
      console.log('🎉 COMPLETE WORKFLOW TEST PASSED!');
      console.log('   The Best Time to Contact feature is working end-to-end.');
    } else {
      console.log('⚠️  COMPLETE WORKFLOW TEST FAILED!');
      console.log('   Review errors above.');
    }
    console.log('='.repeat(80));
    console.log('\n');

    return {
      passed: overallPassed,
      results,
      generatedContacts: generated.contacts,
    };
  } catch (error) {
    console.error('\n❌ Workflow test failed:', error);
    return {
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results,
    };
  }
}

// CLI execution
if (require.main === module) {
  const userId = process.argv[2];
  const testPageId = process.argv[3];

  if (!userId || !testPageId) {
    console.error('Usage: ts-node scripts/test-complete-workflow.ts <user_id> <test_page_id>');
    console.error('\nExample:');
    console.error('  ts-node scripts/test-complete-workflow.ts "uuid-here" "page-id-here"');
    process.exit(1);
  }

  runCompleteWorkflow(userId, testPageId)
    .then((result) => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Workflow execution failed:', error);
      process.exit(1);
    });
}

