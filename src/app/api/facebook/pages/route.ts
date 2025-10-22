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

    console.log('[Facebook Pages API] Fetching pages from Facebook Graph API...');

    // Call Facebook Graph API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,category,access_token,picture{url},fan_count&access_token=${accessToken}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Facebook Pages API] Facebook API error:', error);
      throw new Error(error.error?.message || 'Failed to fetch pages from Facebook');
    }

    const data: FacebookResponse = await response.json();

    if (data.error) {
      console.error('[Facebook Pages API] Facebook returned error:', data.error);
      throw new Error(data.error.message);
    }

    const pages = data.data || [];
    console.log('[Facebook Pages API] Fetched', pages.length, 'pages from Facebook');

    return NextResponse.json({
      success: true,
      pages,
      count: pages.length
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

