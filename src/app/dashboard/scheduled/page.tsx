'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  Clock, 
  Trash2, 
  Send,
  Eye,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO, isPast } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ScheduledMessage {
  id: string;
  title: string;
  content: string;
  page_id: string;
  recipient_type: 'all' | 'active' | 'selected';
  recipient_count: number;
  scheduled_for: string;
  message_tag: string | null;
  selected_recipients: string[] | null;
  created_at: string;
}

interface FacebookPage {
  id: string;
  name: string;
  facebook_page_id: string;
}

export default function ScheduledMessagesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [sendNowDialogOpen, setSendNowDialogOpen] = useState(false);
  const [messageToSendNow, setMessageToSendNow] = useState<string | null>(null);

  // Fetch pages
  const { data: pages = [] } = useQuery<FacebookPage[]>({
    queryKey: ['pages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pages');
      if (!response.ok) throw new Error('Failed to fetch pages');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch scheduled messages
  // Auto-refresh every 30 seconds to show latest status
  // Actual sending is handled by server-side cron job (/api/cron/send-scheduled)
  const { data: messages = [], isLoading } = useQuery<ScheduledMessage[]>({
    queryKey: ['scheduled-messages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/messages?status=scheduled');
      if (!response.ok) throw new Error('Failed to fetch scheduled messages');
      const data = await response.json();
      return data.messages || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000 // Refresh every 30 seconds to show updated status
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast({
        title: "Message Deleted",
        description: "Scheduled message has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Send now mutation
  const sendNowMutation = useMutation({
    mutationFn: async (messageId: string) => {
      // Update status to 'sent' and trigger send
      const updateResponse = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent', scheduled_for: null })
      });
      
      if (!updateResponse.ok) throw new Error('Failed to update message');

      // Trigger direct send (bypasses batch system)
      const sendResponse = await fetch(`/api/messages/${messageId}/send-now`, {
        method: 'GET'
      });
      
      if (!sendResponse.ok) throw new Error('Failed to send message');
      return sendResponse.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      toast({
        title: "Message Sent!",
        description: `Successfully sent to ${data.sent} recipients. ${data.failed > 0 ? `${data.failed} failed.` : ''}`,
        duration: 5000
      });
      setSendNowDialogOpen(false);
      setMessageToSendNow(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  });

  const getPageName = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    return page?.name || 'Unknown Page';
  };

  const handleDelete = (messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  };

  const handleSendNow = (messageId: string) => {
    setMessageToSendNow(messageId);
    setSendNowDialogOpen(true);
  };

  const confirmDelete = () => {
    if (messageToDelete) {
      deleteMutation.mutate(messageToDelete);
    }
  };

  const confirmSendNow = () => {
    if (messageToSendNow) {
      sendNowMutation.mutate(messageToSendNow);
    }
  };

  // Separate messages into past due and upcoming
  const now = new Date();
  const pastDueMessages = messages.filter(m => isPast(parseISO(m.scheduled_for)));
  const upcomingMessages = messages.filter(m => !isPast(parseISO(m.scheduled_for)));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Messages</h1>
          <p className="text-muted-foreground mt-1">
            Manage messages scheduled to be sent later
          </p>
          <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Auto-send active - checking every 30 seconds
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={async () => {
              console.log('[Manual Check] Forcing dispatch check...');
              try {
                const response = await fetch('/api/messages/scheduled/dispatch', { method: 'POST' });
                const result = await response.json();
                console.log('[Manual Check] Result:', result);
                
                if (response.ok) {
                  if (result.dispatched > 0) {
                    toast({
                      title: "✅ Messages Sent!",
                      description: `Sent ${result.dispatched} message(s) to Facebook`,
                      duration: 5000
                    });
                    queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
                  } else {
                    toast({
                      title: "No Messages Due",
                      description: "No scheduled messages are ready to send yet",
                      variant: "default"
                    });
                  }
                } else {
                  toast({
                    title: "Error",
                    description: result.error || 'Failed to check messages',
                    variant: "destructive"
                  });
                }
              } catch (error) {
                console.error('[Manual Check] Error:', error);
                toast({
                  title: "Error",
                  description: 'Failed to check for due messages',
                  variant: "destructive"
                });
              }
            }}
            variant="outline"
            className="border-green-500 text-green-700 hover:bg-green-50"
          >
            <Send className="w-4 h-4 mr-2" />
            Check & Send Due Messages
          </Button>
          <Button 
            onClick={() => router.push('/dashboard/compose')}
            className="bg-[#1877f2] hover:bg-[#166fe5]"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Schedule New Message
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Scheduled</p>
                <p className="text-3xl font-bold mt-2">{messages.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-3xl font-bold mt-2">{upcomingMessages.length}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Past Due</p>
                <p className="text-3xl font-bold mt-2">{pastDueMessages.length}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Past Due Messages */}
      {pastDueMessages.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900">
              ⚠️ Past Due Messages ({pastDueMessages.length})
            </CardTitle>
            <CardDescription className="text-orange-700">
              These messages were scheduled for the past. Send them now or delete them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pastDueMessages.map((message) => (
                <div
                  key={message.id}
                  className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{message.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {message.content.substring(0, 100)}
                        {message.content.length > 100 && '...'}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {getPageName(message.page_id)}
                        </span>
                        <Badge variant="outline" className="bg-orange-100 text-orange-700">
                          Was: {format(parseISO(message.scheduled_for), 'MMM dd, yyyy HH:mm')}
                        </Badge>
                        <Badge variant="secondary">
                          {message.recipient_count} recipients
                        </Badge>
                        {message.message_tag && (
                          <Badge variant="default">
                            {message.message_tag}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSendNow(message.id)}
                        disabled={sendNowMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Send Now
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(message.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Messages */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Scheduled Messages ({upcomingMessages.length})</CardTitle>
          <CardDescription>
            Messages that will be sent automatically at their scheduled time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : upcomingMessages.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Scheduled Messages</h3>
              <p className="text-muted-foreground mb-6">
                You don&apos;t have any messages scheduled for the future.
              </p>
              <Button 
                onClick={() => router.push('/dashboard/compose')}
                className="bg-[#1877f2] hover:bg-[#166fe5]"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Schedule a Message
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMessages.map((message) => {
                const scheduledDate = parseISO(message.scheduled_for);
                const timeUntil = Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60)); // minutes

                return (
                  <div
                    key={message.id}
                    className="p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{message.title}</h3>
                          {timeUntil < 60 && (
                            <Badge className="bg-orange-500">
                              Sending in {timeUntil} min
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {message.content.substring(0, 150)}
                          {message.content.length > 150 && '...'}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {getPageName(message.page_id)}
                          </span>
                          <Badge variant="outline" className="bg-blue-50">
                            <Clock className="w-3 h-3 mr-1" />
                            {format(scheduledDate, 'MMM dd, yyyy HH:mm')}
                          </Badge>
                          <Badge variant="secondary">
                            {message.recipient_type === 'selected' 
                              ? `${message.recipient_count} selected`
                              : message.recipient_type === 'all'
                              ? `${message.recipient_count} followers`
                              : `~${message.recipient_count} active`}
                          </Badge>
                          {message.message_tag && (
                            <Badge variant="default" className="bg-purple-600">
                              {message.message_tag.replace('_', ' ')}
                            </Badge>
                          )}
                          {message.selected_recipients && message.selected_recipients.length > 100 && (
                            <Badge variant="outline">
                              {Math.ceil(message.selected_recipients.length / 100)} batches
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/messages/${message.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendNow(message.id)}
                          disabled={sendNowMutation.isPending}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(message.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Message?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The scheduled message will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Now Confirmation Dialog */}
      <AlertDialog open={sendNowDialogOpen} onOpenChange={setSendNowDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Message Now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the message immediately instead of waiting for the scheduled time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSendNow}
              className="bg-[#1877f2] hover:bg-[#166fe5]"
            >
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

