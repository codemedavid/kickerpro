'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Send, ArrowLeft, Calendar, Users, Eye, X, Loader2, AlertCircle, XCircle, Upload, Image as ImageIcon, Video, File, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { uploadFilesDirectly } from '@/lib/supabase/client-upload';

interface FacebookPage {
  id: string;
  name: string;
  profile_picture: string | null;
  follower_count: number | null;
}

interface SelectedContact {
  sender_id: string;
  sender_name: string | null;
}

interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  is_reusable?: boolean;
  filename?: string;
  size?: number;
}

export default function ComposePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    pageId: '',
    recipientType: 'all' as 'all' | 'active' | 'selected',
    messageType: 'immediate' as 'immediate' | 'scheduled' | 'draft',
    scheduleDate: '',
    scheduleTime: '',
    messageTag: 'none' as 'none' | 'ACCOUNT_UPDATE' | 'CONFIRMED_EVENT_UPDATE' | 'POST_PURCHASE_UPDATE' | 'HUMAN_AGENT',
    autoTagId: 'none'
  });

  const [selectedContacts, setSelectedContacts] = useState<SelectedContact[]>([]);
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sendingProgress, setSendingProgress] = useState<{
    isOpen: boolean;
    messageId: string | null;
    sent: number;
    failed: number;
    total: number;
    totalBatches: number;
    batches: Array<{
      batchNumber: number;
      status: string;
      sent: number;
      failed: number;
      total: number;
    }>;
    status: 'sending' | 'completed' | 'cancelled' | 'error';
    lastUpdatedAt: string | null;
    failureReasons: string[];
    errorMessage: string | null;
  }>({
    isOpen: false,
    messageId: null,
    sent: 0,
    failed: 0,
    total: 0,
    totalBatches: 0,
    batches: [],
    status: 'sending',
    lastUpdatedAt: null,
    failureReasons: [],
    errorMessage: null
  });
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const batchProcessingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load selected contacts from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('selectedContacts');
    if (stored) {
      try {
        const data = JSON.parse(stored) as { 
          contacts: Array<{ sender_id: string; sender_name: string | null }>;
          pageId?: string;
        };
        
        if (data.contacts && data.contacts.length > 0) {
          setSelectedContacts(data.contacts.map(c => ({
            sender_id: c.sender_id,
            sender_name: c.sender_name
          })));
          
          // Auto-select the page if specified
          if (data.pageId) {
            setFormData(prev => ({ ...prev, pageId: data.pageId as string, recipientType: 'selected' }));
          } else {
            setFormData(prev => ({ ...prev, recipientType: 'selected' }));
          }
          
          toast({
            title: "Contacts Loaded",
            description: `${data.contacts.length} contact(s) ready to message`
          });
          
          // Clear from sessionStorage
          sessionStorage.removeItem('selectedContacts');
        }
      } catch (e) {
        console.error('Error loading selected contacts:', e);
      }
    }
    // Run only on mount - intentional state initialization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: pages = [], isLoading: pagesLoading } = useQuery<FacebookPage[]>({
    queryKey: ['pages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pages');
      if (!response.ok) throw new Error('Failed to fetch pages');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch user's tags
  const { data: tags = [] } = useQuery<{
    id: string;
    name: string;
    color: string;
  }[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags');
      if (!response.ok) throw new Error('Failed to fetch tags');
      const data = await response.json();
      return data.tags || [];
    },
    enabled: !!user?.id
  });

  const startPolling = useCallback((messageId: string) => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }

    const poll = async () => {
      try {
        const response = await fetch(`/api/messages/${messageId}/batches`);
        if (!response.ok) throw new Error('Failed to fetch batch status');

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch batch data');
        }

        const { summary } = data;

        const mappedBatches = Array.isArray(data.batches)
          ? data.batches.map((batch: { batch_number: number; status: string; sent_count?: number; failed_count?: number; recipient_count: number }) => ({
              batchNumber: batch.batch_number,
              status: batch.status,
              sent: batch.sent_count || 0,
              failed: batch.failed_count || 0,
              total: batch.recipient_count || 0
            }))
          : [];

        const sentCount = summary?.sent || 0;
        const failedCount = summary?.failed_messages || 0;
        const totalCount = summary?.total_recipients || 0;
        const totalBatches = summary?.total_batches || mappedBatches.length || 0;
        const pendingBatches = summary?.pending || 0;
        const processingBatches = summary?.processing || 0;
        const failedBatches = summary?.failed_batches || 0;
        const cancelledBatches = summary?.cancelled_batches || 0;
        const messageStatus = typeof data.messageStatus === 'string' ? data.messageStatus.toLowerCase() : null;
        const batchFailureMessages: string[] = Array.isArray(summary?.failure_messages)
          ? summary.failure_messages.filter((msg: unknown): msg is string => typeof msg === 'string' && msg.trim().length > 0)
          : [];
        const messageError = typeof data.messageError === 'string' ? data.messageError : null;

        console.log('[Polling] Batch status update:', {
          total_batches: totalBatches,
          completed: summary?.completed || 0,
          processing: processingBatches,
          pending: pendingBatches,
          failed_batches: failedBatches,
          cancelled_batches: cancelledBatches,
          sent: sentCount,
          failed: failedCount,
          total: totalCount,
          message_status: messageStatus
        });

        const allBatchesHandled = totalBatches > 0 && pendingBatches === 0 && processingBatches === 0;
        const hasFailures = (summary?.failed_messages || 0) > 0 || batchFailureMessages.length > 0;

        let nextStatus: 'sending' | 'completed' | 'cancelled' | 'error' = 'sending';
        if (messageStatus === 'cancelled') {
          nextStatus = 'cancelled';
        } else if (messageStatus === 'failed' || hasFailures) {
          nextStatus = 'error';
        } else if (messageStatus === 'sent' || messageStatus === 'partially_sent' || allBatchesHandled) {
          nextStatus = 'completed';
        }

        const resolvedFailureReasons =
          batchFailureMessages.length > 0
            ? batchFailureMessages
            : messageError
            ? [messageError]
            : [];

        setSendingProgress(prev => ({
          ...prev,
          sent: sentCount,
          failed: failedCount,
          total: totalCount,
          totalBatches,
          batches: mappedBatches,
          status: nextStatus,
          lastUpdatedAt: new Date().toISOString(),
          failureReasons:
            resolvedFailureReasons.length > 0
              ? resolvedFailureReasons
              : nextStatus === 'error'
              ? prev.failureReasons
              : [],
          errorMessage: messageError || (nextStatus === 'error' ? prev.errorMessage : null)
        }));

        if (nextStatus !== 'sending' && pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
      } catch (error) {
        console.error('[Polling] Error:', error);
      }
    };

    pollInterval.current = setInterval(poll, 2000);
    poll();
  }, []);

  const triggerBatchProcessing = useCallback((messageId: string) => {
    const processNextBatch = async () => {
      try {
        const response = await fetch(`/api/messages/${messageId}/batches/process`, {
          method: 'POST'
        });

        if (!response.ok) {
          let errorBody: unknown = null;
          try {
            errorBody = await response.json();
          } catch {
            // Swallow JSON parse errors and log raw status
          }
          console.error('[Compose] Batch processing request failed', response.status, errorBody);
          return;
        }

        const data = await response.json();

        if (data.hasMore) {
          batchProcessingTimeout.current = setTimeout(processNextBatch, 500);
        } else {
          batchProcessingTimeout.current = null;
        }
      } catch (error) {
        console.error('[Compose] Batch processing error:', error);
        if (batchProcessingTimeout.current) {
          clearTimeout(batchProcessingTimeout.current);
          batchProcessingTimeout.current = null;
        }
      }
    };

    if (batchProcessingTimeout.current) {
      clearTimeout(batchProcessingTimeout.current);
      batchProcessingTimeout.current = null;
    }

    processNextBatch();
  }, []);

  const sendMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      page_id: string;
      created_by: string;
      recipient_type: string;
      recipient_count: number;
      status: string;
      scheduled_for: string | null;
      selected_recipients?: string[];
      media_attachments?: MediaAttachment[];
    }) => {
      console.log('[Compose] Submitting message:', data);
      
      // Step 1: Create the message in database
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('[Compose] Response status:', response.status);
      console.log('[Compose] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let error;
        let errorText = '';
        const contentType = response.headers.get('content-type');
        
        console.log('[Compose] Response not OK. Content-Type:', contentType);
        
        try {
          if (contentType && contentType.includes('application/json')) {
            error = await response.json();
            errorText = JSON.stringify(error, null, 2);
          } else {
            errorText = await response.text();
            error = { error: errorText || `HTTP ${response.status}` };
          }
        } catch (parseError) {
          console.error('[Compose] Error parsing response:', parseError);
          errorText = 'Failed to parse error response';
          error = { error: errorText };
        }
        
        console.error('[Compose] API error response:', error);
        console.error('[Compose] Full error text:', errorText);
        
        // Check for database constraint error
        if (errorText.includes('messages_recipient_type_check') || 
            errorText.includes('violates check constraint')) {
          throw new Error(
            '⚠️ DATABASE UPDATE REQUIRED!\n\n' +
            'Please run this SQL in Supabase SQL Editor:\n\n' +
            'ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_recipient_type_check;\n' +
            'ALTER TABLE messages ADD CONSTRAINT messages_recipient_type_check CHECK (recipient_type IN (\'all\', \'active\', \'selected\'));\n' +
            'ALTER TABLE messages ADD COLUMN IF NOT EXISTS selected_recipients TEXT[];\n\n' +
            'See database-update.sql for details.'
          );
        }
        
        const errorMessage = error.error || error.details || error.message || errorText || `Failed to create message (HTTP ${response.status})`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[Compose] Message created:', result.message.id);

      // Step 1.5: Create auto-tag if specified
      if (formData.autoTagId && formData.autoTagId !== 'none') {
        try {
          const autoTagResponse = await fetch('/api/message-auto-tags', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message_id: result.message.id,
              tag_id: formData.autoTagId
            }),
          });

          if (autoTagResponse.ok) {
            console.log('[Compose] Auto-tag configured for message:', result.message.id);
          } else {
            console.error('[Compose] Failed to configure auto-tag:', await autoTagResponse.text());
          }
        } catch (error) {
          console.error('[Compose] Auto-tag error:', error);
          // Don't fail the entire operation if auto-tag fails
        }
      }

      // Step 2: If immediate send, trigger the appropriate send API in background and show progress
      if (data.status === 'sent') {
        console.log('[Compose] Triggering immediate send in background...');
        
        // Use enhanced API if media attachments are present
        const hasMedia = data.media_attachments && data.media_attachments.length > 0;
        const apiEndpoint = hasMedia 
          ? `/api/messages/${result.message.id}/send-enhanced`
          : `/api/messages/${result.message.id}/send`;
        
        console.log('[Compose] Using API endpoint:', apiEndpoint);
        
        // Start sending in background (non-blocking)
        fetch(apiEndpoint, {
          method: 'POST'
        }).catch(error => {
          console.error('[Compose] Background send error:', error);
        });
        
        return {
          ...result,
          isImmediateSend: true,
          useEnhanced: hasMedia
        };
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });

      // If immediate send, open progress modal and start polling
      if (data.isImmediateSend) {
        console.log('[Compose] Starting progress tracking for message:', data.message.id);
        
        setSendingProgress({
          isOpen: true,
          messageId: data.message.id,
          sent: 0,
          failed: 0,
          total: data.message.recipient_count || 0,
          totalBatches: 0,
          batches: [],
          status: 'sending',
          lastUpdatedAt: new Date().toISOString(),
          failureReasons: [],
          errorMessage: null
        });
        
        // Start polling for progress
        startPolling(data.message.id);
        if (!data.useEnhanced) {
          triggerBatchProcessing(data.message.id);
        }
        
        // Clear selected contacts and media
        setSelectedContacts([]);
        setMediaAttachments([]);
      } else {
        // For scheduled/draft, show success and redirect
        toast({
          title: "Success!",
          description: formData.messageType === 'scheduled'
            ? "Message scheduled successfully!"
            : "Draft saved successfully!"
        });

        // Clear selected contacts and media
        setSelectedContacts([]);
        setMediaAttachments([]);
        
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    },
    onError: (error: Error) => {
      console.error('[Compose] Mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process message. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      if (batchProcessingTimeout.current) {
        clearTimeout(batchProcessingTimeout.current);
        batchProcessingTimeout.current = null;
      }
    };
  }, []);

  // Media handling functions
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);

      try {
        let result;
        
        // Try server-side upload first
        try {
          const uploadFormData = new FormData();
          Array.from(files).forEach(file => {
            uploadFormData.append('files', file);
          });
          
          if (formData.pageId) {
            uploadFormData.append('pageId', formData.pageId);
          }

          const response = await fetch('/api/upload-supabase', {
            method: 'POST',
            body: uploadFormData
          });

          if (!response.ok) {
            // If 413 error, try direct upload
            if (response.status === 413) {
              console.log('[Compose] Server upload failed with 413, trying direct upload...');
              throw new Error('FILE_TOO_LARGE_FOR_SERVER');
            }
            
            let errorMessage = 'Upload failed';
            try {
              const error = await response.json();
              errorMessage = error.error || 'Upload failed';
             } catch {
              errorMessage = `Upload failed with status ${response.status}`;
            }
            throw new Error(errorMessage);
          }

          result = await response.json();
          console.log('[Compose] Server upload result:', result);
          
         } catch (serverError) {
           // If server upload fails (especially 413), try direct upload
           const errorMessage = serverError instanceof Error ? serverError.message : String(serverError);
           if (errorMessage === 'FILE_TOO_LARGE_FOR_SERVER' || errorMessage.includes('413')) {
            console.log('[Compose] Trying direct Supabase upload...');
            
            if (!user?.id) {
              throw new Error('User not authenticated');
            }
            
            result = await uploadFilesDirectly(Array.from(files), user.id);
            console.log('[Compose] Direct upload result:', result);
          } else {
            throw serverError;
          }
        }

      // Add uploaded files to attachments
      if (result.files && result.files.length > 0) {
         // Filter out files with errors
         const successfulFiles = result.files.filter((file: { error?: string; url?: string }) => !file.error && file.url);
         const failedFiles = result.files.filter((file: { error?: string; url?: string }) => file.error || !file.url);
        
        if (successfulFiles.length > 0) {
          setMediaAttachments(prev => [...prev, ...successfulFiles]);
          
          toast({
            title: "Media Added",
            description: `${successfulFiles.length} file(s) uploaded successfully`
          });
        }
        
        if (failedFiles.length > 0) {
          console.warn('[Compose] Some files failed to upload:', failedFiles);
          toast({
            title: "Upload Warning",
            description: `${failedFiles.length} file(s) failed to upload. Check console for details.`,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to upload media files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeMediaAttachment = (index: number) => {
    setMediaAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <File className="w-4 h-4" />;
      default: return <File className="w-4 h-4" />;
    }
  };


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
      toast({
        title: "Cancelling...",
        description: "Message send is being cancelled. This may take a moment.",
        duration: 3000
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancel Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCancelSend = () => {
    if (sendingProgress.messageId) {
      cancelMutation.mutate(sendingProgress.messageId);
    }
  };

  const handleCloseProgress = useCallback(() => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
    if (batchProcessingTimeout.current) {
      clearTimeout(batchProcessingTimeout.current);
      batchProcessingTimeout.current = null;
    }

    setSendingProgress({
      isOpen: false,
      messageId: null,
      sent: 0,
      failed: 0,
      total: 0,
      totalBatches: 0,
      batches: [],
      status: 'sending',
      lastUpdatedAt: null,
      failureReasons: [],
      errorMessage: null
    });

    router.push('/dashboard');
  }, [router]);

  const selectedPage = pages.find(p => p.id === formData.pageId);
  const totalProcessed = sendingProgress.sent + sendingProgress.failed;
  const pendingCount = Math.max(sendingProgress.total - totalProcessed, 0);
  const progressPercent = sendingProgress.total > 0
    ? Math.min(100, Math.round((totalProcessed / sendingProgress.total) * 100))
    : 0;
  const batchStatusSummary = sendingProgress.batches.reduce(
    (acc, batch) => {
      switch (batch.status) {
        case 'completed':
          acc.completed += 1;
          break;
        case 'failed':
          acc.failed += 1;
          break;
        case 'cancelled':
          acc.cancelled += 1;
          break;
        case 'processing':
          acc.processing += 1;
          break;
        default:
          acc.pending += 1;
      }
      return acc;
    },
    { completed: 0, failed: 0, cancelled: 0, processing: 0, pending: 0 }
  );
  const totalBatchCount = sendingProgress.totalBatches || sendingProgress.batches.length || 0;
  const currentProcessingBatch = sendingProgress.batches.find(batch => batch.status === 'processing');
  const lastUpdatedLabel = sendingProgress.lastUpdatedAt
    ? new Date(sendingProgress.lastUpdatedAt).toLocaleTimeString()
    : null;
  const canManuallyCloseProgress = sendingProgress.status !== 'sending';
  const batchStatusStyles: Record<
    string,
    { label: string; badgeClass: string; rowClassName?: string }
  > = {
    completed: {
      label: 'Completed',
      badgeClass: 'border-green-200 bg-green-50 text-green-700'
    },
    processing: {
      label: 'Processing',
      badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
      rowClassName: 'bg-blue-50/60'
    },
    failed: {
      label: 'Failed',
      badgeClass: 'border-red-200 bg-red-50 text-red-700'
    },
    cancelled: {
      label: 'Cancelled',
      badgeClass: 'border-orange-200 bg-orange-50 text-orange-700'
    },
    pending: {
      label: 'Pending',
      badgeClass: 'border-border bg-muted text-muted-foreground'
    }
  };

  const handleProgressDialogChange = useCallback((open: boolean) => {
    if (open) {
      setSendingProgress(prev => ({ ...prev, isOpen: true }));
      return;
    }

    if (!canManuallyCloseProgress) {
      setSendingProgress(prev => ({ ...prev, isOpen: true }));
      return;
    }

    handleCloseProgress();
  }, [canManuallyCloseProgress, handleCloseProgress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim() || !formData.pageId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    let status = 'draft';
    let scheduledFor = null;

    if (formData.messageType === 'immediate') {
      status = 'sent';
    } else if (formData.messageType === 'scheduled') {
      if (!formData.scheduleDate || !formData.scheduleTime) {
        toast({
          title: "Validation Error",
          description: "Please select a date and time for scheduling.",
          variant: "destructive"
        });
        return;
      }
      status = 'scheduled';
      scheduledFor = new Date(`${formData.scheduleDate}T${formData.scheduleTime}`).toISOString();
    }

    let recipientCount = 0;
    if (formData.recipientType === 'selected') {
      recipientCount = selectedContacts.length;
    } else if (formData.recipientType === 'all') {
      recipientCount = selectedPage?.follower_count || 0;
    } else {
      recipientCount = Math.floor((selectedPage?.follower_count || 0) * 0.7);
    }

    const messageData = {
      title: formData.title,
      content: formData.content,
      page_id: formData.pageId,
      created_by: user?.id || '',
      recipient_type: formData.recipientType,
      recipient_count: recipientCount,
      status,
      scheduled_for: scheduledFor,
      message_tag: formData.messageTag === 'none' ? null : formData.messageTag,
      ...(mediaAttachments.length > 0 && {
        media_attachments: mediaAttachments
      }),
      ...(formData.recipientType === 'selected' && selectedContacts.length > 0 && {
        selected_recipients: selectedContacts.map(c => c.sender_id)
        // selected_contacts_data: selectedContacts.map(c => ({
        //   sender_id: c.sender_id,
        //   sender_name: c.sender_name
        // }))
      })
    };

    console.log('[Compose] Sending message data:', messageData);

    sendMutation.mutate(messageData);
  };

  const getPreviewMessage = () => {
    return formData.content
      .replace(/{first_name}/g, 'Maria')
      .replace(/{last_name}/g, 'Santos');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Compose Bulk Message</h1>
          <p className="text-muted-foreground">
            Create and send messages to your Facebook page followers
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Page Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Facebook Page</CardTitle>
            <CardDescription>Choose which page to send the message from</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={formData.pageId} onValueChange={(value) => setFormData({ ...formData, pageId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a page..." />
              </SelectTrigger>
              <SelectContent>
                {pagesLoading ? (
                  <SelectItem value="loading" disabled>Loading pages...</SelectItem>
                ) : pages.length === 0 ? (
                  <SelectItem value="none" disabled>No pages connected</SelectItem>
                ) : (
                  pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name} ({page.follower_count?.toLocaleString() || 0} followers)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Message Details */}
        <Card>
          <CardHeader>
            <CardTitle>Message Details</CardTitle>
            <CardDescription>Write your message content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Message Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter a title for your campaign..."
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="content">Message Content *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your message here... Use {first_name} or {last_name} for personalization"
                className="mt-2 min-h-32"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <p>Use {'{first_name}'}, {'{last_name}'} for personalization</p>
                <p>{formData.content.length} characters</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media Attachments */}
        <Card>
          <CardHeader>
            <CardTitle>Media Attachments (Optional)</CardTitle>
            <CardDescription>Add images, videos, audio, or documents to your message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploadingMedia ? 'Uploading...' : 'Add Media'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                onChange={handleMediaUpload}
                className="hidden"
              />
              <p className="text-sm text-muted-foreground">
                Supported: Images, Videos, Audio, Documents (max 25MB each)
              </p>
            </div>

            {mediaAttachments.length > 0 && (
              <div className="space-y-2">
                <Label>Attached Media ({mediaAttachments.length})</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {mediaAttachments.map((attachment, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      {getMediaIcon(attachment.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {attachment.filename || 'Unknown file'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.type.toUpperCase()} • {attachment.size ? `${(attachment.size / 1024 / 1024).toFixed(1)}MB` : 'Unknown size'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMediaAttachment(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Tag */}
        <Card>
          <CardHeader>
            <CardTitle>Message Tag (Optional)</CardTitle>
            <CardDescription>
              Bypass 24-hour messaging window by using a message tag. Leave blank for standard messaging.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label htmlFor="message-tag">Select Message Tag</Label>
              <Select
                value={formData.messageTag}
                onValueChange={(value) => setFormData({ ...formData, messageTag: value as 'none' | 'ACCOUNT_UPDATE' | 'CONFIRMED_EVENT_UPDATE' | 'POST_PURCHASE_UPDATE' | 'HUMAN_AGENT' })}
              >
                <SelectTrigger id="message-tag">
                  <SelectValue placeholder="No tag (standard 24h window)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex flex-col">
                      <span className="font-medium">No Tag</span>
                      <span className="text-xs text-muted-foreground">Standard messaging (24-hour window)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ACCOUNT_UPDATE">
                    <div className="flex flex-col">
                      <span className="font-medium">Account Update</span>
                      <span className="text-xs text-muted-foreground">Account changes, purchases, subscriptions</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="CONFIRMED_EVENT_UPDATE">
                    <div className="flex flex-col">
                      <span className="font-medium">Event Update</span>
                      <span className="text-xs text-muted-foreground">Event reminders and changes</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="POST_PURCHASE_UPDATE">
                    <div className="flex flex-col">
                      <span className="font-medium">Post-Purchase Update</span>
                      <span className="text-xs text-muted-foreground">Order status and shipping updates</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="HUMAN_AGENT">
                    <div className="flex flex-col">
                      <span className="font-medium">Human Agent</span>
                      <span className="text-xs text-muted-foreground">Customer service interactions</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {formData.messageTag !== 'none' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Important:</strong> Message tags must be used appropriately. 
                    Sending promotional content with tags can result in your app being suspended by Facebook.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Auto-tag Section */}
        <Card>
          <CardHeader>
            <CardTitle>Auto-tag Conversations (Optional)</CardTitle>
            <CardDescription>
              Automatically tag conversations that receive this message successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label htmlFor="auto-tag">Select Auto-tag</Label>
              <Select
                value={formData.autoTagId}
                onValueChange={(value) => setFormData({ ...formData, autoTagId: value })}
              >
                <SelectTrigger id="auto-tag">
                  <SelectValue placeholder="No auto-tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex flex-col">
                      <span className="font-medium">No Auto-tag</span>
                      <span className="text-xs text-muted-foreground">Don&apos;t automatically tag conversations</span>
                    </div>
                  </SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full border" 
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.autoTagId && formData.autoTagId !== 'none' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>🏷️ Auto-tagging:</strong> All conversations that successfully receive this message will be automatically tagged.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message Type */}
        <Card>
          <CardHeader>
            <CardTitle>Message Type</CardTitle>
            <CardDescription>When should this message be sent?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={formData.messageType}
              onValueChange={(value) => setFormData({ ...formData, messageType: value as 'immediate' | 'scheduled' | 'draft' })}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-accent cursor-pointer has-[:checked]:border-[#1877f2]">
                <RadioGroupItem value="immediate" id="immediate" />
                <Label htmlFor="immediate" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Send className="w-4 h-4" />
                    <p className="font-medium">Send Now</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Immediate delivery</p>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-accent cursor-pointer has-[:checked]:border-[#1877f2]">
                <RadioGroupItem value="scheduled" id="scheduled" />
                <Label htmlFor="scheduled" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4" />
                    <p className="font-medium">Schedule</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Send later</p>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-accent cursor-pointer has-[:checked]:border-[#1877f2]">
                <RadioGroupItem value="draft" id="draft" />
                <Label htmlFor="draft" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4" />
                    <p className="font-medium">Save Draft</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Save for later</p>
                </Label>
              </div>
            </RadioGroup>

            {formData.messageType === 'scheduled' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.scheduleDate}
                    onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.scheduleTime}
                    onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Contacts */}
        {selectedContacts.length > 0 && (
          <Card className="border-purple-600 bg-purple-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-purple-900">
                    Selected Contacts ({selectedContacts.length})
                  </CardTitle>
                  <CardDescription className="text-purple-700">
                    {selectedContacts.length <= 100 
                      ? 'Will be sent in 1 batch'
                      : `Will be sent in ${Math.ceil(selectedContacts.length / 100)} batches of 100 each`}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedContacts([]);
                    setFormData({ ...formData, recipientType: 'all' });
                  }}
                  className="border-purple-300 hover:bg-purple-100"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Batch Info */}
              {selectedContacts.length > 100 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>📦 Batching:</strong> Your {selectedContacts.length} contacts will be split into {Math.ceil(selectedContacts.length / 100)} batches:
                  </p>
                  <ul className="text-xs text-blue-700 mt-2 ml-4 list-disc">
                    {Array.from({ length: Math.ceil(selectedContacts.length / 100) }, (_, i) => {
                      const start = i * 100 + 1;
                      const end = Math.min((i + 1) * 100, selectedContacts.length);
                      const count = end - start + 1;
                      return (
                        <li key={i}>
                          Batch {i + 1}: {count} recipient{count !== 1 ? 's' : ''} (#{start}-#{end})
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-blue-700 mt-2">
                    ⏱️ Estimated time: ~{Math.ceil(selectedContacts.length * 0.1 / 60)} minute{Math.ceil(selectedContacts.length * 0.1 / 60) !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {/* Contact List (show first 50, then summary) */}
              <div className="flex flex-wrap gap-2">
                {selectedContacts.slice(0, 50).map((contact, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-2">
                    {contact.sender_name || `User ${contact.sender_id.substring(0, 8)}`}
                    <button
                      onClick={() => {
                        setSelectedContacts(prev => prev.filter((_, i) => i !== index));
                      }}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {selectedContacts.length > 50 && (
                  <Badge variant="outline" className="px-3 py-2 border-2 border-dashed">
                    + {selectedContacts.length - 50} more contacts
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle>Recipients</CardTitle>
            <CardDescription>Who should receive this message?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={formData.recipientType}
              onValueChange={(value) => setFormData({ ...formData, recipientType: value as 'all' | 'active' | 'selected' })}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {selectedContacts.length > 0 && (
                <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-accent cursor-pointer has-[:checked]:border-[#1877f2]">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Send className="w-4 h-4" />
                      <p className="font-medium">Selected Contacts</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send to {selectedContacts.length} selected contact(s)
                    </p>
                  </Label>
                </div>
              )}

              <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-accent cursor-pointer has-[:checked]:border-[#1877f2]">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4" />
                    <p className="font-medium">All Followers</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Send to all {selectedPage?.follower_count?.toLocaleString() || 0} followers
                  </p>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-accent cursor-pointer has-[:checked]:border-[#1877f2]">
                <RadioGroupItem value="active" id="active" />
                <Label htmlFor="active" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4" />
                    <p className="font-medium">Active Users Only</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Send to ~{Math.floor((selectedPage?.follower_count || 0) * 0.7).toLocaleString()} active users
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Preview */}
        {formData.content && selectedPage && (
          <Card>
            <CardHeader>
              <CardTitle>Message Preview</CardTitle>
              <CardDescription>How your message will appear</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-6 max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#1877f2] rounded-full flex items-center justify-center text-white font-bold">
                    {selectedPage.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{selectedPage.name}</p>
                    <p className="text-xs text-muted-foreground">now</p>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{getPreviewMessage()}</p>
                {mediaAttachments.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium mb-2">
                      📎 {mediaAttachments.length} attachment{mediaAttachments.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {mediaAttachments.map((attachment, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {getMediaIcon(attachment.type)}
                          <span className="ml-1">{attachment.type}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={sendMutation.isPending}
            className="flex-1 bg-[#1877f2] hover:bg-[#166fe5] h-12 text-lg"
          >
            {sendMutation.isPending ? 'Processing...' :
             formData.messageType === 'immediate' ? 'Send Message' :
             formData.messageType === 'scheduled' ? 'Schedule Message' : 'Save Draft'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="px-8"
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Sending Progress Dialog */}
      <Dialog open={sendingProgress.isOpen} onOpenChange={handleProgressDialogChange}>
        <DialogContent
          className="relative sm:max-w-[520px] max-h-[80vh] overflow-y-auto sm:top-1/2 sm:-translate-y-1/2"
          onInteractOutside={(e) => {
            if (!canManuallyCloseProgress) {
              e.preventDefault();
            }
          }}
        >
          <div className="absolute right-4 top-4">
            {canManuallyCloseProgress ? (
              <DialogClose asChild>
                <Button variant="ghost" size="icon" type="button" aria-label="Close progress">
                  <X className="w-4 h-4" />
                </Button>
              </DialogClose>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Sending in progress"
                disabled
                className="opacity-50 cursor-not-allowed"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sendingProgress.status === 'sending' && (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  Sending Messages...
                </>
              )}
              {sendingProgress.status === 'completed' && (
                <>
                  <Send className="w-5 h-5 text-green-600" />
                  Messages Sent!
                </>
              )}
              {sendingProgress.status === 'cancelled' && (
                <>
                  <XCircle className="w-5 h-5 text-orange-600" />
                  Send Cancelled
                </>
              )}
              {sendingProgress.status === 'error' && (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Send Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {sendingProgress.status === 'sending'
                ? `Messages are sending in batches. ${totalBatchCount > 0 ? (currentProcessingBatch ? `Currently on batch ${currentProcessingBatch.batchNumber} of ${totalBatchCount}.` : `Preparing ${totalBatchCount} batches...`) : ''}`
                : sendingProgress.status === 'completed'
                ? `Message sending completed! ${sendingProgress.sent} sent, ${sendingProgress.failed} failed.`
                : sendingProgress.status === 'cancelled'
                ? 'Message sending was cancelled. Some messages may have been delivered.'
                : 'There was an error sending your message. Please review the details below.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progress</span>
                <span>
                  {sendingProgress.total > 0
                    ? `${totalProcessed} / ${sendingProgress.total}`
                    : 'Preparing recipients...'}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressPercent}% complete</span>
                <span>{lastUpdatedLabel ? `Updated ${lastUpdatedLabel}` : 'Awaiting first update...'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 py-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {sendingProgress.sent}
                </div>
                <div className="text-xs text-muted-foreground">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {sendingProgress.failed}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {pendingCount}
                </div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
            </div>

            {totalBatchCount > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Batch Overview</span>
                  <span>
                    {batchStatusSummary.completed} completed · {batchStatusSummary.processing} in progress
                  </span>
                </div>
                {sendingProgress.batches.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60">
                    {sendingProgress.batches.map((batch) => {
                      const info = batchStatusStyles[batch.status] || batchStatusStyles.pending;
                      return (
                        <div
                          key={batch.batchNumber}
                          className={`flex items-center justify-between border-b border-border/60 px-3 py-2 text-sm last:border-b-0 ${info.rowClassName ?? ''}`}
                        >
                          <div>
                            <p className="font-medium">
                              Batch {batch.batchNumber}
                              {batch.status === 'processing' ? ' • In progress' : ''}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {batch.sent + batch.failed} / {batch.total} processed
                            </p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${info.badgeClass}`}>
                            {info.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                    Preparing batch details...
                  </div>
                )}
              </div>
            )}

            {sendingProgress.failureReasons.length > 0 && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-semibold">We hit an issue while sending:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {sendingProgress.failureReasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {sendingProgress.status === 'sending' && (
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {currentProcessingBatch
                    ? `Working through batch ${currentProcessingBatch.batchNumber} of ${totalBatchCount || '?'}.`
                    : 'Preparing your batches...'}
                </span>
              </div>
            )}

            {sendingProgress.status === 'error' && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                Please review the message in your history for more details.
              </div>
            )}

            {sendingProgress.status === 'cancelled' && (
              <div className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-3">
                Cancel request received. Any batches already submitted may still deliver.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            {sendingProgress.status === 'sending' ? (
              <Button
                variant="outline"
                onClick={handleCancelSend}
                disabled={cancelMutation.isPending}
                type="button"
              >
                {cancelMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Send
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleCloseProgress} type="button">
                Close & View Dashboard
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
