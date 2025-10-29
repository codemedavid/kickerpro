import { createClient } from '@/lib/supabase/server';

export interface SendResult {
  recipient_id: string;
  success: boolean;
  message_id?: string;
  error?: string;
}

export async function sendFacebookMessage(
  pageId: string,
  recipientId: string,
  messageText: string,
  accessToken: string,
  messageTag?: string | null
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v18.0/me/messages`;

    const postData: {
      recipient: { id: string };
      message: { text: string };
      access_token: string;
      messaging_type?: string;
      tag?: string;
    } = {
      recipient: { id: recipientId },
      message: { text: messageText },
      access_token: accessToken
    };

    if (messageTag) {
      postData.messaging_type = 'MESSAGE_TAG';
      postData.tag = messageTag;
      console.log('[Send Helpers] Sending with tag:', messageTag, 'recipient:', recipientId.substring(0, 10) + '...');
    } else {
      console.log('[Send Helpers] Sending without tag recipient:', recipientId.substring(0, 10) + '...');
    }

    console.log('[Send Helpers] Facebook API request:', {
      url,
      recipient: recipientId.substring(0, 12) + '...',
      messageLength: messageText.length,
      hasTag: !!messageTag,
      tag: messageTag || 'none'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });

    console.log('[Send Helpers] Facebook API response status:', response.status);

    const data = await response.json();
    console.log('[Send Helpers] Facebook API response data:', {
      success: response.ok,
      message_id: data.message_id || 'none',
      error: data.error || 'none',
      error_code: data.error?.code || 'none',
      error_subcode: data.error?.error_subcode || 'none'
    });

    if (response.ok && data.message_id) {
      console.log('[Send Helpers] ✅ Message sent successfully:', {
        recipient: recipientId.substring(0, 12) + '...',
        message_id: data.message_id
      });
      return { success: true, message_id: data.message_id };
    }

    console.error('[Send Helpers] ❌ Facebook error:', data.error);

    if (data.error?.code === 190) {
      console.error('[Send Helpers] 🔄 TOKEN EXPIRED ERROR');
      return {
        success: false,
        error: '🔄 TOKEN_EXPIRED: Your Facebook session has expired. Please logout and login again to refresh your access token.'
      };
    }

    if (data.error?.code === 10 && data.error?.error_subcode === 2018278) {
      console.error('[Send Helpers] ⏰ 24-HOUR POLICY ERROR');
      return {
        success: false,
        error: '⏰ 24-HOUR_POLICY: Message tag rejected. Make sure your Facebook app has permission to use ACCOUNT_UPDATE tag.'
      };
    }

    console.error('[Send Helpers] ❌ Generic Facebook error:', data.error?.message || 'Unknown error');
    return {
      success: false,
      error: data.error?.message || 'Failed to send'
    };
  } catch (error) {
    console.error('[Send Helpers] ❌ Network error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

export async function getPersonalizedContentFromConversations(
  content: string,
  recipientId: string,
  messageId: string
): Promise<string> {
  try {
    console.log('[Send Helpers] Starting personalization for recipient:', recipientId.substring(0, 12) + '...');
    
    if (!content.includes('{first_name}') && !content.includes('{last_name}')) {
      console.log('[Send Helpers] No placeholders found, returning original content');
      return content;
    }

    console.log('[Send Helpers] Placeholders detected, fetching user data...');
    const userData = await getUserDataFromConversations(recipientId, messageId);

    if (!userData) {
      console.log('[Send Helpers] No personalization data found for', recipientId.substring(0, 10) + '...');
      return content;
    }

    console.log('[Send Helpers] User data found:', {
      recipient: recipientId.substring(0, 12) + '...',
      first_name: userData.first_name || 'none',
      last_name: userData.last_name || 'none'
    });

    let personalizedContent = content;

    if (userData.first_name) {
      personalizedContent = personalizedContent.replace(/\{first_name\}/g, userData.first_name);
      console.log('[Send Helpers] Replaced {first_name} with:', userData.first_name);
    }

    if (userData.last_name) {
      personalizedContent = personalizedContent.replace(/\{last_name\}/g, userData.last_name);
      console.log('[Send Helpers] Replaced {last_name} with:', userData.last_name);
    }

    console.log('[Send Helpers] ✅ Personalization complete for', recipientId.substring(0, 10) + '...');
    return personalizedContent;
  } catch (error) {
    console.error('[Send Helpers] ❌ Personalization error:', error);
    return content;
  }
}

export async function getUserDataFromConversations(
  recipientId: string,
  messageId: string
): Promise<{ first_name?: string; last_name?: string } | null> {
  try {
    const supabase = await createClient();

    const { data: message } = await supabase
      .from('messages')
      .select('selected_contacts_data, page_id')
      .eq('id', messageId)
      .single();

    if (!message) {
      console.log('[Send Helpers] Message not found for personalization', messageId);
      return null;
    }

    if (message.selected_contacts_data && Array.isArray(message.selected_contacts_data)) {
      const contactData = message.selected_contacts_data.find(
        (contact: { sender_id: string; sender_name: string | null }) => contact.sender_id === recipientId
      );

      if (contactData && contactData.sender_name && contactData.sender_name !== 'Facebook User') {
        return parseName(contactData.sender_name);
      }
    }

    const { data: conversation, error } = await supabase
      .from('messenger_conversations')
      .select('sender_name')
      .eq('sender_id', recipientId)
      .eq('page_id', message.page_id)
      .single();

    if (error) {
      console.log('[Send Helpers] Conversation lookup error:', error);
      return null;
    }

    if (!conversation?.sender_name || conversation.sender_name === 'Facebook User' || conversation.sender_name.trim() === '') {
      return null;
    }

    return parseName(conversation.sender_name);
  } catch (error) {
    console.error('[Send Helpers] Failed to lookup personalization data:', error);
    return null;
  }
}

export function parseName(fullName: string): { first_name?: string; last_name?: string } | null {
  const nameParts = fullName.trim().split(' ');

  if (nameParts.length === 0) {
    return null;
  }

  if (nameParts.length === 1) {
    return { first_name: nameParts[0] };
  }

  return {
    first_name: nameParts[0],
    last_name: nameParts.slice(1).join(' ')
  };
}
