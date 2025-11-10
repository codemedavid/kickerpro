'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Facebook, Plus, Trash2, Users, TrendingUp, CheckCircle, Loader2, Search, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { useAutoFetchStore } from '@/store/auto-fetch-store';
import { SyncButton } from '@/components/conversations/SyncButton';

interface FacebookPage {
  id: string;
  facebook_page_id: string;
  name: string;
  category: string | null;
  profile_picture: string | null;
  follower_count: number | null;
  is_active: boolean;
  created_at: string;
}

interface FacebookPageFromAPI {
  id: string;
  name: string;
  category?: string;
  access_token: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
  fan_count?: number;
}

export default function FacebookPagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { isEnabled: isAutoFetchEnabled, intervalMs } = useAutoFetchStore();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [availablePages, setAvailablePages] = useState<FacebookPageFromAPI[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [isFetchingPages, setIsFetchingPages] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState('');

  const { data: pages = [], isLoading } = useQuery<FacebookPage[]>({
    queryKey: ['pages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pages');
      if (!response.ok) throw new Error('Failed to fetch pages');
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: isAutoFetchEnabled ? intervalMs : false, // Auto-fetch when enabled
  });

  const deleteMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const { error } = await supabase
        .from('facebook_pages')
        .delete()
        .eq('id', pageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast({
        title: "Success",
        description: "Page disconnected successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect page",
        variant: "destructive"
      });
    }
  });

  const connectMutation = useMutation({
    mutationFn: async (pagesToConnect: FacebookPageFromAPI[]) => {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: pagesToConnect })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect pages');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      
      toast({
        title: "Success!",
        description: `Connected ${data.connected} page(s) successfully`
      });
      
      setConnectDialogOpen(false);
      setSelectedPageIds(new Set());
      setAvailablePages([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to connect pages",
        variant: "destructive"
      });
    }
  });

  const handleFetchPages = async () => {
    setIsFetchingPages(true);
    try {
      console.log('[Pages] Fetching pages from Facebook API...');
      
      const response = await fetch('/api/facebook/pages');
      const data = await response.json();

      console.log('[Pages] API response:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch pages');
      }

      const fetchedPages: FacebookPageFromAPI[] = data.pages || [];
      console.log('[Pages] Fetched', fetchedPages.length, 'pages');
      
      if (fetchedPages.length === 0) {
        toast({
          title: "No Pages Found",
          description: "You don't have any Facebook pages or don't have admin access to them.",
        });
      } else {
        setAvailablePages(fetchedPages);
        setConnectDialogOpen(true);
      }
    } catch (error) {
      console.error('[Pages] Error fetching pages:', error);
      toast({
        title: "Error Fetching Pages",
        description: error instanceof Error ? error.message : "Failed to fetch Facebook pages. Make sure you're logged in.",
        variant: "destructive"
      });
    } finally {
      setIsFetchingPages(false);
    }
  };

  const handleConnectSelected = () => {
    const pagesToConnect = availablePages.filter(p => selectedPageIds.has(p.id));
    
    if (pagesToConnect.length === 0) {
      toast({
        title: "No Pages Selected",
        description: "Please select at least one page to connect.",
        variant: "destructive"
      });
      return;
    }

    console.log('[Pages] Connecting', pagesToConnect.length, 'pages...');
    connectMutation.mutate(pagesToConnect);
  };

  const togglePageSelection = (pageId: string) => {
    const newSelection = new Set(selectedPageIds);
    if (newSelection.has(pageId)) {
      newSelection.delete(pageId);
    } else {
      newSelection.add(pageId);
    }
    setSelectedPageIds(newSelection);
  };

  const activePagesCount = pages.filter(p => p.is_active).length;
  const totalFollowers = pages.reduce((sum, p) => sum + (p.follower_count || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Facebook Pages</h1>
          <p className="text-muted-foreground">
            Manage your connected Facebook pages
          </p>
        </div>
        <Button 
          onClick={handleFetchPages} 
          className="bg-[#1877f2] hover:bg-[#166fe5]"
          disabled={isFetchingPages}
        >
          {isFetchingPages ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Plus className="mr-2 w-4 h-4" />
              Connect Page
            </>
          )}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pages</p>
                <p className="text-3xl font-bold mt-2">{pages.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Facebook className="w-6 h-6 text-[#1877f2]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Pages</p>
                <p className="text-3xl font-bold mt-2">{activePagesCount}</p>
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
                <p className="text-sm text-muted-foreground">Total Followers</p>
                <p className="text-3xl font-bold mt-2">{totalFollowers.toLocaleString()}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pages List */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Pages</CardTitle>
          <CardDescription>
            Manage and monitor your Facebook pages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12">
              <Facebook className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pages connected</h3>
              <p className="text-muted-foreground mb-6">
                Connect your first Facebook page to start sending messages
              </p>
              <Button 
                onClick={handleFetchPages} 
                className="bg-[#1877f2] hover:bg-[#166fe5]"
                disabled={isFetchingPages}
              >
                {isFetchingPages ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Loading Pages...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 w-4 h-4" />
                    Connect Your First Page
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="flex flex-col gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={page.profile_picture || undefined} />
                        <AvatarFallback className="bg-[#1877f2] text-white text-xl">
                          {page.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{page.name}</h3>
                          {page.is_active ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {page.category && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4" />
                              {page.category}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {page.follower_count?.toLocaleString() || 0} followers
                          </span>
                        </div>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Page?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to disconnect {page.name}? This will remove all 
                            associated messages and data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(page.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Sync Button with Stats */}
                  <div className="ml-20">
                    <SyncButton
                      pageId={page.id}
                      facebookPageId={page.facebook_page_id}
                      pageName={page.name}
                      lastSyncedAt={page.last_synced_at}
                      onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['pages'] })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect Pages Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={(open) => {
        setConnectDialogOpen(open);
        if (!open) setPageSearchQuery(''); // Clear search on close
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connect Facebook Pages</DialogTitle>
            <DialogDescription>
              Select the Facebook pages you want to connect to your account
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar for Pages */}
          {availablePages.length > 0 && (
            <div className="flex gap-2 items-center mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={pageSearchQuery}
                  onChange={(e) => setPageSearchQuery(e.target.value)}
                  placeholder="🔍 Search Facebook pages by name..."
                  className="pl-10"
                />
              </div>
              {pageSearchQuery && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageSearchQuery('')}
                  >
                    <X className="mr-1 w-4 h-4" />
                    Clear
                  </Button>
                  <Badge variant="secondary" className="px-3">
                    {availablePages.filter(p => 
                      p.name.toLowerCase().includes(pageSearchQuery.toLowerCase())
                    ).length} found
                  </Badge>
                </>
              )}
            </div>
          )}

          <div className="space-y-3 mt-4">
            {availablePages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No pages available</p>
              </div>
            ) : (
              availablePages
                .filter(page => 
                  !pageSearchQuery || 
                  page.name.toLowerCase().includes(pageSearchQuery.toLowerCase())
                )
                .map((page) => {
                const isSelected = selectedPageIds.has(page.id);
                const isAlreadyConnected = pages.some(p => p.facebook_page_id === page.id);

                return (
                  <div
                    key={page.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                      isSelected ? 'border-[#1877f2] bg-blue-50' : 'hover:bg-accent'
                    } ${isAlreadyConnected ? 'opacity-50' : ''}`}
                    onClick={() => !isAlreadyConnected && togglePageSelection(page.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isAlreadyConnected}
                      onCheckedChange={() => togglePageSelection(page.id)}
                    />
                    
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={page.picture?.data?.url} />
                      <AvatarFallback className="bg-[#1877f2] text-white">
                        {page.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{page.name}</h4>
                        {isAlreadyConnected && (
                          <Badge variant="secondary" className="text-xs">
                            Already Connected
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {page.category && (
                          <span>{page.category}</span>
                        )}
                        <span>•</span>
                        <span>{page.fan_count?.toLocaleString() || 0} followers</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={handleConnectSelected}
              disabled={selectedPageIds.size === 0 || connectMutation.isPending}
              className="flex-1 bg-[#1877f2] hover:bg-[#166fe5]"
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Connect {selectedPageIds.size} Page{selectedPageIds.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConnectDialogOpen(false)}
              disabled={connectMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-[#1877f2] p-3 rounded-lg">
              <Facebook className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">How to connect pages</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Click the &quot;Connect Page&quot; button above. You&apos;ll see a list of Facebook pages 
                where you have admin access. Select the pages you want to connect and click confirm.
              </p>
              <div className="space-y-2 text-sm">
                <p className="font-medium">Required Permissions:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>pages_manage_posts - Post to your pages</li>
                  <li>pages_read_engagement - Read page engagement</li>
                  <li>pages_messaging - Send messages</li>
                  <li>pages_show_list - Access page list</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
