/**
 * Refresh Facebook Token
 * Checks if token is expiring soon and refreshes it
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  exchangeForLongLivedToken,
  calculateTokenExpiry,
  isTokenExpiringSoon,
  debugToken,
} from '@/lib/facebook/token-manager';

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current authenticated user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's current token from database
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('facebook_access_token, facebook_token_expires_at')
      .eq('id', authUser.id)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.facebook_access_token) {
      return NextResponse.json(
        { error: 'No Facebook token found. Please connect your Facebook account.' },
        { status: 400 }
      );
    }

    // Check if token needs refresh
    const expiresAt = user.facebook_token_expires_at 
      ? new Date(user.facebook_token_expires_at)
      : null;

    if (!expiresAt || !isTokenExpiringSoon(expiresAt)) {
      return NextResponse.json({
        message: 'Token is still valid',
        expires_at: expiresAt,
        needs_refresh: false,
      });
    }

    // Verify current token is still valid
    try {
      const tokenInfo = await debugToken(user.facebook_access_token);
      
      if (!tokenInfo.data.is_valid) {
        return NextResponse.json(
          { 
            error: 'Token is invalid. Please reconnect your Facebook account.',
            needs_reconnect: true,
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { 
          error: 'Failed to verify token. Please reconnect your Facebook account.',
          needs_reconnect: true,
        },
        { status: 400 }
      );
    }

    // Exchange for new long-lived token
    const newToken = await exchangeForLongLivedToken(user.facebook_access_token);
    const newExpiresAt = calculateTokenExpiry(newToken.expires_in);

    // Update token in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        facebook_access_token: newToken.access_token,
        facebook_token_expires_at: newExpiresAt.toISOString(),
        facebook_token_updated_at: new Date().toISOString(),
      })
      .eq('id', authUser.id);

    if (updateError) {
      console.error('Error updating token:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      message: 'Token refreshed successfully',
      expires_at: newExpiresAt,
      needs_refresh: false,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to refresh token';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
