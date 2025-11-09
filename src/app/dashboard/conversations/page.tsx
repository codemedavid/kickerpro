'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  RefreshCw,
  Users,
  Clock,
  Search,
  Loader2,
  Send,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Tag as TagIcon,
  Plus,
  X,
  Target,
  Flame,
  Snowflake,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { format, formatDistanceToNow } from 'date-fns';
import { TagFilter } from '@/components/ui/tag-filter';
import { ConversationTags } from '@/components/ui/conversation-tags';
import { TagSelector } from '@/components/ui/tag-selector';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';

interface Conversation {
  id: string;
  sender_id: string;
  sender_name: string | null;
  last_message: string | null;
  last_message_time: string;
  conversation_status: 'active' | 'inactive' | 'blocked';
  message_count: number;
  page_id: string;
}

interface FacebookPage {
  id: string;
  facebook_page_id: string;
  name: string;
  profile_picture: string | null;
}

const ITEMS_PER_PAGE = 20;
// No limit on bulk selection - unlimited contacts can be selected

type SyncSummary = {
  inserted: number;
  updated: number;
  total: number;
  timestamp: string;
  pageId: string;
  pageName: string;
};

export default function ConversationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  // Debug: Log user and query state
  console.log('[Conversations] User:', user);
  console.log('[Conversations] User ID:', user?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPageId, setSelectedPageId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [exceptTagIds, setExceptTagIds] = useState<string[]>([]);
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [bulkTagAction, setBulkTagAction] = useState<'assign' | 'remove' | 'replace'>('assign');
  const [isBulkTagDialogOpen, setIsBulkTagDialogOpen] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [syncTargetPageId, setSyncTargetPageId] = useState<string | null>(null);
  const [syncBaselineCount, setSyncBaselineCount] = useState(0);
  const [realtimeStats, setRealtimeStats] = useState<{ inserts: number; updates: number }>({ inserts: 0, updates: 0 });
  const [lastSyncSummary, setLastSyncSummary] = useState<SyncSummary | null>(null);
  const [isScoringLeads, setIsScoringLeads] = useState(false);
  const [quickFilterTag, setQuickFilterTag] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseClient(), []);

  // Fetch connected pages
  const { data: pages = [] } = useQuery<FacebookPage[]>({
    queryKey: ['pages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pages');
      if (!response.ok) throw new Error('Failed to fetch pages');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch conversations with server-side pagination
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{
    conversations: Conversation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ['conversations', selectedPageId, startDate, endDate, currentPage, selectedTagIds, exceptTagIds, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPageId !== 'all') params.append('facebookPageId', selectedPageId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedTagIds.length > 0) params.append('include_tags', selectedTagIds.join(','));
      if (exceptTagIds.length > 0) params.append('exclude_tags', exceptTagIds.join(','));
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('page', String(currentPage));
      params.append('limit', String(ITEMS_PER_PAGE));

      console.log('[Conversations] Fetching page', currentPage, 'with filters:', {
        facebookPageId: selectedPageId,
        startDate: startDate || 'none',
        endDate: endDate || 'none',
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : 'none',
        exceptTagIds: exceptTagIds.length > 0 ? exceptTagIds : 'none'
      });

      const response = await fetch(`/api/conversations?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
    enabled: !!user?.id,
    placeholderData: (previousData) => previousData // Keep showing old data while loading new page
  });
  
  // Debug: Log query state
  console.log('[Conversations] Query enabled:', !!user?.id);
  console.log('[Conversations] Query loading:', conversationsLoading);
  console.log('[Conversations] Query data:', conversationsData);

  const conversations: Conversation[] = conversationsData?.conversations || [];
  const pagination = conversationsData?.pagination || {
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    pages: 1,
    hasNext: false,
    hasPrev: false
  };

  useEffect(() => {
    if (!syncInProgress || !syncTargetPageId) return;

    const channel = supabase
      .channel(`messenger-conversations-sync-${syncTargetPageId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messenger_conversations',
          filter: `page_id=eq.${syncTargetPageId}`
        },
        () => {
          setRealtimeStats(prev => ({ ...prev, inserts: prev.inserts + 1 }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messenger_conversations',
          filter: `page_id=eq.${syncTargetPageId}`
        },
        () => {
          setRealtimeStats(prev => ({ ...prev, updates: prev.updates + 1 }));
        }
      )
      .subscribe();

    console.log('[Conversations] Realtime subscription started for page:', syncTargetPageId);

    return () => {
      supabase.removeChannel(channel);
      console.log('[Conversations] Realtime subscription stopped for page:', syncTargetPageId);
    };
  }, [supabase, syncInProgress, syncTargetPageId]);

  // Sync conversations mutation
  const syncMutation = useMutation({
    mutationFn: async (pageData: { pageId: string; facebookPageId: string }) => {
      // Use streaming endpoint for real-time progress
      const response = await fetch('/api/conversations/sync-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageData)
      });

      if (!response.ok) {
        throw new Error('Failed to start sync');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResult = { inserted: 0, updated: 0 };

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));
                
                // Update real-time stats
                if (data.inserted !== undefined) {
                  setRealtimeStats({ 
                    inserts: data.inserted, 
                    updates: data.updated 
                  });
                }

                // Show progress toasts
                if (data.status === 'batch_complete') {
                  toast({
                    title: `Batch ${data.batch} Complete`,
                    description: `Synced ${data.total} conversations so far...`,
                  });
                }

                // Final result
                if (data.status === 'complete') {
                  finalResult = {
                    inserted: data.inserted,
                    updated: data.updated
                  };
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      return finalResult;
    },
    onMutate: (variables) => {
      setSyncInProgress(true);
      setRealtimeStats({ inserts: 0, updates: 0 });
      setSyncBaselineCount(pagination.total);
      setSyncTargetPageId(variables.facebookPageId);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      const pageName =
        pages.find(p => p.facebook_page_id === variables.facebookPageId)?.name ||
        'Facebook Page';

      setRealtimeStats({
        inserts: data.inserted ?? 0,
        updates: data.updated ?? 0
      });

      setLastSyncSummary({
        inserted: data.inserted ?? 0,
        updated: data.updated ?? 0,
        total: (data.inserted ?? 0) + (data.updated ?? 0),
        timestamp: new Date().toISOString(),
        pageId: variables.facebookPageId,
        pageName
      });

      toast({
        title: "Sync Complete!",
        description: `Synced ${(data.inserted ?? 0) + (data.updated ?? 0)} conversation(s) from Facebook`
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync conversations",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setSyncInProgress(false);
      setSyncTargetPageId(null);
    }
  });

  const handleSync = () => {
    if (selectedPageId === 'all') {
      toast({
        title: "Select a Page",
        description: "Please select a specific page to sync conversations from Facebook",
        variant: "destructive"
      });
      return;
    }

    const page = pages.find(p => p.facebook_page_id === selectedPageId);
    if (!page) return;

    syncMutation.mutate({
      pageId: page.id,
      facebookPageId: page.facebook_page_id
    });
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setSelectedPageId('all');
    setSelectedTagIds([]);
    setExceptTagIds([]);
    setCurrentPage(1);
  };

  // Bulk tag operations mutation
  const bulkTagMutation = useMutation({
    mutationFn: async ({ 
      conversationIds, 
      tagIds, 
      action 
    }: { 
      conversationIds: string[]; 
      tagIds: string[]; 
      action: 'assign' | 'remove' | 'replace' 
    }) => {
      const response = await fetch('/api/conversations/bulk-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds, tagIds, action })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process bulk tag operation');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      const actionText = {
        assign: 'added to',
        remove: 'removed from',
        replace: 'replaced in'
      }[variables.action];
      
      toast({
        title: "Tags Updated",
        description: `Successfully ${actionText} ${variables.conversationIds.length} conversation${variables.conversationIds.length !== 1 ? 's' : ''}`
      });
      setBulkTagIds([]);
      setBulkTagAction('assign');
      setIsBulkTagDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update tags",
        variant: "destructive"
      });
    }
  });

  const handleBulkTagAssignment = async () => {
    if (selectedContacts.size === 0) {
      toast({
        title: "No Contacts Selected",
        description: "Please select conversations to tag",
        variant: "destructive"
      });
      return;
    }

    if (bulkTagIds.length === 0 && bulkTagAction !== 'remove') {
      toast({
        title: "No Tags Selected",
        description: "Please select tags to apply",
        variant: "destructive"
      });
      return;
    }

    // For "remove all tags", confirm the action
    if (bulkTagAction === 'remove' && bulkTagIds.length === 0) {
      if (!confirm(`Are you sure you want to remove ALL tags from ${selectedContacts.size} conversation${selectedContacts.size !== 1 ? 's' : ''}?`)) {
        return;
      }
    }

    try {
      // Fetch ALL selected conversations to get their IDs
      const params = new URLSearchParams();
      if (selectedPageId !== 'all') params.append('facebookPageId', selectedPageId);
      params.append('limit', String(selectedContacts.size));
      
      const response = await fetch(`/api/conversations?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      
      const data = await response.json();
      const allConversations = data.conversations || [];
      
      // Filter to only selected ones
      const conversationIds = allConversations
        .filter((c: Conversation) => selectedContacts.has(c.sender_id))
        .map((c: Conversation) => c.id);

      if (conversationIds.length === 0) {
        toast({
          title: "No Conversations Found",
          description: "Could not find the selected conversations",
          variant: "destructive"
        });
        return;
      }

      bulkTagMutation.mutate({
        conversationIds,
        tagIds: bulkTagIds,
        action: bulkTagAction
      });
    } catch (error) {
      console.error('[Conversations] Error fetching conversation IDs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch conversation data. Please try again.",
        variant: "destructive"
      });
    }
  };


  // Use conversations directly since search is now server-side
  const displayConversations = conversations;

  // Check if all items on current page are selected
  const allOnPageSelected = displayConversations.length > 0 && 
    displayConversations.every(conv => selectedContacts.has(conv.sender_id));

  const handleSelectAllOnPage = () => {
    const newSelection = new Set(selectedContacts);
    
    if (allOnPageSelected) {
      // Deselect all on this page only
      displayConversations.forEach(conv => newSelection.delete(conv.sender_id));
      setSelectedContacts(newSelection);
    } else {
      // Select all on this page (unlimited)
      for (const conv of displayConversations) {
        newSelection.add(conv.sender_id);
      }
      
      setSelectedContacts(newSelection);
    }
  };

  const handleSelectAllFromFilter = async () => {
    // Select ALL conversations matching current filters (not just current page)
    const totalToSelect = totalCount;

    // Show confirmation
    const confirmMessage = `Select all ${totalToSelect} conversations from filters?`;

    if (!confirm(confirmMessage)) return;

    try {
      // Fetch ALL matching conversations (not paginated)
      const params = new URLSearchParams();
      if (selectedPageId !== 'all') params.append('facebookPageId', selectedPageId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedTagIds.length > 0) params.append('include_tags', selectedTagIds.join(','));
      if (exceptTagIds.length > 0) params.append('exclude_tags', exceptTagIds.join(','));
      params.append('limit', String(totalToSelect)); // Get all
      params.append('page', '1');

      const response = await fetch(`/api/conversations?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();

      if (data.conversations) {
        const newSelection = new Set(selectedContacts);

        for (const conv of data.conversations) {
          newSelection.add(conv.sender_id);
        }

        setSelectedContacts(newSelection);
        
        toast({
          title: "Contacts Selected",
          description: `Added ${data.conversations.length} contacts from filters. Total: ${newSelection.size}`,
          duration: 3000
        });
      }
    } catch (error) {
      console.error('[Conversations] Error selecting all from filter:', error);
      toast({
        title: "Error",
        description: "Failed to load all conversations. Try selecting page by page.",
        variant: "destructive"
      });
    }
  };

  const toggleContact = (senderId: string) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(senderId)) {
      newSelection.delete(senderId);
    } else {
      newSelection.add(senderId);
    }
    setSelectedContacts(newSelection);
  };

  const handleScoreLeads = async () => {
    if (selectedContacts.size === 0) {
      toast({
        title: "No Contacts Selected",
        description: "Please select contacts to score.",
        variant: "destructive"
      });
      return;
    }
    
    setIsScoringLeads(true);
    
    try {
      const selectedPage = pages.find(p => p.facebook_page_id === selectedPageId) || pages[0];
      
      const response = await fetch('/api/ai/score-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationIds: Array.from(selectedContacts),
          pageId: selectedPage?.id,
          autoTag: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to score leads');
      }

      const data = await response.json();
      
      const hotCount = data.scores.filter((s: any) => s.quality === 'Hot').length;
      const warmCount = data.scores.filter((s: any) => s.quality === 'Warm').length;
      const coldCount = data.scores.filter((s: any) => s.quality === 'Cold').length;
      
      toast({
        title: "Lead Scoring Complete!",
        description: `Analyzed ${data.scored} leads. Hot: ${hotCount}, Warm: ${warmCount}, Cold: ${coldCount}. Tags applied automatically.`,
        duration: 5000
      });
      
      // Refresh conversations to show new tags
      await refetch();
      
    } catch (error) {
      toast({
        title: "Scoring Error",
        description: error instanceof Error ? error.message : 'Failed to score leads',
        variant: "destructive"
      });
    } finally {
      setIsScoringLeads(false);
    }
  };

  const handleCreateOpportunities = () => {
    if (selectedContacts.size === 0) {
      toast({
        title: "No Contacts Selected",
        description: "Please select at least one contact to create opportunities.",
        variant: "destructive"
      });
      return;
    }

    // Store selected contacts in sessionStorage
    const selectedArray = Array.from(selectedContacts);
    const contactsData = selectedArray.map(sender_id => {
      const conv = conversations.find(c => c.sender_id === sender_id);
      return {
        sender_id,
        sender_name: conv?.sender_name || `User ${sender_id.substring(0, 8)}`,
        page_id: conv?.page_id || ''
      };
    });

    const selectedPage = selectedPageId === 'all'
      ? null
      : pages.find(p => p.facebook_page_id === selectedPageId);

    // Also store full conversation data for AI classification
    const fullContactsData = selectedArray.map(sender_id => {
      const conv = conversations.find(c => c.sender_id === sender_id);
      return {
        id: conv?.id || '',
        sender_id,
        sender_name: conv?.sender_name || `User ${sender_id.substring(0, 8)}`,
        page_id: conv?.page_id || ''
      };
    });

    sessionStorage.setItem('opportunityContacts', JSON.stringify({
      contacts: contactsData,
      pageId: selectedPage?.id ?? null,
      facebookPageId: selectedPage?.facebook_page_id ?? null
    }));
    sessionStorage.setItem('opportunityContactsFull', JSON.stringify(fullContactsData));

    toast({
      title: "Contacts Loaded",
      description: `Ready to create ${selectedContacts.size} opportunit${selectedContacts.size === 1 ? 'y' : 'ies'}`,
      duration: 2000
    });

    router.push('/dashboard/pipeline/bulk-create');
  };

  const handleSendToSelected = async () => {
    if (selectedContacts.size === 0) {
      toast({
        title: "No Contacts Selected",
        description: "Please select at least one contact to send messages to.",
        variant: "destructive"
      });
      return;
    }

    try {
      const selectedPage = selectedPageId === 'all'
        ? null
        : pages.find(p => p.facebook_page_id === selectedPageId);

      // Fetch ALL selected conversations (not just current page)
      // We need to get the full conversation data for all selected sender_ids
      const params = new URLSearchParams();
      if (selectedPageId !== 'all') params.append('facebookPageId', selectedPageId);
      params.append('limit', String(selectedContacts.size)); // Get all selected
      
      const response = await fetch(`/api/conversations?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();

      // Filter to only the ones we selected
      const allConversations = data.conversations || [];
      const selected = allConversations.filter((c: Conversation) => 
        selectedContacts.has(c.sender_id)
      );

      // If we didn't get all selected contacts, we need to fetch more pages
      if (selected.length < selectedContacts.size) {
        console.log('[Conversations] Need to fetch more pages. Got', selected.length, 'of', selectedContacts.size);
        
        // Fallback: Create minimal contact data from selected IDs
        const selectedArray = Array.from(selectedContacts);
        const minimalContacts = selectedArray.map(sender_id => {
          // Try to find in current data
          const existing = [...allConversations, ...conversations].find((c: Conversation) => c.sender_id === sender_id);
          return {
            sender_id,
            sender_name: existing?.sender_name || `User ${sender_id.substring(0, 8)}`
          };
        });

        sessionStorage.setItem('selectedContacts', JSON.stringify({
          contacts: minimalContacts,
          pageId: selectedPage?.id ?? null,
          facebookPageId: selectedPage?.facebook_page_id ?? null
        }));
      } else {
        // We have all the data we need
        sessionStorage.setItem('selectedContacts', JSON.stringify({
          contacts: selected.map((c: Conversation) => ({
            sender_id: c.sender_id,
            sender_name: c.sender_name
          })),
          pageId: selectedPage?.id ?? null,
          facebookPageId: selectedPage?.facebook_page_id ?? null
        }));
      }

      toast({
        title: "Contacts Loaded",
        description: `Preparing to message ${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''}`,
        duration: 2000
      });

      router.push('/dashboard/compose');
    } catch (error) {
      console.error('[Conversations] Error preparing selected contacts:', error);
      toast({
        title: "Error",
        description: "Failed to load selected contacts. Please try again.",
        variant: "destructive"
      });
    }
  };

  function getPageName(pageId: string) {
    const page = pages.find(p => p.facebook_page_id === pageId);
    return page?.name || 'Unknown Page';
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'blocked': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Use total from pagination, not just current page
  const activeCount = conversations.filter(c => c.conversation_status === 'active').length;
  const isSyncAffectingSelectedPage =
    syncInProgress &&
    syncTargetPageId !== null &&
    (selectedPageId === 'all' || selectedPageId === syncTargetPageId);

  const syncTotalProgress = syncBaselineCount + realtimeStats.inserts;
  const syncTargetPageName = syncTargetPageId ? getPageName(syncTargetPageId) : null;

  const totalCount = isSyncAffectingSelectedPage ? syncTotalProgress : pagination.total;
  const activeCountDisplay = isSyncAffectingSelectedPage
    ? activeCount + realtimeStats.inserts
    : activeCount;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Conversations & Leads</h1>
          <p className="text-muted-foreground">
            View and manage people who messaged your Facebook pages
          </p>
        </div>
        <div className="flex gap-3">
          {selectedContacts.size > 0 && (
            <>
              <Button 
                onClick={handleScoreLeads}
                disabled={isScoringLeads}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg"
              >
                {isScoringLeads ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Scoring {selectedContacts.size} lead{selectedContacts.size !== 1 ? 's' : ''}...
                  </>
                ) : (
                  <>
                    <Target className="mr-2 w-4 h-4" />
                    Score {selectedContacts.size} Lead{selectedContacts.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
              <Button 
                onClick={handleSendToSelected}
                className="bg-green-600 hover:bg-green-700"
              >
                <Send className="mr-2 w-4 h-4" />
                Send to {selectedContacts.size} Selected
              </Button>
              <Button 
                onClick={handleCreateOpportunities}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <TrendingUp className="mr-2 w-4 h-4" />
                Create {selectedContacts.size} Opportunit{selectedContacts.size === 1 ? 'y' : 'ies'}
              </Button>
              <Button 
                onClick={() => setIsBulkTagDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <TagIcon className="mr-2 w-4 h-4" />
                Tag {selectedContacts.size} Selected
              </Button>
            </>
          )}
          <Button 
            onClick={handleSync}
            disabled={syncMutation.isPending || selectedPageId === 'all'}
            className="bg-[#1877f2] hover:bg-[#166fe5]"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Syncing... {realtimeStats.inserts + realtimeStats.updates > 0 && `(${realtimeStats.inserts + realtimeStats.updates})`}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 w-4 h-4" />
                Sync from Facebook
              </>
            )}
          </Button>
        </div>
      </div>

      {syncInProgress && syncTargetPageId && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900">
                Syncing {syncTargetPageName || 'Facebook Page'}...
              </p>
              <p className="text-sm text-blue-800 mt-1">
                Inserted {realtimeStats.inserts} • Updated {realtimeStats.updates}
              </p>
              <p className="text-xs text-blue-700 mt-2">
                Starting count: {syncBaselineCount} • Total so far: {syncTotalProgress}
              </p>
            </div>
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          </CardContent>
        </Card>
      )}

      {!syncInProgress && lastSyncSummary && lastSyncSummary.pageId === selectedPageId && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-green-900">
              Last sync ({lastSyncSummary.pageName})
            </p>
            <p className="text-sm text-green-800 mt-1">
              Inserted {lastSyncSummary.inserted} • Updated {lastSyncSummary.updated} • Total touched {lastSyncSummary.total}
            </p>
            <p className="text-xs text-green-700 mt-2">
              {formatDistanceToNow(new Date(lastSyncSummary.timestamp), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Conversations</p>
                <p className="text-3xl font-bold mt-2">{totalCount}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <MessageSquare className="w-6 h-6 text-[#1877f2]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Conversations</p>
                <p className="text-3xl font-bold mt-2">{activeCountDisplay}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Selected Contacts</p>
                <p className="text-3xl font-bold mt-2">{selectedContacts.size}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedContacts.size > 0 
                    ? `${Math.ceil(selectedContacts.size / 100)} batch${selectedContacts.size > 100 ? 'es' : ''} • Unlimited`
                    : `Unlimited contacts`}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Send className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selection Info */}
      {selectedContacts.size > 0 && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                  {selectedContacts.size}
                </div>
                <div>
                  <p className="font-semibold text-purple-900">
                    {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-sm text-purple-700">
                    {Math.ceil(selectedContacts.size / 100)} batch{selectedContacts.size > 100 ? 'es' : ''} will be created
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedContacts(new Set())}
                className="border-purple-300 text-purple-700 hover:bg-purple-100"
              >
                Clear All Selections
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter conversations by page, date, and keywords</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
          </CardHeader>
          <CardContent>
            {(startDate || endDate) && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>📅 Date Filter Active:</strong>
                  {startDate && endDate && ` Showing messages from ${startDate} to ${endDate}`}
                  {startDate && !endDate && ` Showing messages from ${startDate} onwards`}
                  {!startDate && endDate && ` Showing messages until ${endDate}`}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Page Filter */}
            <div>
              <Label htmlFor="page-filter">Facebook Page</Label>
              <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                <SelectTrigger id="page-filter" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pages</SelectItem>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.facebook_page_id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div>
              <Label htmlFor="start-date">From Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || undefined}
                className="mt-2"
                placeholder="Select start date"
              />
              <p className="text-xs text-muted-foreground mt-1">Messages from this date onwards</p>
            </div>

            {/* End Date */}
            <div>
              <Label htmlFor="end-date">To Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="mt-2"
                placeholder="Select end date"
              />
              <p className="text-xs text-muted-foreground mt-1">Messages until this date</p>
            </div>

            {/* Search */}
            <div>
              <Label htmlFor="search">Search Contacts</Label>
              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setCurrentPage(1); // Reset to first page on search
                      }
                    }}
                    placeholder="Search by name, sender ID, or message content..."
                    className="pl-10"
                  />
                </div>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  onClick={() => setCurrentPage(1)}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!searchQuery.trim()}
                >
                  <Search className="mr-2 w-4 h-4" />
                  Search
                </Button>
              </div>
              {searchQuery && (
                <p className="text-xs text-muted-foreground mt-1">
                  Searching for: &quot;{searchQuery}&quot;
                </p>
              )}
            </div>
          </div>

          {/* Tag Filter */}
          <div className="mt-4">
            <Label>Filter by Tags</Label>
            <div className="mt-2">
              <TagFilter
                selectedTagIds={selectedTagIds}
                onTagChange={setSelectedTagIds}
                exceptTagIds={exceptTagIds}
                onExceptChange={setExceptTagIds}
              />
            </div>
          </div>

          {/* Quick Lead Quality Filters */}
          <div className="mt-4">
            <Label className="mb-3 block">Quick Lead Quality Filters</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tag = tags.find(t => t.name === '🔥 Hot Lead');
                  if (tag) {
                    setSelectedTagIds([tag.id]);
                    setExceptTagIds([]);
                  }
                }}
                className="border-red-300 hover:bg-red-50"
              >
                <Flame className="mr-1 w-3 h-3 text-red-500" />
                Hot Leads Only
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tag = tags.find(t => t.name === '🟠 Warm Lead');
                  if (tag) {
                    setSelectedTagIds([tag.id]);
                    setExceptTagIds([]);
                  }
                }}
                className="border-orange-300 hover:bg-orange-50"
              >
                <TrendingUp className="mr-1 w-3 h-3 text-orange-500" />
                Warm Leads
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tag = tags.find(t => t.name === '🟡 Cold Lead');
                  if (tag) {
                    setSelectedTagIds([tag.id]);
                    setExceptTagIds([]);
                  }
                }}
                className="border-yellow-300 hover:bg-yellow-50"
              >
                <Snowflake className="mr-1 w-3 h-3 text-yellow-500" />
                Cold Leads
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tag = tags.find(t => t.name === '💰 Price Shopper');
                  if (tag) {
                    setSelectedTagIds([]);
                    setExceptTagIds([tag.id]);
                  }
                }}
                className="border-purple-300 hover:bg-purple-50"
              >
                <DollarSign className="mr-1 w-3 h-3 text-purple-500" />
                Exclude Price Shoppers
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tag = tags.find(t => t.name === '⚪ Unqualified');
                  if (tag) {
                    setSelectedTagIds([]);
                    setExceptTagIds([tag.id]);
                  }
                }}
                className="border-gray-300 hover:bg-gray-50"
              >
                <AlertCircle className="mr-1 w-3 h-3 text-gray-500" />
                Exclude Unqualified
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Click any button to quickly filter conversations by lead quality
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Conversations ({searchQuery ? displayConversations.length : totalCount})
              </CardTitle>
              <CardDescription>
                {searchQuery 
                  ? `${displayConversations.length} results on this page` 
                  : `Select contacts to send messages to`}
              </CardDescription>
            </div>
            {displayConversations.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={handleSelectAllOnPage}
                    id="select-all-page"
                  />
                  <Label htmlFor="select-all-page" className="text-sm cursor-pointer">
                    Select All on Page ({displayConversations.length})
                  </Label>
                </div>
                {totalCount > ITEMS_PER_PAGE && (startDate || endDate || selectedPageId !== 'all' || selectedTagIds.length > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllFromFilter}
                    className="whitespace-nowrap"
                  >
                    📋 Select All {totalCount} from Filters
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Quick Search Bar in Conversations Header */}
          <div className="flex gap-2 items-center pt-4 border-t">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentPage(1);
                  }
                }}
                placeholder="🔍 Search contacts: name, ID, or message content..."
                className="pl-10"
              />
            </div>
            {searchQuery && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                >
                  <X className="mr-1 w-4 h-4" />
                  Clear
                </Button>
                <Badge className="bg-blue-100 text-blue-700 px-3 py-1.5">
                  {displayConversations.length} found
                </Badge>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {conversationsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : displayConversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {totalCount === 0 ? 'No conversations yet' : 'No results found'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {totalCount === 0
                  ? selectedPageId === 'all'
                    ? 'Select a page and click "Sync from Facebook" to load conversations'
                    : 'Click "Sync from Facebook" to load conversations for this page'
                  : 'Try adjusting your filters'}
              </p>
              {selectedPageId !== 'all' && totalCount === 0 && (
                <Button 
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="bg-[#1877f2] hover:bg-[#166fe5]"
                >
                  {syncMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Syncing... {realtimeStats.inserts + realtimeStats.updates > 0 && 
                        <span className="ml-2 font-bold text-blue-600">
                          ({realtimeStats.inserts + realtimeStats.updates} synced)
                        </span>
                      }
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 w-4 h-4" />
                      Sync from Facebook
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {displayConversations.map((conv) => {
                  const isSelected = selectedContacts.has(conv.sender_id);

                  return (
                    <div
                      key={conv.id}
                      className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                        isSelected ? 'border-[#1877f2] bg-blue-50' : 'hover:bg-accent'
                      }`}
                      onClick={() => toggleContact(conv.sender_id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleContact(conv.sender_id)}
                      />

                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-[#1877f2] text-white">
                          {conv.sender_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold truncate">
                            {conv.sender_name || 'Facebook User'}
                          </h4>
                          <Badge className={getStatusColor(conv.conversation_status)}>
                            {conv.conversation_status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.last_message || 'No message preview'}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {getPageName(conv.page_id)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(conv.last_message_time), 'MMM dd, yyyy h:mm a')}
                          </span>
                          <span>•</span>
                          <span>{conv.message_count} message(s)</span>
                        </div>
                        
                        {/* Conversation Tags */}
                        <div className="mt-2">
                          <ConversationTags conversationId={conv.id} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Find the internal page UUID from the facebook_page_id
                            const pageUuid = pages.find(p => p.facebook_page_id === conv.page_id)?.id;
                            
                            sessionStorage.setItem('opportunityContact', JSON.stringify({
                              sender_id: conv.sender_id,
                              sender_name: conv.sender_name,
                              page_id: conv.page_id,
                              pageUuid: pageUuid
                            }));
                            router.push('/dashboard/pipeline/new');
                          }}
                          className="whitespace-nowrap"
                        >
                          <TrendingUp className="w-4 h-4 mr-1" />
                          Add to Pipeline
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          ID: {conv.sender_id.substring(0, 12)}...
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} • 
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} total conversations
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrev || conversationsLoading}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                        let pageNum: number;
                        if (pagination.pages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.pages - 2) {
                          pageNum = pagination.pages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pagination.page === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-10"
                            disabled={conversationsLoading}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                      disabled={!pagination.hasNext || conversationsLoading}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-[#1877f2] p-3 rounded-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">How to send messages to your leads</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Select a Facebook page from the filter to see its conversations</li>
                  <li>Click &quot;Sync from Facebook&quot; to load latest conversations</li>
                  <li>Check the boxes next to contacts you want to message</li>
                  <li>Click &quot;Send to X Selected&quot; button</li>
                  <li>You&apos;ll be taken to Compose page with selected contacts</li>
                  <li>Write your message and send!</li>
                </ol>
                <p className="mt-3 font-medium">
                  💡 Tip: Use date filters to find recent conversations, or search to find specific people.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Tag Management Dialog */}
      <Dialog open={isBulkTagDialogOpen} onOpenChange={setIsBulkTagDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage Tags for Selected Conversations</DialogTitle>
            <DialogDescription>
              Update tags for {selectedContacts.size} selected conversation{selectedContacts.size !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Action Selector */}
            <div>
              <Label htmlFor="tag-action">Action</Label>
              <Select value={bulkTagAction} onValueChange={(value) => setBulkTagAction(value as 'assign' | 'remove' | 'replace')}>
                <SelectTrigger id="tag-action" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assign">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-green-600" />
                      <div>
                        <div className="font-medium">Add Tags</div>
                        <div className="text-xs text-muted-foreground">Add tags while keeping existing ones</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="remove">
                    <div className="flex items-center gap-2">
                      <X className="w-4 h-4 text-red-600" />
                      <div>
                        <div className="font-medium">Remove Tags</div>
                        <div className="text-xs text-muted-foreground">Remove specific tags or all tags</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="replace">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-medium">Replace Tags</div>
                        <div className="text-xs text-muted-foreground">Remove all tags and add selected ones</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tag Selector */}
            <div>
              <Label>
                {bulkTagAction === 'assign' && 'Select tags to add'}
                {bulkTagAction === 'remove' && 'Select tags to remove (or none for all)'}
                {bulkTagAction === 'replace' && 'Select new tags'}
              </Label>
              <div className="mt-2">
                <TagSelector
                  selectedTagIds={bulkTagIds}
                  onTagChange={setBulkTagIds}
                />
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-muted p-3 rounded-lg text-sm">
              {bulkTagAction === 'assign' && (
                <p>Selected tags will be <strong className="text-green-600">added</strong> to the conversations. Existing tags will not be removed.</p>
              )}
              {bulkTagAction === 'remove' && bulkTagIds.length > 0 && (
                <p>Selected tags will be <strong className="text-red-600">removed</strong> from the conversations. Other tags will remain.</p>
              )}
              {bulkTagAction === 'remove' && bulkTagIds.length === 0 && (
                <p className="text-red-600"><strong>All tags</strong> will be removed from the selected conversations.</p>
              )}
              {bulkTagAction === 'replace' && (
                <p>All existing tags will be removed and <strong className="text-blue-600">replaced</strong> with the selected tags.</p>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBulkTagDialogOpen(false);
                  setBulkTagIds([]);
                  setBulkTagAction('assign');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkTagAssignment}
                disabled={bulkTagMutation.isPending}
                className={
                  bulkTagAction === 'assign' ? 'bg-green-600 hover:bg-green-700' :
                  bulkTagAction === 'remove' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }
              >
                {bulkTagMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {bulkTagAction === 'assign' && 'Add Tags'}
                    {bulkTagAction === 'remove' && 'Remove Tags'}
                    {bulkTagAction === 'replace' && 'Replace Tags'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
