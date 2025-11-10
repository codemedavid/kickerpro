import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUserId } from '@/lib/auth/cookies';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = getAuthenticatedUserId(cookieStore);
    
    if (!userId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const supabase = await createClient();
    
    // Get connected pages
    const { data: pages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('user_id', userId);

    if (pagesError || !pages || pages.length === 0) {
      return NextResponse.json({
        error: 'No pages connected',
        hint: 'Connect pages first at /dashboard/pages'
      }, { status: 400 });
    }

    const results = [];

    // Test each page's conversations endpoint
    for (const page of pages.slice(0, 3)) { // Test first 3 pages
      const testResult: any = {
        pageName: page.name,
        pageId: page.facebook_page_id,
        hasToken: !!page.access_token
      };

      try {
        // Test Facebook Graph API for conversations
        const url = `https://graph.facebook.com/v18.0/${page.facebook_page_id}/conversations?fields=participants,updated_time&limit=5&access_token=${page.access_token}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
          testResult.status = '❌ Error';
          testResult.error = data.error.message;
          testResult.errorCode = data.error.code;
        } else {
          testResult.status = '✅ OK';
          testResult.conversationsFound = data.data?.length || 0;
          testResult.hasMore = !!data.paging?.next;
          
          // Get details of first conversation
          if (data.data && data.data.length > 0) {
            const firstConv = data.data[0];
            testResult.sampleConversation = {
              id: firstConv.id,
              participants: firstConv.participants?.data?.length || 0,
              updatedTime: firstConv.updated_time
            };
          }
        }
      } catch (e: any) {
        testResult.status = '❌ Exception';
        testResult.error = e.message;
      }

      results.push(testResult);
    }

    return NextResponse.json({
      userId,
      connectedPages: pages.length,
      testResults: results,
      summary: results.every(r => r.status === '✅ OK') 
        ? '✅ All pages can fetch conversations!' 
        : '❌ Some pages have issues'
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Test failed'
    }, { status: 500 });
  }
}






