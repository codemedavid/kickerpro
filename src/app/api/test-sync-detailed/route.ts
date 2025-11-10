import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFacebookAuthUser, hasFacebookToken } from '@/lib/facebook/auth-helper';

/**
 * DIAGNOSTIC ENDPOINT: Test Facebook sync in detail
 * GET /api/test-sync-detailed?pageId=xxx&facebookPageId=xxx
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const diagnostics = {
    timestamp: new Date().toISOString(),
    tests: [] as Array<{ test: string; status: string; details: unknown }>,
    issues: [] as string[],
    recommendations: [] as string[]
  };

  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const facebookPageId = searchParams.get('facebookPageId');

    if (!pageId || !facebookPageId) {
      return NextResponse.json({
        error: 'Required: pageId and facebookPageId query parameters'
      }, { status: 400 });
    }

    // Test 1: Authentication
    const user = await getFacebookAuthUser();
    diagnostics.tests.push({
      test: 'Authentication',
      status: user && await hasFacebookToken(user) ? '✅' : '❌',
      details: { hasUser: !!user, hasToken: user ? await hasFacebookToken(user) : false }
    });

    if (!user || !(await hasFacebookToken(user))) {
      diagnostics.issues.push('Not authenticated or missing Facebook token');
      return NextResponse.json(diagnostics);
    }

    // Test 2: Database Page Access
    const supabase = await createClient();
    const { data: page, error: pageError } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('id', pageId)
      .single();

    diagnostics.tests.push({
      test: 'Database Page Access',
      status: !pageError && page ? '✅' : '❌',
      details: {
        found: !!page,
        hasToken: !!page?.access_token,
        lastSynced: page?.last_synced_at,
        pageIdMatches: page?.facebook_page_id === facebookPageId
      }
    });

    if (pageError || !page) {
      diagnostics.issues.push('Page not found in database');
      return NextResponse.json(diagnostics);
    }

    // Test 3: Facebook API Connection (Small Query)
    try {
      const testUrl = `https://graph.facebook.com/v18.0/${page.facebook_page_id}/conversations?limit=5&access_token=${page.access_token}`;
      const testResponse = await fetch(testUrl);
      const testData = await testResponse.json();

      diagnostics.tests.push({
        test: 'Facebook API Connection',
        status: !testData.error ? '✅' : '❌',
        details: {
          statusCode: testResponse.status,
          hasData: !!testData.data,
          conversationCount: testData.data?.length || 0,
          hasNext: !!testData.paging?.next,
          error: testData.error
        }
      });

      if (testData.error) {
        diagnostics.issues.push(`Facebook API error: ${testData.error.message}`);
      }
    } catch (error) {
      diagnostics.tests.push({
        test: 'Facebook API Connection',
        status: '❌',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      diagnostics.issues.push('Failed to connect to Facebook API');
    }

    // Test 4: Pagination Chain Test (Follow 5 pages)
    try {
      let nextUrl = `https://graph.facebook.com/v18.0/${page.facebook_page_id}/conversations?limit=100&access_token=${page.access_token}`;
      let pageCount = 0;
      let totalFetched = 0;
      const maxPages = 5;

      while (nextUrl && pageCount < maxPages) {
        const response = await fetch(nextUrl);
        const data = await response.json();
        
        if (data.error) break;
        
        pageCount++;
        totalFetched += data.data?.length || 0;
        nextUrl = data.paging?.next || null;
      }

      diagnostics.tests.push({
        test: 'Pagination Chain (5 pages)',
        status: pageCount > 0 ? '✅' : '❌',
        details: {
          pagesFetched: pageCount,
          conversationsFetched: totalFetched,
          hasMore: !!nextUrl,
          estimatedTotal: pageCount < maxPages ? totalFetched : `${totalFetched}+ (more pages exist)`
        }
      });

      if (pageCount >= maxPages && nextUrl) {
        diagnostics.recommendations.push(`You have MORE than ${totalFetched} conversations. Use forceFull=true to get all.`);
      }
    } catch (error) {
      diagnostics.tests.push({
        test: 'Pagination Chain',
        status: '❌',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }

    // Test 5: Participant Data Quality
    try {
      const testUrl = `https://graph.facebook.com/v18.0/${page.facebook_page_id}/conversations?fields=participants&limit=10&access_token=${page.access_token}`;
      const testResponse = await fetch(testUrl);
      const testData = await testResponse.json();

      const participantAnalysis = (testData.data || []).map((conv: { participants?: { data?: Array<{ id: string; name?: string }> } }) => {
        const participants = conv.participants?.data || [];
        return {
          totalParticipants: participants.length,
          validParticipants: participants.filter((p: { id: string }) => p.id !== page.facebook_page_id).length,
          hasPageAsParticipant: participants.some((p: { id: string }) => p.id === page.facebook_page_id)
        };
      });

      const skippedConversations = participantAnalysis.filter((a: { validParticipants: number }) => a.validParticipants === 0).length;

      diagnostics.tests.push({
        test: 'Participant Data Quality',
        status: '✅',
        details: {
          conversationsChecked: participantAnalysis.length,
          conversationsWithOnlyPage: skippedConversations,
          percentageSkipped: ((skippedConversations / participantAnalysis.length) * 100).toFixed(1) + '%',
          sampleAnalysis: participantAnalysis.slice(0, 3)
        }
      });

      if (skippedConversations > 0) {
        diagnostics.recommendations.push(`${skippedConversations}/${participantAnalysis.length} conversations have only the page as participant and will be skipped (this is normal)`);
      }
    } catch (error) {
      diagnostics.tests.push({
        test: 'Participant Data Quality',
        status: '⚠️',
        details: { error: error instanceof Error ? error.message : 'Could not test' }
      });
    }

    // Test 6: Database Conversation Count
    const { count: dbCount } = await supabase
      .from('messenger_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('page_id', page.facebook_page_id);

    diagnostics.tests.push({
      test: 'Database Conversation Count',
      status: '✅',
      details: {
        conversationsInDatabase: dbCount || 0,
        pageId: page.facebook_page_id,
        lastSynced: page.last_synced_at
      }
    });

    // Test 7: Sync Mode Detection
    const syncMode = page.last_synced_at ? 'incremental' : 'full';
    diagnostics.tests.push({
      test: 'Sync Mode Detection',
      status: syncMode === 'incremental' ? '⚠️' : '✅',
      details: {
        mode: syncMode,
        lastSyncedAt: page.last_synced_at,
        willUseSinceParameter: !!page.last_synced_at,
        sinceTimestamp: page.last_synced_at ? Math.floor(new Date(page.last_synced_at).getTime() / 1000) : null
      }
    });

    if (syncMode === 'incremental') {
      diagnostics.issues.push('Using INCREMENTAL sync - will only fetch conversations updated since ' + page.last_synced_at);
      diagnostics.recommendations.push('Use forceFull=true to fetch ALL conversations, not just recent ones');
    }

    // Test 8: Unique Constraint Check
    const { data: duplicates } = await supabase
      .from('messenger_conversations')
      .select('page_id, sender_id')
      .eq('page_id', page.facebook_page_id);

    const senderIds = (duplicates || []).map(d => d.sender_id);
    const uniqueSenders = new Set(senderIds);
    const hasDuplicates = senderIds.length !== uniqueSenders.size;

    diagnostics.tests.push({
      test: 'Database Constraint Check',
      status: !hasDuplicates ? '✅' : '⚠️',
      details: {
        totalRows: senderIds.length,
        uniqueSenders: uniqueSenders.size,
        hasDuplicates,
        duplicateCount: senderIds.length - uniqueSenders.size
      }
    });

    if (hasDuplicates) {
      diagnostics.recommendations.push('Some duplicate conversations exist - upsert should handle this');
    }

    // Generate summary
    const passedTests = diagnostics.tests.filter(t => t.status === '✅').length;
    const failedTests = diagnostics.tests.filter(t => t.status === '❌').length;
    const warningTests = diagnostics.tests.filter(t => t.status === '⚠️').length;

    const summary = {
      testsRun: diagnostics.tests.length,
      passed: passedTests,
      failed: failedTests,
      warnings: warningTests,
      overallStatus: failedTests > 0 ? '❌ ISSUES FOUND' : warningTests > 0 ? '⚠️ WARNINGS' : '✅ ALL GOOD',
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
    };

    return NextResponse.json({
      summary,
      diagnostics,
      nextSteps: diagnostics.recommendations.length > 0 
        ? diagnostics.recommendations 
        : ['All tests passed! Run sync with forceFull=true to get all conversations.']
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Diagnostic failed',
      diagnostics
    }, { status: 500 });
  }
}

