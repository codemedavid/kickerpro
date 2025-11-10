'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  Send, 
  Calendar, 
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  X,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO } from 'date-fns';
import { FailedRecipientsDialog } from '@/components/messages/FailedRecipientsDialog';

interface SentMessage {
  id: string;
  title: string;
  content: string;
  page_id: string;
  recipient_type: 'all' | 'active' | 'selected';
  recipient_count: number;
  status: 'sent' | 'failed' | 'sending' | 'cancelled' | 'partially_sent';
  sent_at: string | null;
  delivered_count: number;
  message_tag: string | null;
  selected_recipients: string[] | null;
  error_message: string | null;
  created_at: string;
}

interface FacebookPage {
  id: string;
  name: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedPageId, setSelectedPageId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [failedRecipientsDialogOpen, setFailedRecipientsDialogOpen] = useState(false);
  const [selectedMessageForRetry, setSelectedMessageForRetry] = useState<{
    id: string;
    title: string;
  } | null>(null);

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

  // Fetch sent/failed messages
  const { data: messages = [], isLoading, refetch } = useQuery<SentMessage[]>({
    queryKey: ['sent-messages', user?.id, selectedPageId, selectedStatus],
    queryFn: async () => {
      // const params = new URLSearchParams();
      
      if (selectedStatus === 'all') {
        // Fetch both sent and failed
        const [sentRes, failedRes, sendingRes] = await Promise.all([
          fetch('/api/messages?status=sent'),
          fetch('/api/messages?status=failed'),
          fetch('/api/messages?status=sending')
        ]);
        
        const sent = await sentRes.json();
        const failed = await failedRes.json();
        const sending = await sendingRes.json();
        
        return [
          ...(sent.messages || []),
          ...(failed.messages || []),
          ...(sending.messages || [])
        ].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else {
        const response = await fetch(`/api/messages?status=${selectedStatus}`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        const data = await response.json();
        return data.messages || [];
      }
    },
    enabled: !!user?.id,
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/messages/${messageId}/cancel`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel message');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    }
  });

  // Filter by page
  const filteredMessages = selectedPageId === 'all' 
    ? messages 
    : messages.filter(m => m.page_id === selectedPageId);

  const getPageName = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    return page?.name || 'Unknown Page';
  };

  const getStatusBadge = (status: string, messageId: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-600">Sent</Badge>;
      case 'failed':
        return <Badge className="bg-red-600">Failed</Badge>;
      case 'sending':
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-600">Sending...</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancelMutation.mutate(messageId)}
              disabled={cancelMutation.isPending}
              className="h-6 px-2 text-xs"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  Cancelling...
                </>
              ) : (
                <>
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </>
              )}
            </Button>
          </div>
        );
      case 'cancelled':
        return <Badge className="bg-orange-600">Cancelled</Badge>;
      case 'partially_sent':
        return <Badge className="bg-yellow-600">Partially Sent</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSuccessRate = (message: SentMessage) => {
    if (message.recipient_count === 0) return 0;
    return Math.round((message.delivered_count / message.recipient_count) * 100);
  };

  const totalSent = filteredMessages.filter(m => m.status === 'sent').length;
  const totalFailed = filteredMessages.filter(m => m.status === 'failed').length;
  const totalRecipients = filteredMessages.reduce((sum, m) => sum + (m.delivered_count || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Message History</h1>
          <p className="text-muted-foreground mt-1">
            View all sent and failed messages
          </p>
        </div>
        <Button 
          onClick={() => refetch()}
          variant="outline"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages Sent</p>
                <p className="text-3xl font-bold mt-2">{totalSent}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-3xl font-bold mt-2">{totalFailed}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Delivered</p>
                <p className="text-3xl font-bold mt-2">{totalRecipients.toLocaleString()}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="page-filter">Facebook Page</Label>
              <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                <SelectTrigger id="page-filter" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pages</SelectItem>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger id="status-filter" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="sending">Sending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <CardTitle>Message History ({filteredMessages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-12">
              <Send className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Messages Found</h3>
              <p className="text-muted-foreground mb-6">
                {selectedStatus !== 'all' || selectedPageId !== 'all'
                  ? 'Try adjusting your filters'
                  : 'You haven\'t sent any messages yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMessages.map((message) => {
                const successRate = getSuccessRate(message);
                
                return (
                  <div
                    key={message.id}
                    className="p-4 rounded-lg border shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{message.title}</h3>
                          {getStatusBadge(message.status, message.id)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {message.content.substring(0, 150)}
                          {message.content.length > 150 && '...'}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {getPageName(message.page_id)}
                          </span>
                          {message.sent_at && (
                            <Badge variant="outline">
                              Sent {format(parseISO(message.sent_at), 'MMM dd, HH:mm')}
                            </Badge>
                          )}
                          {message.status === 'sent' && (
                            <>
                              <Badge className="bg-green-100 text-green-700">
                                {message.delivered_count}/{message.recipient_count} delivered
                              </Badge>
                              <Badge variant="secondary">
                                {successRate}% success rate
                              </Badge>
                            </>
                          )}
                          {message.status === 'failed' && message.error_message && (
                            <Badge className="bg-red-100 text-red-700">
                              Error: {message.error_message}
                            </Badge>
                          )}
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
                        {(message.status === 'failed' || message.status === 'partially_sent' || 
                          (message.status === 'sent' && message.delivered_count < message.recipient_count)) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedMessageForRetry({
                                id: message.id,
                                title: message.title
                              });
                              setFailedRecipientsDialogOpen(true);
                            }}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            View Failed & Retry
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/messages/${message.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
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

      {/* Failed Recipients Dialog */}
      {selectedMessageForRetry && (
        <FailedRecipientsDialog
          messageId={selectedMessageForRetry.id}
          messageTitle={selectedMessageForRetry.title}
          open={failedRecipientsDialogOpen}
          onOpenChange={setFailedRecipientsDialogOpen}
        />
      )}
    </div>
  );
}

