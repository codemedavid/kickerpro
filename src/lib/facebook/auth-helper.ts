/**
 * Facebook Authentication Helper
 * Provides unified authentication for Facebook-related endpoints
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export interface AuthenticatedUser {
  id: string;
  facebook_access_token: string | null;
  facebook_token_expires_at: string | null;
}

/**
 * Get authenticated user for Facebook operations
 * Uses cookie-based authentication (fb-user-id)
 * Falls back to Supabase auth if cookie not found
 */
export async function getFacebookAuthUser(): Promise<AuthenticatedUser> {
  const supabase = await createClient();
  const cookieStore = await cookies();
  
  // Try cookie-based auth first (primary method for Facebook SDK login)
  const userId = cookieStore.get('fb-user-id')?.value;
  
  if (userId) {
    // Fetch user from database using cookie ID
    const { data: user, error } = await supabase
      .from('users')
      .select('id, facebook_access_token, facebook_token_expires_at')
      .eq('id', userId)
      .single();
    
    if (!error && user) {
      return user;
    }
  }
  
  // Fallback to Supabase auth (for OAuth flow)
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) {
    throw new Error('Not authenticated');
  }
  
  // Fetch user's Facebook token from database
  const { data: user, error } = await supabase
    .from('users')
    .select('id, facebook_access_token, facebook_token_expires_at')
    .eq('id', authUser.id)
    .single();
  
  if (error || !user) {
    throw new Error('User not found');
  }
  
  return user;
}

/**
 * Check if user has valid Facebook token
 */
export async function hasFacebookToken(user: AuthenticatedUser): Promise<boolean> {
  if (!user.facebook_access_token) {
    return false;
  }
  
  // Check if token is expired
  if (user.facebook_token_expires_at) {
    const expiresAt = new Date(user.facebook_token_expires_at);
    if (expiresAt <= new Date()) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get user ID from cookies (for webhook and background jobs)
 */
export async function getUserIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('fb-user-id')?.value || null;
}

