interface FacebookPage {
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

interface FacebookPagesResponse {
  data: FacebookPage[];
  error?: {
    message: string;
  };
}

export async function fetchUserPages(): Promise<FacebookPage[]> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.FB) {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }

    console.log('[Facebook SDK] Fetching user pages...');

    window.FB.api(
      '/me/accounts',
      { 
        fields: 'id,name,category,access_token,picture,fan_count'
      },
      (response: FacebookPagesResponse) => {
        console.log('[Facebook SDK] Pages response:', response);

        if (response.error) {
          console.error('[Facebook SDK] Error fetching pages:', response.error);
          reject(new Error(response.error.message || 'Failed to fetch pages'));
          return;
        }

        resolve(response.data || []);
      }
    );
  });
}

export function isSDKLoaded(): boolean {
  return typeof window !== 'undefined' && !!window.FB;
}
