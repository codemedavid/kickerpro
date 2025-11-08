'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Send, ArrowLeft, Calendar, Users, Eye, X, Upload, Image as ImageIcon, Video, File, Trash2, RefreshCw, Tag as TagIcon, Sparkles, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
// Progress modal removed
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
  
  // Auto-fetch and tag filtering state for scheduled messages
  const [autoFetchEnabled, setAutoFetchEnabled] = useState(false);
  const [includeTagIds, setIncludeTagIds] = useState<string[]>([]);
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>([]);
  
  // AI personalization for auto-fetch
  const [aiPersonalizeAutoFetch, setAiPersonalizeAutoFetch] = useState(false);
  const [aiAutoFetchInstructions, setAiAutoFetchInstructions] = useState('');
  
  // AI generation state
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiGeneratedMessages, setAiGeneratedMessages] = useState<Array<{
    conversationId: string;
    message: string;
    participantName: string;
    senderId: string;
  }>>([]);
  const [currentAiMessageIndex, setCurrentAiMessageIndex] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [customAiInstructions, setCustomAiInstructions] = useState('');
  const [useAiBulkSend, setUseAiBulkSend] = useState(false);
  // Progress modal and local polling removed; handled globally

  // Load selected contacts from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('selectedContacts');
    if (stored) {
      try {
        const data = JSON.parse(stored) as { 
          contacts: Array<{ sender_id: string; sender_name: string | null }>;
          pageId?: string;
          prefilledMessage?: string;
        };
        
        if (data.contacts && data.contacts.length > 0) {
          setSelectedContacts(data.contacts.map(c => ({
            sender_id: c.sender_id,
            sender_name: c.sender_name
          })));
          
          // Auto-select the page if specified
          if (data.pageId) {
            setFormData(prev => ({ 
              ...prev, 
              pageId: data.pageId as string, 
              recipientType: 'selected',
              // Pre-fill message if provided (from AI generation)
              content: data.prefilledMessage || prev.content
            }));
          } else {
            setFormData(prev => ({ 
              ...prev, 
              recipientType: 'selected',
              content: data.prefilledMessage || prev.content
            }));
          }
          
          toast({
            title: data.prefilledMessage ? "AI Message Loaded" : "Contacts Loaded",
            description: data.prefilledMessage 
              ? "AI-generated message has been pre-filled"
              : `${data.contacts.length} contact(s) ready to message`
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

  // Local polling removed

  // Local manual batch processing removed

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
        
        // Use direct send (bypasses batch system which is unreliable)
        const hasMedia = data.media_attachments && data.media_attachments.length > 0;
        const apiEndpoint = hasMedia 
          ? `/api/messages/${result.message.id}/send-enhanced`
          : `/api/messages/${result.message.id}/send-now`; // USE DIRECT SEND
        
        console.log('[Compose] Using API endpoint:', apiEndpoint, '(direct send, bypasses batches)');
        
        // Start sending immediately and wait for completion
        // Changed from fire-and-forget to synchronous for reliability
        setTimeout(async () => {
          try {
            console.log('[Compose] Triggering send...');
            const sendResponse = await fetch(apiEndpoint, {
              method: 'GET'
            });
            
            console.log('[Compose] Send response status:', sendResponse.status);
            
            if (sendResponse.ok) {
              const sendResult = await sendResponse.json();
              console.log('[Compose] ✅ Send successful:', sendResult);
              console.log('[Compose] ✅ Sent:', sendResult.stats?.sent || 0, 'Failed:', sendResult.stats?.failed || 0);
              
              // Refresh to show updated delivery count
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['messages'] });
              }, 1000);
            } else {
              const errorText = await sendResponse.text();
              console.error('[Compose] ❌ Send failed:', sendResponse.status, errorText);
            }
          } catch (error) {
            console.error('[Compose] ❌ Send error:', error);
          }
        }, 500); // 500ms delay to ensure message is saved first
        
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

      // If immediate send, show toast and let background/global indicator handle progress
      if (data.isImmediateSend) {
        toast({
          title: 'Sending started',
          description: 'Your message is sending in the background. You can continue using the app.',
        });

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

  // No local polling cleanup needed

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


  // Cancel handled by global indicator

  // Progress close removed

  const selectedPage = pages.find(p => p.id === formData.pageId);
  // Local progress metrics removed

  // Progress dialog handlers removed

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
      }),
      // Add auto-fetch and tag filtering for scheduled messages
      ...(formData.messageType === 'scheduled' && {
        auto_fetch_enabled: autoFetchEnabled,
        auto_fetch_page_id: autoFetchEnabled ? formData.pageId : null,
        include_tag_ids: includeTagIds.length > 0 ? includeTagIds : [],
        exclude_tag_ids: excludeTagIds.length > 0 ? excludeTagIds : [],
        ai_personalize_auto_fetch: autoFetchEnabled && aiPersonalizeAutoFetch,
        ai_custom_instructions: aiPersonalizeAutoFetch && aiAutoFetchInstructions.trim() 
          ? aiAutoFetchInstructions.trim() 
          : null
      }),
      // Add AI personalized messages if bulk send with AI is enabled
      ...(useAiBulkSend && aiGeneratedMessages.length > 0 && {
        use_ai_bulk_send: true,
        ai_messages_map: aiGeneratedMessages.reduce((acc, msg) => {
          acc[msg.senderId] = msg.message;
          return acc;
        }, {} as Record<string, string>)
      })
    };

    console.log('[Compose] Sending message data:', messageData);
    console.log('[Compose] AI Bulk Send:', useAiBulkSend, 'AI Messages:', aiGeneratedMessages.length);

    sendMutation.mutate(messageData);
  };

  // AI Generation Handler
  const handleGenerateAIMessages = async () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "No Contacts Selected",
        description: "Please select contacts first to generate AI messages",
        variant: "destructive"
      });
      return;
    }

    if (!formData.pageId) {
      toast({
        title: "Select a Page",
        description: "Please select a Facebook page first",
        variant: "destructive"
      });
      return;
    }

    setIsAiGenerating(true);
    setShowAiPanel(true);
    
    try {
      // Get sender IDs (PSIDs) from selected contacts
      const senderIds = selectedContacts.map(c => c.sender_id);

      toast({
        title: "Generating AI Messages",
        description: `Processing ${selectedContacts.length} conversations...`,
        duration: 3000
      });

      // Call AI generation API with sender IDs (PSIDs)
      const response = await fetch('/api/ai/generate-follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderIds,
          pageId: formData.pageId,
          customInstructions: customAiInstructions.trim() || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate AI messages');
      }

      const data = await response.json();

      // Map messages with sender_id for bulk sending
      const messagesWithSenderId = (data.messages || []).map((msg: {
        conversationId: string;
        message: string;
        participantName: string;
      }) => {
        // When using senderIds, conversationId will be the sender_id
        // Otherwise, find the sender_id from our contacts
        const contact = selectedContacts.find(c => c.sender_id === msg.conversationId);
        
        return {
          ...msg,
          senderId: contact?.sender_id || msg.conversationId
        };
      });

      setAiGeneratedMessages(messagesWithSenderId);
      setCurrentAiMessageIndex(0);

      if (messagesWithSenderId.length > 0) {
        // Pre-fill with first message
        setFormData(prev => ({
          ...prev,
          content: messagesWithSenderId[0].message
        }));

        toast({
          title: "AI Messages Generated!",
          description: `${data.generated} personalized messages ready. ${selectedContacts.length > 1 ? 'Enable "AI Bulk Send" to send unique messages to each person.' : ''}`,
          duration: 5000
        });
      }

    } catch (error) {
      console.error('[Compose] Error generating AI messages:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate AI messages",
        variant: "destructive"
      });
      setShowAiPanel(false);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Navigate AI messages
  const handlePreviousAiMessage = () => {
    if (currentAiMessageIndex > 0) {
      const newIndex = currentAiMessageIndex - 1;
      setCurrentAiMessageIndex(newIndex);
      setFormData(prev => ({
        ...prev,
        content: aiGeneratedMessages[newIndex].message
      }));
    }
  };

  const handleNextAiMessage = () => {
    if (currentAiMessageIndex < aiGeneratedMessages.length - 1) {
      const newIndex = currentAiMessageIndex + 1;
      setCurrentAiMessageIndex(newIndex);
      setFormData(prev => ({
        ...prev,
        content: aiGeneratedMessages[newIndex].message
      }));
    }
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
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="content">Message Content *</Label>
              </div>

              {/* Custom AI Instructions */}
              {selectedContacts.length > 0 && formData.pageId && (
                <Card className="mb-4 border-purple-200 bg-purple-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <Label htmlFor="ai-instructions" className="font-semibold text-purple-900">
                        AI Message Instructions (Optional)
                      </Label>
                    </div>
                    <Textarea
                      id="ai-instructions"
                      value={customAiInstructions}
                      onChange={(e) => setCustomAiInstructions(e.target.value)}
                      placeholder="Example: Focus on our summer sale, mention 20% discount, keep it casual and friendly..."
                      className="min-h-20 bg-white"
                    />
                    <p className="text-xs text-purple-700 mt-2 mb-3">
                      Tell the AI how you want the messages composed. More specific = better results.
                    </p>
                    <Button
                      type="button"
                      onClick={handleGenerateAIMessages}
                      disabled={isAiGenerating}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      {isAiGenerating ? (
                        <>
                          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          Generating {selectedContacts.length} Personalized Messages...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 w-4 h-4" />
                          Generate {selectedContacts.length} AI Messages
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* AI Messages Panel */}
              {showAiPanel && aiGeneratedMessages.length > 0 && (
                <Card className="mb-4 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <span className="font-semibold text-purple-900">
                          AI Generated Message {currentAiMessageIndex + 1} of {aiGeneratedMessages.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handlePreviousAiMessage}
                          disabled={currentAiMessageIndex === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleNextAiMessage}
                          disabled={currentAiMessageIndex === aiGeneratedMessages.length - 1}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowAiPanel(false)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* AI Bulk Send Option */}
                    {selectedContacts.length > 1 && (
                      <div className="mb-3 p-3 bg-white rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="w-4 h-4 text-purple-600" />
                              <Label htmlFor="ai-bulk-send" className="font-semibold text-purple-900">
                                AI Personalized Bulk Send
                              </Label>
                            </div>
                            <p className="text-xs text-purple-700">
                              Send unique AI-generated message to each person (not the same message to all)
                            </p>
                          </div>
                          <Switch
                            id="ai-bulk-send"
                            checked={useAiBulkSend}
                            onCheckedChange={setUseAiBulkSend}
                          />
                        </div>
                        {useAiBulkSend && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                            ✓ Each of the {aiGeneratedMessages.length} contacts will receive their own personalized AI message
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <p className="text-sm font-medium text-purple-900 mb-1">
                        {useAiBulkSend ? 'Preview Message' : 'For'}: {aiGeneratedMessages[currentAiMessageIndex]?.participantName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {useAiBulkSend 
                          ? '💡 Each person will get their unique message. Use arrows to preview all messages.'
                          : '💡 This message is pre-filled below. Edit as needed, then use arrows to view others.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

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
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* Auto-Fetch Feature */}
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      <Label htmlFor="auto-fetch" className="font-semibold text-blue-900">
                        Auto-Fetch New Conversations
                      </Label>
                    </div>
                    <Switch
                      id="auto-fetch"
                      checked={autoFetchEnabled}
                      onCheckedChange={setAutoFetchEnabled}
                    />
                  </div>
                  <p className="text-xs text-blue-700 mb-3">
                    Automatically sync and fetch new conversations from the selected page before sending
                  </p>

                  {autoFetchEnabled && (
                    <div className="space-y-3 pt-3 border-t border-blue-300">
                      {/* Include Tags */}
                      <div>
                        <Label className="text-sm font-medium text-blue-900 flex items-center gap-2 mb-2">
                          <TagIcon className="w-3 h-3" />
                          Include Conversations With Tags
                        </Label>
                        <p className="text-xs text-blue-600 mb-2">
                          Only include conversations that have at least one of these tags
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {tags && tags.length > 0 ? (
                            tags.map((tag: { id: string; name: string; color: string }) => (
                              <div
                                key={tag.id}
                                className="flex items-center gap-1"
                              >
                                <Checkbox
                                  id={`include-${tag.id}`}
                                  checked={includeTagIds.includes(tag.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setIncludeTagIds([...includeTagIds, tag.id]);
                                      // Remove from exclude if it's there
                                      setExcludeTagIds(excludeTagIds.filter(id => id !== tag.id));
                                    } else {
                                      setIncludeTagIds(includeTagIds.filter(id => id !== tag.id));
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`include-${tag.id}`}
                                  className="cursor-pointer"
                                >
                                  <Badge style={{ backgroundColor: tag.color, color: 'white' }}>
                                    {tag.name}
                                  </Badge>
                                </Label>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-blue-600">No tags created yet</p>
                          )}
                        </div>
                      </div>

                      {/* Exclude Tags */}
                      <div>
                        <Label className="text-sm font-medium text-blue-900 flex items-center gap-2 mb-2">
                          <TagIcon className="w-3 h-3" />
                          Exclude Conversations With Tags
                        </Label>
                        <p className="text-xs text-blue-600 mb-2">
                          Exclude conversations that have any of these tags
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {tags && tags.length > 0 ? (
                            tags.map((tag: { id: string; name: string; color: string }) => (
                              <div
                                key={tag.id}
                                className="flex items-center gap-1"
                              >
                                <Checkbox
                                  id={`exclude-${tag.id}`}
                                  checked={excludeTagIds.includes(tag.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setExcludeTagIds([...excludeTagIds, tag.id]);
                                      // Remove from include if it's there
                                      setIncludeTagIds(includeTagIds.filter(id => id !== tag.id));
                                    } else {
                                      setExcludeTagIds(excludeTagIds.filter(id => id !== tag.id));
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`exclude-${tag.id}`}
                                  className="cursor-pointer"
                                >
                                  <Badge
                                    variant="outline"
                                    style={{ borderColor: tag.color, color: tag.color }}
                                  >
                                    {tag.name}
                                  </Badge>
                                </Label>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-blue-600">No tags created yet</p>
                          )}
                        </div>
                      </div>

                      {/* Summary */}
                      {(includeTagIds.length > 0 || excludeTagIds.length > 0) && (
                        <div className="bg-white rounded p-2 text-xs">
                          <p className="font-semibold text-blue-900 mb-1">Filter Summary:</p>
                          {includeTagIds.length > 0 && (
                            <p className="text-green-700">
                              ✓ Include {includeTagIds.length} tag{includeTagIds.length !== 1 ? 's' : ''}
                            </p>
                          )}
                          {excludeTagIds.length > 0 && (
                            <p className="text-red-700">
                              ✗ Exclude {excludeTagIds.length} tag{excludeTagIds.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      )}

                      {/* AI Personalization for Auto-Fetch */}
                      <div className="border-t border-blue-300 pt-3 mt-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <Label htmlFor="ai-personalize-auto-fetch" className="font-semibold text-blue-900">
                              AI Personalize New Contacts
                            </Label>
                          </div>
                          <Switch
                            id="ai-personalize-auto-fetch"
                            checked={aiPersonalizeAutoFetch}
                            onCheckedChange={setAiPersonalizeAutoFetch}
                          />
                        </div>
                        <p className="text-xs text-blue-700 mb-3">
                          Generate unique AI-personalized messages for each auto-fetched contact based on their conversation history
                        </p>

                        {aiPersonalizeAutoFetch && (
                          <div className="space-y-2 bg-white rounded p-3">
                            <Label htmlFor="ai-auto-fetch-instructions" className="text-sm font-medium text-blue-900">
                              Custom AI Instructions (Optional)
                            </Label>
                            <Textarea
                              id="ai-auto-fetch-instructions"
                              placeholder="e.g., Focus on our holiday sale, keep it casual and friendly, mention 30% off..."
                              value={aiAutoFetchInstructions}
                              onChange={(e) => setAiAutoFetchInstructions(e.target.value)}
                              className="min-h-[80px] text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              These instructions will guide the AI when generating personalized messages for new contacts
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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

      {/* Progress modal removed: handled via global floating indicator and toast notifications */}
    </div>
  );
}
