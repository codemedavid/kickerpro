'use client';

import { useQuery } from '@tanstack/react-query';
import { 
  MessageSquare, 
  Send, 
  Calendar, 
  Facebook,
  TrendingUp,
  Users,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { FacebookConnectionCard } from '@/components/facebook/facebook-connection-card';

interface Stats {
  messagesSent: number;
  delivered: number;
  scheduled: number;
  connectedPages: number;
}

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['stats', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user');

      const [messagesRes, pagesRes] = await Promise.all([
        supabase.from('messages').select('*').eq('created_by', user.id),
        supabase.from('facebook_pages').select('*').eq('user_id', user.id)
      ]);

      const messages = messagesRes.data || [];
      const pages = pagesRes.data || [];

      return {
        messagesSent: messages.filter((m: { status: string }) => m.status === 'sent').length,
        delivered: messages.reduce((sum: number, m: { delivered_count?: number }) => sum + (m.delivered_count || 0), 0),
        scheduled: messages.filter((m: { status: string }) => m.status === 'scheduled').length,
        connectedPages: pages.length
      };
    },
    enabled: !!user?.id,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ['activities', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user');

      const { data, error } = await supabase
        .from('message_activity')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const statsCards = [
    {
      title: 'Messages Sent',
      value: stats?.messagesSent || 0,
      icon: Send,
      color: 'bg-blue-500',
      description: 'Total campaigns sent'
    },
    {
      title: 'Total Delivered',
      value: stats?.delivered || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      description: 'Successfully delivered'
    },
    {
      title: 'Scheduled',
      value: stats?.scheduled || 0,
      icon: Clock,
      color: 'bg-orange-500',
      description: 'Pending messages'
    },
    {
      title: 'Connected Pages',
      value: stats?.connectedPages || 0,
      icon: Facebook,
      color: 'bg-[#1877f2]',
      description: 'Active pages'
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sent':
        return <Send className="w-4 h-4" />;
      case 'scheduled':
        return <Calendar className="w-4 h-4" />;
      case 'created':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <TrendingUp className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'sent':
        return 'bg-green-100 text-green-700';
      case 'scheduled':
        return 'bg-orange-100 text-orange-700';
      case 'created':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name}!</h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your Facebook messaging campaigns
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-[#1877f2] hover:bg-[#166fe5]">
          <Link href="/dashboard/compose">
            <MessageSquare className="mr-2 w-4 h-4" />
            Compose New Message
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/pages">
            <Facebook className="mr-2 w-4 h-4" />
            Connect Page
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/scheduled">
            <Calendar className="mr-2 w-4 h-4" />
            View Scheduled
          </Link>
        </Button>
      </div>

      {/* Facebook Connection */}
      <FacebookConnectionCard />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          statsCards.map((card, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-3xl font-bold mt-2">{card.value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                  </div>
                  <div className={`${card.color} p-3 rounded-lg`}>
                    <card.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest messaging activities</CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No activity yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start by sending your first message
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors">
                    <div className={`p-2 rounded-lg ${getActivityColor(activity.activity_type)}`}>
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(activity.created_at), 'MMM dd, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Tips</CardTitle>
            <CardDescription>Get the most out of your messaging campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="bg-blue-500 p-2 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">Personalize Your Messages</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use {'{first_name}'} and {'{last_name}'} tags to personalize messages
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <div className="bg-green-500 p-2 rounded-lg">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">Schedule for Best Times</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Send messages when your audience is most active
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                <div className="bg-purple-500 p-2 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">Track Your Performance</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Monitor delivery and open rates to improve campaigns
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                <div className="bg-orange-500 p-2 rounded-lg">
                  <Facebook className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">24-Hour Policy</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only message users who contacted you within 24 hours
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

