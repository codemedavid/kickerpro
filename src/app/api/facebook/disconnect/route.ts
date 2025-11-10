/**
 * Disconnect Facebook Account
 * Removes Facebook token and pages from database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
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

    // Remove Facebook token from user
    const { error: updateError } = await supabase
      .from('users')
      .update({
        facebook_access_token: null,
        facebook_token_expires_at: null,
        facebook_token_updated_at: null,
      })
      .eq('id', authUser.id);

    if (updateError) {
      console.error('Error removing token:', updateError);
      throw updateError;
    }

    // Delete all associated Facebook pages
    const { error: deleteError } = await supabase
      .from('facebook_pages')
      .delete()
      .eq('user_id', authUser.id);

    if (deleteError) {
      console.error('Error deleting pages:', deleteError);
      // Don't throw - token removal is more important
    }

    return NextResponse.json({
      message: 'Facebook account disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to disconnect Facebook account';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

