/**
 * Facebook Token Manager
 * Handles token exchange, refresh, and validation
 */

import { FACEBOOK_CONFIG } from './config';

interface TokenExchangeResult {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface DebugTokenData {
  data: {
    app_id: string;
    type: string;
    application: string;
    data_access_expires_at: number;
    expires_at: number;
    is_valid: boolean;
    scopes: string[];
    user_id: string;
  };
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  picture?: {
    data: {
      url: string;
    };
  };
  followers_count?: number;
}

/**
 * Exchange authorization code for short-lived access token
 */
export async function exchangeCodeForToken(
  code: string
): Promise<TokenExchangeResult> {
  const url = new URL(FACEBOOK_CONFIG.TOKEN_URL);
  url.searchParams.set('client_id', FACEBOOK_CONFIG.APP_ID);
  url.searchParams.set('client_secret', FACEBOOK_CONFIG.APP_SECRET);
  url.searchParams.set('redirect_uri', FACEBOOK_CONFIG.REDIRECT_URI);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to exchange code: ${data.error?.message || 'Unknown error'}`
    );
  }

  return data;
}

/**
 * Exchange short-lived token for long-lived token (~60 days)
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<TokenExchangeResult> {
  const url = new URL(FACEBOOK_CONFIG.TOKEN_URL);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', FACEBOOK_CONFIG.APP_ID);
  url.searchParams.set('client_secret', FACEBOOK_CONFIG.APP_SECRET);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to exchange for long-lived token: ${data.error?.message || 'Unknown error'}`
    );
  }

  return data;
}

/**
 * Verify and get token information
 */
export async function debugToken(
  inputToken: string
): Promise<DebugTokenData> {
  const appAccessToken = `${FACEBOOK_CONFIG.APP_ID}|${FACEBOOK_CONFIG.APP_SECRET}`;
  const url = new URL(`${FACEBOOK_CONFIG.GRAPH_API_URL}/debug_token`);
  url.searchParams.set('input_token', inputToken);
  url.searchParams.set('access_token', appAccessToken);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to debug token: ${data.error?.message || 'Unknown error'}`
    );
  }

  return data;
}

/**
 * Get user's Facebook profile information
 */
export async function getUserProfile(accessToken: string) {
  const url = new URL(`${FACEBOOK_CONFIG.GRAPH_API_URL}/me`);
  url.searchParams.set('fields', 'id,name,email,picture');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to get user profile: ${data.error?.message || 'Unknown error'}`
    );
  }

  return data;
}

/**
 * Get user's Facebook Pages with access tokens
 */
export async function getUserPages(
  accessToken: string
): Promise<{ data: FacebookPage[] }> {
  const url = new URL(`${FACEBOOK_CONFIG.GRAPH_API_URL}/me/accounts`);
  url.searchParams.set('fields', 'id,name,access_token,category,picture,followers_count');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to get user pages: ${data.error?.message || 'Unknown error'}`
    );
  }

  return data;
}

/**
 * Calculate token expiry date
 */
export function calculateTokenExpiry(expiresIn?: number): Date {
  const now = new Date();
  
  if (expiresIn) {
    // Use provided expiry time (in seconds)
    return new Date(now.getTime() + expiresIn * 1000);
  }
  
  // Default to 60 days for long-lived tokens
  return new Date(now.getTime() + FACEBOOK_CONFIG.LONG_LIVED_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Check if token is expired or about to expire (within 7 days)
 */
export function isTokenExpiringSoon(expiresAt: Date): boolean {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return new Date(expiresAt) <= sevenDaysFromNow;
}

