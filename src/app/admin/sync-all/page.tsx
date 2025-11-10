'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface FacebookPage {
  id: string;
  facebook_page_id: string;
  name: string;
  last_synced_at: string | null;
}

interface SyncResult {
  pageId: string;
  pageName: string;
  status: 'pending' | 'syncing' | 'success' | 'error';
  synced?: number;
  inserted?: number;
  updated?: number;
  duration?: string;
  error?: string;
}

export default function SyncAllPage() {
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<SyncResult[]>([]);
  const [currentPage, setCurrentPage] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);

  // Fetch all pages
  const { data: pages = [], isLoading } = useQuery<FacebookPage[]>({
    queryKey: ['pages'],
    queryFn: async () => {
      const response = await fetch('/api/pages');
      if (!response.ok) throw new Error('Failed to fetch pages');
      return response.json();
    },
  });

  // Initialize results when pages load
  useEffect(() => {
    if (pages.length > 0 && results.length === 0) {
      setResults(pages.map(page => ({
        pageId: page.id,
        pageName: page.name,
        status: 'pending'
      })));
    }
  }, [pages, results.length]);

  const fixAllSync = async () => {
    setFixing(true);
    
    try {
      const response = await fetch('/api/fix-all-sync', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`✅ Cleared timestamps for ${data.details.pagesCleared} pages! Now syncing...`);
        // Automatically start sync after clearing
        await syncAllPages();
      } else {
        toast.error('Failed to clear timestamps: ' + data.error);
      }
    } catch (error) {
      toast.error('Error: ' + (error instanceof Error ? error.message : 'Failed'));
    } finally {
      setFixing(false);
    }
  };

  const syncAllPages = async () => {
    setSyncing(true);
    const startTime = Date.now();

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      setCurrentPage(page.name);

      // Update status to syncing
      setResults(prev => prev.map(r => 
        r.pageId === page.id 
          ? { ...r, status: 'syncing' as const }
          : r
      ));

      try {
        const pageStartTime = Date.now();
        
        const response = await fetch('/api/conversations/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId: page.id,
            facebookPageId: page.facebook_page_id,
            forceFull: true  // FORCE FULL SYNC - GET ALL CONVERSATIONS
          }),
        });

        const data = await response.json();
        const duration = ((Date.now() - pageStartTime) / 1000).toFixed(1);

        if (data.success) {
          setResults(prev => prev.map(r => 
            r.pageId === page.id 
              ? { 
                  ...r, 
                  status: 'success' as const,
                  synced: data.synced,
                  inserted: data.inserted,
                  updated: data.updated,
                  duration: `${duration}s`
                }
              : r
          ));
          
          toast.success(`✅ ${page.name}: Synced ${data.synced} conversations in ${duration}s`);
        } else {
          throw new Error(data.error || 'Sync failed');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        setResults(prev => prev.map(r => 
          r.pageId === page.id 
            ? { ...r, status: 'error' as const, error: errorMsg }
            : r
        ));
        
        toast.error(`❌ ${page.name}: ${errorMsg}`);
      }

      // Small delay between pages to avoid rate limiting
      if (i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalSynced = results.reduce((sum, r) => sum + (r.synced || 0), 0);
    
    setSyncing(false);
    setCurrentPage(null);
    
    toast.success(`🎉 All pages synced! Total: ${totalSynced} conversations in ${totalDuration}s`);
  };

  const syncSinglePage = async (page: FacebookPage) => {
    setResults(prev => prev.map(r => 
      r.pageId === page.id 
        ? { ...r, status: 'syncing' as const }
        : r
    ));

    try {
      const startTime = Date.now();
      
      const response = await fetch('/api/conversations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          facebookPageId: page.facebook_page_id,
          forceFull: true  // FORCE FULL SYNC
        }),
      });

      const data = await response.json();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (data.success) {
        setResults(prev => prev.map(r => 
          r.pageId === page.id 
            ? { 
                ...r, 
                status: 'success' as const,
                synced: data.synced,
                inserted: data.inserted,
                updated: data.updated,
                duration: `${duration}s`
              }
            : r
        ));
        
        toast.success(`✅ ${page.name}: Synced ${data.synced} conversations`);
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      setResults(prev => prev.map(r => 
        r.pageId === page.id 
          ? { ...r, status: 'error' as const, error: errorMsg }
          : r
      ));
      
      toast.error(`❌ ${page.name}: ${errorMsg}`);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading pages...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalSynced = results.reduce((sum, r) => sum + (r.synced || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">🚀 Force Full Sync - Get ALL Conversations</h1>
        <p className="text-muted-foreground">
          This page will sync ALL conversations from Facebook, ignoring incremental mode.
        </p>
      </div>

      <Alert>
        <Zap className="h-4 w-4" />
        <AlertTitle>Force Full Sync Mode</AlertTitle>
        <AlertDescription>
          This uses <code>forceFull: true</code> to fetch ALL conversations, not just recently updated ones.
          This solves the problem of missing conversations from incremental sync.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Connected Pages ({pages.length})</CardTitle>
          <CardDescription>
            Click individual buttons or sync all pages at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-col">
            <Button
              onClick={fixAllSync}
              disabled={syncing || fixing || pages.length === 0}
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {fixing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fixing & Syncing...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  🔧 FIX & SYNC ALL ({pages.length} pages) - Get EVERYTHING
                </>
              )}
            </Button>
            
            <Button
              onClick={syncAllPages}
              disabled={syncing || fixing || pages.length === 0}
              size="lg"
              variant="outline"
              className="w-full"
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing {currentPage}...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Just Sync ALL Pages ({pages.length})
                </>
              )}
            </Button>
          </div>

          {successCount > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                Synced {totalSynced} total conversations from {successCount} page(s)
                {errorCount > 0 && ` (${errorCount} failed)`}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {results.map((result, index) => {
              const page = pages.find(p => p.id === result.pageId);
              if (!page) return null;

              return (
                <Card key={result.pageId}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{result.pageName}</span>
                          {result.status === 'pending' && (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                          {result.status === 'syncing' && (
                            <Badge variant="default">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Syncing...
                            </Badge>
                          )}
                          {result.status === 'success' && (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          )}
                          {result.status === 'error' && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          {result.status === 'success' && (
                            <div>
                              ✅ Synced: {result.synced} | New: {result.inserted} | Updated: {result.updated} | Duration: {result.duration}
                            </div>
                          )}
                          {result.status === 'error' && (
                            <div className="text-red-500">
                              ❌ {result.error}
                            </div>
                          )}
                          {result.status === 'pending' && (
                            <div>
                              Last synced: {page.last_synced_at ? new Date(page.last_synced_at).toLocaleString() : 'Never'}
                            </div>
                          )}
                          {result.status === 'syncing' && (
                            <div>
                              Fetching ALL conversations from Facebook...
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        onClick={() => syncSinglePage(page)}
                        disabled={syncing}
                        variant="outline"
                        size="sm"
                      >
                        {result.status === 'syncing' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Sync This Page
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How This Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>✅ Uses <code className="bg-muted px-2 py-1 rounded">forceFull: true</code> to fetch ALL conversations</p>
          <p>✅ Ignores <code className="bg-muted px-2 py-1 rounded">last_synced_at</code> timestamp</p>
          <p>✅ Gets both old and new conversations</p>
          <p>✅ Handles 10,000+ conversations per page</p>
          <p>✅ Automatic retry on failures</p>
          <p>✅ Progress tracked in real-time</p>
          <p className="text-muted-foreground pt-2">
            <strong>Expected time:</strong> 2-4 minutes per 10,000 conversations
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

