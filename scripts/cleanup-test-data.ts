/**
 * Cleanup Test Data
 * 
 * Safely removes all test data from Best Time to Contact tables
 * Idempotent - safe to run multiple times
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export async function cleanupTestData(userId: string, dryRun: boolean = false) {
  console.log('🧹 CLEANUP TEST DATA - Best Time to Contact\n');
  console.log('='.repeat(80));
  console.log(`User ID: ${userId}`);
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '🗑️  DELETE MODE'}`);
  console.log('='.repeat(80));

  const summary = {
    conversations: 0,
    events: 0,
    bins: 0,
    recommendations: 0,
    priors: 0,
    executions: 0,
  };

  try {
    // ================================================================
    // STEP 1: Find test conversations
    // ================================================================
    console.log('\n\n📝 STEP 1: Identify Test Conversations');
    console.log('-'.repeat(80));

    // Find all conversations with test sender_ids
    const { data: testConversations } = await supabase
      .from('messenger_conversations')
      .select('id, sender_id, sender_name')
      .eq('user_id', userId)
      .or('sender_id.like.TEST_%,sender_id.like.concurrent_test_%');

    console.log(`\nFound ${testConversations?.length || 0} test conversations:`);
    (testConversations || []).slice(0, 10).forEach(c => {
      console.log(`  - ${c.sender_name} (${c.sender_id})`);
    });
    if ((testConversations?.length || 0) > 10) {
      console.log(`  ... and ${(testConversations?.length || 0) - 10} more`);
    }

    const conversationIds = (testConversations || []).map(c => c.id);

    // ================================================================
    // STEP 2: Count test events
    // ================================================================
    console.log('\n\n📊 STEP 2: Count Test Events');
    console.log('-'.repeat(80));

    const { count: eventCount } = await supabase
      .from('contact_interaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .or('metadata->>test.eq.true,conversation_id.in.(' + conversationIds.join(',') + ')');

    console.log(`\nFound ${eventCount || 0} test events`);
    summary.events = eventCount || 0;

    // ================================================================
    // STEP 3: Count bins
    // ================================================================
    console.log('\n\n📦 STEP 3: Count Timing Bins');
    console.log('-'.repeat(80));

    if (conversationIds.length > 0) {
      const { count: binCount } = await supabase
        .from('contact_timing_bins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('conversation_id', conversationIds);

      console.log(`\nFound ${binCount || 0} timing bins`);
      summary.bins = binCount || 0;
    }

    // ================================================================
    // STEP 4: Count recommendations
    // ================================================================
    console.log('\n\n🎯 STEP 4: Count Recommendations');
    console.log('-'.repeat(80));

    if (conversationIds.length > 0) {
      const { count: recCount } = await supabase
        .from('contact_timing_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('conversation_id', conversationIds);

      console.log(`\nFound ${recCount || 0} recommendations`);
      summary.recommendations = recCount || 0;
    }

    // ================================================================
    // STEP 5: DELETE (if not dry run)
    // ================================================================
    if (!dryRun) {
      console.log('\n\n🗑️  STEP 5: Delete Test Data');
      console.log('-'.repeat(80));

      // Delete in reverse dependency order

      // 1. Delete bins
      if (conversationIds.length > 0) {
        console.log('\n  Deleting timing bins...');
        const { error: binError } = await supabase
          .from('contact_timing_bins')
          .delete()
          .eq('user_id', userId)
          .in('conversation_id', conversationIds);

        if (binError) {
          console.log(`    ❌ Error: ${binError.message}`);
        } else {
          console.log(`    ✅ Deleted ${summary.bins} bins`);
        }
      }

      // 2. Delete recommendations
      if (conversationIds.length > 0) {
        console.log('\n  Deleting recommendations...');
        const { error: recError } = await supabase
          .from('contact_timing_recommendations')
          .delete()
          .eq('user_id', userId)
          .in('conversation_id', conversationIds);

        if (recError) {
          console.log(`    ❌ Error: ${recError.message}`);
        } else {
          console.log(`    ✅ Deleted ${summary.recommendations} recommendations`);
        }
      }

      // 3. Delete events
      console.log('\n  Deleting interaction events...');
      const { error: eventError } = await supabase
        .from('contact_interaction_events')
        .delete()
        .eq('user_id', userId)
        .eq('metadata->>test', 'true');

      // Also delete by conversation_id
      if (conversationIds.length > 0) {
        await supabase
          .from('contact_interaction_events')
          .delete()
          .eq('user_id', userId)
          .in('conversation_id', conversationIds);
      }

      if (eventError) {
        console.log(`    ❌ Error: ${eventError.message}`);
      } else {
        console.log(`    ✅ Deleted ${summary.events} events`);
      }

      // 4. Delete conversations
      if (conversationIds.length > 0) {
        console.log('\n  Deleting test conversations...');
        const { error: convError } = await supabase
          .from('messenger_conversations')
          .delete()
          .eq('user_id', userId)
          .in('id', conversationIds);

        if (convError) {
          console.log(`    ❌ Error: ${convError.message}`);
        } else {
          console.log(`    ✅ Deleted ${conversationIds.length} conversations`);
          summary.conversations = conversationIds.length;
        }
      }

      // 5. Reset segment priors (optional - recreate on next computation)
      console.log('\n  Note: Segment priors will be rebuilt on next computation');
    }

    // ================================================================
    // VERIFY CLEANUP
    // ================================================================
    if (!dryRun) {
      console.log('\n\n✓ STEP 6: Verify Cleanup');
      console.log('-'.repeat(80));

      const { count: remainingConvs } = await supabase
        .from('messenger_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .like('sender_id', 'TEST_%');

      const { count: remainingEvents } = await supabase
        .from('contact_interaction_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('metadata->>test', 'true');

      console.log(`\n  Remaining test conversations: ${remainingConvs || 0}`);
      console.log(`  Remaining test events: ${remainingEvents || 0}`);

      const cleanupComplete = (remainingConvs || 0) === 0 && (remainingEvents || 0) === 0;
      
      if (cleanupComplete) {
        console.log(`\n  ✅ Cleanup complete - all test data removed`);
      } else {
        console.log(`\n  ⚠️  Some test data may remain`);
      }
    }

    // ================================================================
    // SUMMARY
    // ================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n${dryRun ? 'Would delete' : 'Deleted'}:`);
    console.log(`  - Conversations: ${summary.conversations}`);
    console.log(`  - Events: ${summary.events}`);
    console.log(`  - Timing bins: ${summary.bins}`);
    console.log(`  - Recommendations: ${summary.recommendations}`);

    if (dryRun) {
      console.log(`\n💡 Run without --dry-run to actually delete`);
    } else {
      console.log(`\n✅ Test data cleanup complete!`);
    }

    console.log('\n');

    return { success: true, summary };
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// CLI execution
if (require.main === module) {
  const userId = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!userId) {
    console.error('Usage: ts-node scripts/cleanup-test-data.ts <user_id> [--dry-run]');
    console.error('\nExamples:');
    console.error('  ts-node scripts/cleanup-test-data.ts "uuid-here" --dry-run  # Preview only');
    console.error('  ts-node scripts/cleanup-test-data.ts "uuid-here"            # Actually delete');
    process.exit(1);
  }

  cleanupTestData(userId, dryRun)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Cleanup execution failed:', error);
      process.exit(1);
    });
}

export { cleanupTestData };

