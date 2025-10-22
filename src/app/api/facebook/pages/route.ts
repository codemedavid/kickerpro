import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface FacebookPageData {
  id: string;
  name: string;
  category?: string;
  access_token: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
  fan_count?: number;
}

interface FacebookResponse {
  data?: FacebookPageData[];
  error?: {
    message: string;
    code?: number;
  };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('fb-access-token')?.value;
    const userId = cookieStore.get('fb-auth-user')?.value;

    console.log('[Facebook Pages API] Cookie check:', {
      hasAccessToken: !!accessToken,
      hasUserId: !!userId,
      tokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : 'none'
    });

    if (!accessToken) {
      console.error('[Facebook Pages API] No access token found in cookies');
      console.error('[Facebook Pages API] Available cookies:', cookieStore.getAll().map(c => c.name));
      
      return NextResponse.json(
        { 
          error: 'Not authenticated with Facebook',
          hint: 'Please logout and login again to refresh your access token'
        },
        { status: 401 }
      );
    }

    console.log('[Facebook Pages API] Fetching ALL pages from Facebook Graph API...');
    console.log('[Facebook Pages API] Using access token:', accessToken.substring(0, 20) + '...');

    // Fetch ALL pages using pagination (Facebook returns max 100 per request)
    let allPages: FacebookPageData[] = [];
    let nextUrl: string | null = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,category,access_token,picture{url},fan_count&limit=100&access_token=${accessToken}`;
    let batchCount = 0;
    const maxBatches = 100; // Safety limit to prevent infinite loops

    while (nextUrl && batchCount < maxBatches) {
      batchCount++;
      console.log(`[Facebook Pages API] Fetching batch ${batchCount}... URL:`, nextUrl.substring(0, 100) + '...');

      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[Facebook Pages API] Facebook API error:', error);
        throw new Error(error.error?.message || 'Failed to fetch pages from Facebook');
      }

      const data: FacebookResponse & { paging?: { next?: string } } = await response.json();

      if (data.error) {
        console.error('[Facebook Pages API] Facebook returned error:', data.error);
        throw new Error(data.error.message);
      }

      // Add pages from this batch
      if (data.data && data.data.length > 0) {
        allPages = allPages.concat(data.data);
        console.log(`[Facebook Pages API] ✅ Got ${data.data.length} pages in batch ${batchCount}. Total so far: ${allPages.length}`);
      } else {
        console.log(`[Facebook Pages API] ⚠️ Batch ${batchCount} returned 0 pages`);
      }

      // Check if there's a next page
      nextUrl = data.paging?.next || null;
      
      if (nextUrl) {
        console.log('[Facebook Pages API] 📄 More pages available, fetching next batch...');
        console.log('[Facebook Pages API] Next URL cursor:', nextUrl.split('after=')[1]?.substring(0, 20) || 'unknown');
      } else {
        console.log('[Facebook Pages API] ✓ No more pages to fetch');
      }
    }

    console.log(`[Facebook Pages API] 🎉 Fetched ALL ${allPages.length} pages from Facebook in ${batchCount} batch(es)`);
    
    if (allPages.length === 0) {
      console.error('[Facebook Pages API] ⚠️ WARNING: No pages fetched! You may not have admin access to any pages.');
    }

    return NextResponse.json({
      success: true,
      pages: allPages,
      count: allPages.length
    });
  } catch (error) {
    console.error('[Facebook Pages API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Facebook pages';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false
      },
      { status: 500 }
    );
  }
}

