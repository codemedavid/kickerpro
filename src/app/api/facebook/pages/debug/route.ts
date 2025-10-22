import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Debug endpoint to test Facebook pages pagination
 * Visit: /api/facebook/pages/debug
 */

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('fb-access-token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated. Please login first.' },
        { status: 401 }
      );
    }

    console.log('[DEBUG] Testing Facebook pages API pagination...');
    console.log('[DEBUG] Access token:', accessToken.substring(0, 20) + '...');

    const debugInfo = {
      access_token_preview: accessToken.substring(0, 20) + '...',
      batches: [] as any[],
      total_pages: 0,
      errors: [] as any[]
    };

    // Test first request
    const firstUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,category,access_token,picture,fan_count&limit=100&access_token=${accessToken}`;
    
    console.log('[DEBUG] First request URL:', firstUrl.substring(0, 100) + '...');

    try {
      const response = await fetch(firstUrl);
      const data = await response.json();

      console.log('[DEBUG] Response status:', response.status);
      console.log('[DEBUG] Response OK:', response.ok);
      
      if (data.error) {
        debugInfo.errors.push({
          batch: 1,
          error: data.error
        });
        console.error('[DEBUG] Facebook error:', data.error);
      } else {
        const batchInfo = {
          batch_number: 1,
          pages_in_batch: data.data?.length || 0,
          has_next: !!data.paging?.next,
          next_cursor: data.paging?.next?.split('after=')[1]?.substring(0, 30) || null,
          sample_page_names: data.data?.slice(0, 5).map((p: any) => p.name) || []
        };
        
        debugInfo.batches.push(batchInfo);
        debugInfo.total_pages = data.data?.length || 0;
        
        console.log('[DEBUG] Batch 1:', batchInfo);

        // Try to fetch second batch if there's a next URL
        if (data.paging?.next) {
          console.log('[DEBUG] Attempting to fetch batch 2...');
          
          const secondResponse = await fetch(data.paging.next);
          const secondData = await secondResponse.json();

          if (secondData.error) {
            debugInfo.errors.push({
              batch: 2,
              error: secondData.error
            });
            console.error('[DEBUG] Batch 2 error:', secondData.error);
          } else {
            const batch2Info = {
              batch_number: 2,
              pages_in_batch: secondData.data?.length || 0,
              has_next: !!secondData.paging?.next,
              next_cursor: secondData.paging?.next?.split('after=')[1]?.substring(0, 30) || null,
              sample_page_names: secondData.data?.slice(0, 5).map((p: any) => p.name) || []
            };
            
            debugInfo.batches.push(batch2Info);
            debugInfo.total_pages += secondData.data?.length || 0;
            
            console.log('[DEBUG] Batch 2:', batch2Info);
          }
        }
      }
    } catch (fetchError) {
      debugInfo.errors.push({
        batch: 1,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError)
      });
      console.error('[DEBUG] Fetch error:', fetchError);
    }

    return NextResponse.json({
      success: debugInfo.errors.length === 0,
      message: `Found ${debugInfo.total_pages} total pages in ${debugInfo.batches.length} batch(es)`,
      debug: debugInfo,
      recommendation: debugInfo.total_pages === 50 
        ? '⚠️ Getting exactly 50 might indicate a limit is being applied. Check Facebook app permissions.'
        : debugInfo.total_pages < 100 && debugInfo.batches[0]?.has_next
        ? '⚠️ There are more pages but pagination might not be working correctly.'
        : '✅ Pagination appears to be working correctly.'
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Debug failed',
        message: 'Check server logs for details'
      },
      { status: 500 }
    );
  }
}

