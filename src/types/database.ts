export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          facebook_id: string;
          name: string;
          email: string | null;
          profile_picture: string | null;
          role: 'admin' | 'manager' | 'editor' | 'member';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          facebook_id: string;
          name: string;
          email?: string | null;
          profile_picture?: string | null;
          role?: 'admin' | 'manager' | 'editor' | 'member';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          facebook_id?: string;
          name?: string;
          email?: string | null;
          profile_picture?: string | null;
          role?: 'admin' | 'manager' | 'editor' | 'member';
          created_at?: string;
          updated_at?: string;
        };
      };
      facebook_pages: {
        Row: {
          id: string;
          facebook_page_id: string;
          user_id: string;
          name: string;
          category: string | null;
          profile_picture: string | null;
          follower_count: number | null;
          access_token: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          facebook_page_id: string;
          user_id: string;
          name: string;
          category?: string | null;
          profile_picture?: string | null;
          follower_count?: number | null;
          access_token: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          facebook_page_id?: string;
          user_id?: string;
          name?: string;
          category?: string | null;
          profile_picture?: string | null;
          follower_count?: number | null;
          access_token?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          title: string;
          content: string;
          page_id: string;
          created_by: string;
          recipient_type: 'all' | 'active';
          recipient_count: number;
          status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
          scheduled_for: string | null;
          sent_at: string | null;
          delivered_count: number;
          opened_count: number;
          clicked_count: number;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          page_id: string;
          created_by: string;
          recipient_type: 'all' | 'active';
          recipient_count?: number;
          status?: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
          scheduled_for?: string | null;
          sent_at?: string | null;
          delivered_count?: number;
          opened_count?: number;
          clicked_count?: number;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          page_id?: string;
          created_by?: string;
          recipient_type?: 'all' | 'active';
          recipient_count?: number;
          status?: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
          scheduled_for?: string | null;
          sent_at?: string | null;
          delivered_count?: number;
          opened_count?: number;
          clicked_count?: number;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messenger_conversations: {
        Row: {
          id: string;
          user_id: string;
          page_id: string;
          sender_id: string;
          sender_name: string | null;
          last_message: string | null;
          last_message_time: string;
          conversation_status: 'active' | 'inactive' | 'blocked';
          message_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          page_id: string;
          sender_id: string;
          sender_name?: string | null;
          last_message?: string | null;
          last_message_time: string;
          conversation_status?: 'active' | 'inactive' | 'blocked';
          message_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          page_id?: string;
          sender_id?: string;
          sender_name?: string | null;
          last_message?: string | null;
          last_message_time?: string;
          conversation_status?: 'active' | 'inactive' | 'blocked';
          message_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_members: {
        Row: {
          id: string;
          user_id: string;
          role: 'admin' | 'manager' | 'editor' | 'member';
          permissions: string[];
          invited_by: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'admin' | 'manager' | 'editor' | 'member';
          permissions?: string[];
          invited_by?: string | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'admin' | 'manager' | 'editor' | 'member';
          permissions?: string[];
          invited_by?: string | null;
          joined_at?: string;
        };
      };
      message_activity: {
        Row: {
          id: string;
          message_id: string;
          activity_type: 'created' | 'scheduled' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          activity_type: 'created' | 'scheduled' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          activity_type?: 'created' | 'scheduled' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
          description?: string;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

