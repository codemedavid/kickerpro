'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  RefreshCw, 
  AlertCircle, 
  User, 
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  Key,
  Ban
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';

interface FailedRecipient {
  recipient_id: string;
  recipient_name: string | null;
  last_error_message: string;
  last_error_type: string;
  attempt_count: number;
}

interface FailedRecipientsData {
  failed_recipients: FailedRecipient[];
  retryable_count: number;
  error_type_counts: Record<string, number>;
  stats: {
    sent: number;
    failed: number;
    total: number;
  };
  max_retry_attempts: number;
}

interface FailedRecipientsDialogProps {
  messageId: string;
  messageTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FailedRecipientsDialog({
  messageId,
  messageTitle,
  open,
  onOpenChange,
}: FailedRecipientsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedErrorTypes, setSelectedErrorTypes] = useState<string[]>([]);

  // Fetch failed recipients
  const { data, isLoading, refetch } = useQuery<FailedRecipientsData>({
    queryKey: ['failed-recipients', messageId],
    queryFn: async () => {
      const response = await fetch(`/api/messages/${messageId}/failed-recipients`);
      if (!response.ok) {
        throw new Error('Failed to fetch failed recipients');
      }
      return response.json();
    },
    enabled: open,
  });

  // Resend mutation
  const resendMutation = useMutation({
    mutationFn: async (payload: {
      recipient_ids?: string[];
      error_types?: string[];
    }) => {
      const response = await fetch(`/api/messages/${messageId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resend');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Retry Started',
        description: `Retrying ${data.recipients_to_retry} failed recipients in ${data.batches.total} batches`,
      });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['failed-recipients', messageId] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Retry Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleResendAll = () => {
    resendMutation.mutate({});
  };

  const handleResendSelected = () => {
    if (selectedRecipients.length === 0 && selectedErrorTypes.length === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select recipients or error types to retry',
        variant: 'destructive',
      });
      return;
    }

    const payload: { recipient_ids?: string[]; error_types?: string[] } = {};
    if (selectedRecipients.length > 0) {
      payload.recipient_ids = selectedRecipients;
    } else if (selectedErrorTypes.length > 0) {
      payload.error_types = selectedErrorTypes;
    }

    resendMutation.mutate(payload);
  };

  const toggleRecipient = (recipientId: string) => {
    setSelectedRecipients(prev =>
      prev.includes(recipientId)
        ? prev.filter(id => id !== recipientId)
        : [...prev, recipientId]
    );
  };

  const toggleErrorType = (errorType: string) => {
    setSelectedErrorTypes(prev =>
      prev.includes(errorType)
        ? prev.filter(t => t !== errorType)
        : [...prev, errorType]
    );
  };

  const selectAll = () => {
    if (!data) return;
    setSelectedRecipients(data.failed_recipients.map(r => r.recipient_id));
  };

  const deselectAll = () => {
    setSelectedRecipients([]);
    setSelectedErrorTypes([]);
  };

  const getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'access_token':
        return <Key className="h-4 w-4 text-orange-500" />;
      case 'rate_limit':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'network':
        return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'invalid_recipient':
        return <Ban className="h-4 w-4 text-red-500" />;
      case 'permission':
        return <XCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getErrorTypeLabel = (errorType: string) => {
    switch (errorType) {
      case 'access_token':
        return 'Access Token Error';
      case 'rate_limit':
        return 'Rate Limit';
      case 'network':
        return 'Network Error';
      case 'invalid_recipient':
        return 'Invalid Recipient';
      case 'permission':
        return 'Permission Error';
      default:
        return 'Other Error';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Failed Recipients - {messageTitle}
          </DialogTitle>
          <DialogDescription>
            View and retry failed message deliveries
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : data ? (
          <div className="flex-1 space-y-4 overflow-hidden flex flex-col">
            {/* Stats Summary */}
            <Card className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{data.stats.sent}</div>
                  <div className="text-xs text-muted-foreground">Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{data.stats.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{data.retryable_count}</div>
                  <div className="text-xs text-muted-foreground">Retryable</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{data.stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>
            </Card>

            {/* Error Type Filter */}
            {data.error_type_counts && Object.keys(data.error_type_counts).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Filter by Error Type:</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.error_type_counts).map(([type, count]) => (
                    <Button
                      key={type}
                      size="sm"
                      variant={selectedErrorTypes.includes(type) ? 'default' : 'outline'}
                      onClick={() => toggleErrorType(type)}
                      className="gap-2"
                    >
                      {getErrorIcon(type)}
                      {getErrorTypeLabel(type)} ({count})
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Failed Recipients List */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Failed Recipients ({data.failed_recipients.length})
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={selectAll}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={deselectAll}
                >
                  Clear
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-4 space-y-2">
                {data.failed_recipients.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No retryable failed recipients</p>
                    <p className="text-xs mt-1">
                      All recipients either received the message or exceeded max retry attempts
                    </p>
                  </div>
                ) : (
                  data.failed_recipients.map((recipient) => (
                    <div
                      key={recipient.recipient_id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        selectedRecipients.includes(recipient.recipient_id)
                          ? 'bg-accent border-primary'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedRecipients.includes(recipient.recipient_id)}
                        onCheckedChange={() => toggleRecipient(recipient.recipient_id)}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {recipient.recipient_name || 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({recipient.recipient_id.substring(0, 12)}...)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getErrorIcon(recipient.last_error_type)}
                          <span className="text-sm text-muted-foreground">
                            {getErrorTypeLabel(recipient.last_error_type)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {recipient.attempt_count} attempt{recipient.attempt_count > 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {recipient.last_error_message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : null}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={resendMutation.isPending}
          >
            Close
          </Button>
          {data && data.retryable_count > 0 && (
            <>
              {(selectedRecipients.length > 0 || selectedErrorTypes.length > 0) && (
                <Button
                  onClick={handleResendSelected}
                  disabled={resendMutation.isPending}
                  className="gap-2"
                >
                  {resendMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Retry Selected (
                      {selectedRecipients.length > 0
                        ? selectedRecipients.length
                        : `${selectedErrorTypes.length} type${selectedErrorTypes.length > 1 ? 's' : ''}`}
                      )
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={handleResendAll}
                disabled={resendMutation.isPending}
                className="gap-2"
              >
                {resendMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Retry All ({data.retryable_count})
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

