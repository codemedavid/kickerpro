/**
 * Facebook OAuth Configuration
 * Centralized configuration for Facebook Graph API and OAuth
 */

export const FACEBOOK_CONFIG = {
  // OAuth endpoints
  OAUTH_URL: 'https://www.facebook.com/v19.0/dialog/oauth',
  TOKEN_URL: 'https://graph.facebook.com/v19.0/oauth/access_token',
  GRAPH_API_URL: 'https://graph.facebook.com/v19.0',
  
  // App credentials (from environment)
  APP_ID: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
  APP_SECRET: process.env.FACEBOOK_APP_SECRET!,
  
  // OAuth redirect URI (adjust based on environment)
  REDIRECT_URI: process.env.NEXT_PUBLIC_BASE_URL 
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/facebook/callback`
    : 'http://localhost:3000/api/auth/facebook/callback',
  
  // Required permissions for bulk messaging
  SCOPES: [
    'email',
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_manage_metadata',
    'pages_messaging',
    'pages_manage_ads',
    'business_management',
  ],
  
  // Token expiry (long-lived tokens last ~60 days)
  LONG_LIVED_TOKEN_DAYS: 60,
} as const;

/**
 * Validate that all required environment variables are set
 */
export function validateFacebookConfig() {
  const missing: string[] = [];
  
  if (!FACEBOOK_CONFIG.APP_ID) missing.push('NEXT_PUBLIC_FACEBOOK_APP_ID');
  if (!FACEBOOK_CONFIG.APP_SECRET) missing.push('FACEBOOK_APP_SECRET');
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required Facebook environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Generate Facebook OAuth URL
 */
export function generateFacebookOAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: FACEBOOK_CONFIG.APP_ID,
    redirect_uri: FACEBOOK_CONFIG.REDIRECT_URI,
    scope: FACEBOOK_CONFIG.SCOPES.join(','),
    response_type: 'code',
    state: state || '',
  });
  
  return `${FACEBOOK_CONFIG.OAUTH_URL}?${params.toString()}`;
}

