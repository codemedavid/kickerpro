'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Send, ArrowLeft, Calendar, Users, Eye, X, Loader2, AlertCircle, XCircle, Upload, Image, Video, File, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

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
    messageTag: 'none' as 'none' | 'ACCOUNT_UPDATE' | 'CONFIRMED_EVENT_UPDATE' | 'POST_PURCHASE_UPDATE' | 'HUMAN_AGENT'
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
    status: 'sending' | 'completed' | 'cancelled' | 'error';
  }>({
    isOpen: false,
    messageId: null,
    sent: 0,
    failed: 0,
    total: 0,
    status: 'sending'
  });
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

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
          isImmediateSend: true
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
          total: data.message.recipient_count,
          status: 'sending'
        });
        
        // Start polling for progress
        startPolling(data.message.id);
        
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
    };
  }, []);

  // Media handling functions
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);

    try {
      // Create FormData for file upload
      const uploadFormData = new FormData();
      Array.from(files).forEach(file => {
        uploadFormData.append('files', file);
      });
      
      // Add page ID for Facebook upload
      if (formData.pageId) {
        uploadFormData.append('pageId', formData.pageId);
      }

      // Upload files to server using Supabase Storage
      const response = await fetch('/api/upload-supabase', {
        method: 'POST',
        body: uploadFormData
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const error = await response.json();
          errorMessage = error.error || 'Upload failed';
        } catch (jsonError) {
          console.error('[Compose] Failed to parse error response:', jsonError);
          errorMessage = `Upload failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      let result;
      try {
        result = await response.json();
        console.log('[Compose] Upload result:', result);
      } catch (jsonError) {
        console.error('[Compose] Failed to parse upload response:', jsonError);
        throw new Error('Invalid response from upload server');
      }

      // Add uploaded files to attachments
      if (result.files && result.files.length > 0) {
        setMediaAttachments(prev => [...prev, ...result.files]);
        
        toast({
          title: "Media Added",
          description: `${result.files.length} file(s) uploaded successfully`
        });
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
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <File className="w-4 h-4" />;
      default: return <File className="w-4 h-4" />;
    }
  };

  // Polling function to check message sending progress
  const startPolling = (messageId: string) => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }

    // Poll every 2 seconds
    pollInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/messages/${messageId}`);
        if (!response.ok) throw new Error('Failed to fetch message status');
        
        const message = await response.json();
        
        // Update progress
        setSendingProgress(prev => ({
          ...prev,
          sent: message.delivered_count || 0,
          failed: (message.recipient_count || 0) - (message.delivered_count || 0),
          status: message.status === 'sending' ? 'sending' : 
                  message.status === 'cancelled' ? 'cancelled' :
                  message.status === 'failed' ? 'error' : 'completed'
        }));

        // Stop polling if completed, cancelled, or failed
        if (message.status !== 'sending') {
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
          }
        }
      } catch (error) {
        console.error('[Polling] Error:', error);
      }
    }, 2000);
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

  const handleCloseProgress = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }

    setSendingProgress({
      isOpen: false,
      messageId: null,
      sent: 0,
      failed: 0,
      total: 0,
      status: 'sending'
    });

    router.push('/dashboard');
  };

  const selectedPage = pages.find(p => p.id === formData.pageId);

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
      <Dialog open={sendingProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
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
              {sendingProgress.status === 'sending' && 
                "Please wait while we send your message with media attachments. This may take a few moments."}
              {sendingProgress.status === 'completed' && 
                "Your message has been sent to all recipients."}
              {sendingProgress.status === 'cancelled' && 
                "Message sending was cancelled. Some messages may have been sent."}
              {sendingProgress.status === 'error' && 
                "There was an error sending your message."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progress</span>
                <span>
                  {sendingProgress.sent + sendingProgress.failed} / {sendingProgress.total}
                </span>
              </div>
              <Progress 
                value={((sendingProgress.sent + sendingProgress.failed) / sendingProgress.total) * 100} 
                className="h-2"
              />
            </div>

            {/* Stats */}
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
                  {sendingProgress.total - sendingProgress.sent - sendingProgress.failed}
                </div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
            </div>

            {/* Status Message */}
            {sendingProgress.status === 'sending' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending messages with media in batches...</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {sendingProgress.status === 'sending' ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancelSend}
                  disabled={cancelMutation.isPending}
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
              </>
            ) : (
              <Button onClick={handleCloseProgress}>
                Close & View Dashboard
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

