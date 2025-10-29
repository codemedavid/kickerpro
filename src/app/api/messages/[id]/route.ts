import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get message details
    const { data: message, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('created_by', userId)
      .single();

    if (error || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...message
    });
  } catch (error) {
    console.error('[Message API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('fb-auth-user')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status, scheduled_for, title, content, recipient_type, selected_recipients, message_tag } = body || {};

    const updateData: Record<string, unknown> = {};
    if (typeof status === 'string') updateData.status = status;
    if (scheduled_for === null || typeof scheduled_for === 'string') updateData.scheduled_for = scheduled_for;
    if (typeof title === 'string') updateData.title = title;
    if (typeof content === 'string') updateData.content = content;
    if (typeof recipient_type === 'string') updateData.recipient_type = recipient_type;
    if (Array.isArray(selected_recipients)) updateData.selected_recipients = selected_recipients;
    if (typeof message_tag === 'string' || message_tag === null) updateData.message_tag = message_tag;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Ensure the message belongs to the user
    const { data: existing, error: fetchError } = await supabase
      .from('messages')
      .select('id')
      .eq('id', messageId)
      .eq('created_by', userId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId)
      .eq('created_by', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: data });
  } catch (error) {
    console.error('[Message API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}