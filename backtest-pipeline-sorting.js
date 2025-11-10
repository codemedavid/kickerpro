/**
 * BACKTEST PIPELINE SORTING
 * Analyzes existing contacts and validates sorting accuracy
 * 
 * This script:
 * 1. Fetches existing pipeline opportunities
 * 2. Re-analyzes them with current prompts
 * 3. Compares new results vs current stage
 * 4. Calculates accuracy metrics
 * 5. Identifies patterns in mismatches
 * 
 * Usage: node backtest-pipeline-sorting.js
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

console.log('🔄 PIPELINE SORTING BACKTEST\n');
console.log('═══════════════════════════════════════════════════════\n');

// Configuration
const CONFIG = {
  userId: 'YOUR_USER_ID', // Replace with your user ID
  maxContacts: 20, // Limit for testing
  showDetails: true
};

async function fetchExistingOpportunities() {
  console.log('STEP 1: Fetch Existing Pipeline Contacts');
  console.log('─────────────────────────────────────────────────────\n');
  
  console.log('Run this SQL in Supabase to get opportunity IDs:\n');
  console.log('```sql');
  console.log(`SELECT`);
  console.log(`  po.id as opportunity_id,`);
  console.log(`  po.sender_name,`);
  console.log(`  ps.name as current_stage,`);
  console.log(`  po.ai_confidence_score,`);
  console.log(`  po.both_prompts_agreed`);
  console.log(`FROM pipeline_opportunities po`);
  console.log(`JOIN pipeline_stages ps ON po.stage_id = ps.id`);
  console.log(`WHERE po.user_id = '${CONFIG.userId}'`);
  console.log(`ORDER BY po.created_at DESC`);
  console.log(`LIMIT ${CONFIG.maxContacts};`);
  console.log('```\n');
  
  console.log('Copy the opportunity_ids and pass them as arguments:');
  console.log('node backtest-pipeline-sorting.js <opp_id_1> <opp_id_2> ...\n');
}

async function reanalyzeContacts(opportunityIds) {
  console.log('STEP 2: Re-analyze Contacts with Current Prompts');
  console.log('─────────────────────────────────────────────────────\n');
  
  console.log(`Re-analyzing ${opportunityIds.length} contacts...\n`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/pipeline/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        opportunity_ids: opportunityIds
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`✅ Re-analysis complete: ${result.analyzed} contacts\n`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Re-analysis failed:', error.message);
    console.log('\nThis could be due to:');
    console.log('- API quota exceeded (Gemini rate limit)');
    console.log('- Server not running');
    console.log('- Authentication issues');
    console.log('- Pipeline settings not configured\n');
    return null;
  }
}

async function compareResults(originalData, newResults) {
  console.log('STEP 3: Compare Original vs New Assignments');
  console.log('─────────────────────────────────────────────────────\n');
  
  console.log('Run this SQL in Supabase to see comparison:\n');
  console.log('```sql');
  console.log('-- Show before and after stages');
  console.log(`WITH backtest_results AS (`);
  console.log(`  SELECT`);
  console.log(`    po.id,`);
  console.log(`    po.sender_name,`);
  console.log(`    ps_old.name as original_stage,`);
  console.log(`    po.ai_analysis_result->'global_analysis'->>'recommended_stage' as new_recommended,`);
  console.log(`    po.ai_confidence_score as new_confidence,`);
  console.log(`    po.both_prompts_agreed as new_agreed`);
  console.log(`  FROM pipeline_opportunities po`);
  console.log(`  JOIN pipeline_stages ps_old ON po.stage_id = ps_old.id`);
  console.log(`  WHERE po.user_id = '${CONFIG.userId}'`);
  console.log(`    AND po.ai_analyzed_at > NOW() - INTERVAL '5 minutes'`);
  console.log(`)` );
  console.log(`SELECT`);
  console.log(`  sender_name,`);
  console.log(`  original_stage,`);
  console.log(`  new_recommended,`);
  console.log(`  CASE`);
  console.log(`    WHEN original_stage = new_recommended THEN '✅ CONSISTENT'`);
  console.log(`    ELSE '⚠️  CHANGED'`);
  console.log(`  END as consistency,`);
  console.log(`  new_confidence,`);
  console.log(`  new_agreed`);
  console.log(`FROM backtest_results;`);
  console.log('```\n');
}

async function calculateMetrics(results) {
  console.log('STEP 4: Calculate Accuracy Metrics');
  console.log('─────────────────────────────────────────────────────\n');
  
  if (!results || !results.results) {
    console.log('⚠️  No results to analyze\n');
    return null;
  }
  
  const data = results.results;
  const metrics = {
    total: data.length,
    highConfidence: data.filter(r => r.confidence >= 0.8).length,
    mediumConfidence: data.filter(r => r.confidence >= 0.5 && r.confidence < 0.8).length,
    lowConfidence: data.filter(r => r.confidence < 0.5).length,
    agreed: data.filter(r => r.both_agreed === true).length,
    disagreed: data.filter(r => r.both_agreed === false).length,
    stageDistribution: {}
  };
  
  // Calculate stage distribution
  data.forEach(r => {
    const stage = r.global_recommendation || 'Unknown';
    metrics.stageDistribution[stage] = (metrics.stageDistribution[stage] || 0) + 1;
  });
  
  // Display metrics
  console.log('📊 ANALYSIS METRICS:');
  console.log('─'.repeat(50));
  console.log(`Total Contacts:      ${metrics.total}`);
  console.log(`High Confidence:     ${metrics.highConfidence} (${(metrics.highConfidence/metrics.total*100).toFixed(1)}%)`);
  console.log(`Medium Confidence:   ${metrics.mediumConfidence} (${(metrics.mediumConfidence/metrics.total*100).toFixed(1)}%)`);
  console.log(`Low Confidence:      ${metrics.lowConfidence} (${(metrics.lowConfidence/metrics.total*100).toFixed(1)}%)`);
  console.log('');
  console.log(`Prompts Agreed:      ${metrics.agreed} (${(metrics.agreed/metrics.total*100).toFixed(1)}%)`);
  console.log(`Prompts Disagreed:   ${metrics.disagreed} (${(metrics.disagreed/metrics.total*100).toFixed(1)}%)`);
  console.log('');
  console.log('Stage Distribution:');
  Object.entries(metrics.stageDistribution).forEach(([stage, count]) => {
    console.log(`  ${stage}: ${count} (${(count/metrics.total*100).toFixed(1)}%)`);
  });
  console.log('');
  
  // Analysis
  const agreementRate = (metrics.agreed / metrics.total) * 100;
  const highConfidenceRate = (metrics.highConfidence / metrics.total) * 100;
  
  console.log('ASSESSMENT:');
  console.log('─'.repeat(50));
  
  if (agreementRate >= 80 && highConfidenceRate >= 70) {
    console.log('✅ EXCELLENT - System is working well');
    console.log('   High agreement and confidence rates');
  } else if (agreementRate >= 60) {
    console.log('✅ GOOD - System is working acceptably');
    console.log('   Some contacts need manual review');
  } else if (metrics.disagreed > metrics.agreed) {
    console.log('⚠️  WARNING - Too many disagreements');
    console.log('   Stage prompts may be too strict');
    console.log('   Consider making criteria more general');
  } else {
    console.log('❌ NEEDS IMPROVEMENT');
    console.log('   Review and adjust prompts');
  }
  console.log('');
  
  return metrics;
}

async function identifyPatterns(results) {
  console.log('STEP 5: Identify Patterns in Results');
  console.log('─────────────────────────────────────────────────────\n');
  
  if (!results || !results.results) {
    console.log('⚠️  No results to analyze for patterns\n');
    return;
  }
  
  const data = results.results;
  
  // Pattern 1: Disagreements
  const disagreements = data.filter(r => r.both_agreed === false);
  if (disagreements.length > 0) {
    console.log(`PATTERN 1: Disagreements (${disagreements.length} contacts)`);
    console.log('These contacts have uncertain classifications:\n');
    
    disagreements.forEach(d => {
      console.log(`  ${d.contact_name}`);
      console.log(`    Global recommended: ${d.global_recommendation}`);
      console.log(`    Stage matches: ${d.stage_specific_matches.join(', ') || 'None'}`);
      console.log('');
    });
    
    console.log('💡 Recommendation:');
    console.log('   If many contacts show this pattern, stage prompts');
    console.log('   may be too restrictive. Consider making criteria');
    console.log('   more general or adding more keyword examples.\n');
  }
  
  // Pattern 2: High confidence clusters
  const highConf = data.filter(r => r.confidence >= 0.8 && r.both_agreed);
  if (highConf.length > 0) {
    console.log(`PATTERN 2: High Confidence (${highConf.length} contacts)`);
    console.log('These contacts have clear stage assignments:\n');
    
    const stageGroups = {};
    highConf.forEach(c => {
      const stage = c.global_recommendation;
      if (!stageGroups[stage]) stageGroups[stage] = [];
      stageGroups[stage].push(c.contact_name);
    });
    
    Object.entries(stageGroups).forEach(([stage, contacts]) => {
      console.log(`  ${stage}: ${contacts.length} contacts`);
    });
    console.log('');
  }
  
  // Pattern 3: Low confidence
  const lowConf = data.filter(r => r.confidence < 0.5);
  if (lowConf.length > 0) {
    console.log(`PATTERN 3: Low Confidence (${lowConf.length} contacts)`);
    console.log('These contacts need better conversation data or prompts:\n');
    
    lowConf.forEach(c => {
      console.log(`  ${c.contact_name}: confidence ${c.confidence.toFixed(2)}`);
    });
    console.log('');
  }
}

// Main execution
(async () => {
  await runE2ETest();
})();
