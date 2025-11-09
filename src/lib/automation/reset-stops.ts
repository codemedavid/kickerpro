/**
 * Helper to reset automation stops when trigger tags are re-added
 * This allows automations to restart when user manually adds tags back
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Reset automation stops for conversations that have been re-tagged with trigger tags
 * 
 * @param conversationIds - Array of conversation IDs that were tagged
 * @param tagIds - Array of tag IDs that were added
 */
export async function resetAutomationStopsForTags(
  conversationIds: string[],
  tagIds: string[]
): Promise<void> {
  try {
    // Use admin client to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.warn('[Reset Stops] Missing Supabase credentials');
      return;
    }

    const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log(`[Reset Stops] 🔄 Checking for automation resets...`);
    console.log(`[Reset Stops]    Conversations: ${conversationIds.length}`);
    console.log(`[Reset Stops]    Tags: ${tagIds.length}`);

    // Find automation rules that use these tags as trigger tags
    const { data: rules, error: rulesError } = await supabase
      .from('ai_automation_rules')
      .select('id, name, include_tag_ids')
      .eq('enabled', true)
      .not('include_tag_ids', 'is', null);

    if (rulesError) {
      console.error('[Reset Stops] Error fetching rules:', rulesError);
      return;
    }

    if (!rules || rules.length === 0) {
      console.log('[Reset Stops] ℹ️  No automation rules with trigger tags found');
      return;
    }

    console.log(`[Reset Stops] 📋 Checking ${rules.length} automation rule(s)`);

    let totalResetsCount = 0;

    // Check each rule
    for (const rule of rules) {
      const includeTagIds = rule.include_tag_ids as string[];
      
      if (!includeTagIds || includeTagIds.length === 0) {
        continue;
      }

      // Check if any of the added tags match this rule's trigger tags
      const matchingTags = tagIds.filter(tagId => includeTagIds.includes(tagId));

      if (matchingTags.length === 0) {
        continue; // No matching trigger tags for this rule
      }

      console.log(`[Reset Stops]    Rule: "${rule.name}"`);
      console.log(`[Reset Stops]       Matching tags: ${matchingTags.length}`);

      // Delete stop records for these conversations + this rule
      const { data: deletedStops, error: deleteError } = await supabase
        .from('ai_automation_stops')
        .delete()
        .eq('rule_id', rule.id)
        .in('conversation_id', conversationIds)
        .select('conversation_id, stopped_reason');

      if (deleteError) {
        console.error(`[Reset Stops]       ❌ Error resetting stops:`, deleteError);
        continue;
      }

      if (deletedStops && deletedStops.length > 0) {
        totalResetsCount += deletedStops.length;
        console.log(`[Reset Stops]       ✅ Reset ${deletedStops.length} stopped automation(s)`);
        
        deletedStops.forEach((stop) => {
          console.log(`[Reset Stops]          • Conversation: ${stop.conversation_id.substring(0, 8)}... (was: ${stop.stopped_reason})`);
        });
      }
    }

    if (totalResetsCount > 0) {
      console.log(`[Reset Stops] 🎉 Successfully reset ${totalResetsCount} automation(s) - they can now restart!`);
    } else {
      console.log(`[Reset Stops] ℹ️  No automation stops to reset`);
    }

  } catch (error) {
    console.error('[Reset Stops] Unexpected error:', error);
    // Don't throw - this is a best-effort operation
  }
}

