'use client';

import { useState, useRef } from 'react';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RealtimeSyncButtonProps {
  pageId: string;
  facebookPageId: string;
  pageName: string;
  lastSyncedAt?: string | null;
  hasCheckpoint?: boolean;
  onSyncComplete?: () => void;
}

interface SyncProgress {
  status: 'processing' | 'complete' | 'error' | 'resuming';
  message: string;
  current: number;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  eventsCreated: number;
  conversationName?: string;
  error?: string;
}

export function RealtimeSyncButton({ 
  pageId, 
  facebookPageId, 
  pageName, 
  lastSyncedAt,
  hasCheckpoint = false,
  onSyncComplete 
}: RealtimeSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const handleSync = async (resume: boolean = false, autoRetry: boolean = true) => {
    setIsSyncing(true);
    setShowProgress(true);
    setProgress({
      status: 'processing',
      message: 'Connecting to Facebook...',
      current: 0,
      total: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      eventsCreated: 0
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/conversations/sync-realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, facebookPageId, resume }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to start sync');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6)) as SyncProgress;
            setProgress(data);

            if (data.status === 'complete') {
              toast({
                title: "✅ Sync Complete!",
                description: (
                  <div className="space-y-1">
                    <p className="font-semibold">{pageName}</p>
                    <div className="text-sm space-y-0.5">
                      <p className="text-green-600">✓ {data.inserted} new conversations</p>
                      <p className="text-blue-600">↻ {data.updated} updated</p>
                      {data.eventsCreated > 0 && (
                        <p className="text-purple-600">📊 {data.eventsCreated} events tracked</p>
                      )}
                      <p className="text-muted-foreground">Total: {data.current} conversations</p>
                    </div>
                  </div>
                ),
                duration: 6000
              });

              if (onSyncComplete) {
                onSyncComplete();
              }

              // Auto-hide after 15 seconds
              setTimeout(() => setShowProgress(false), 15000);
            } else if (data.status === 'error') {
              // Auto-resume on timeout error
              if (data.error === 'timeout' && autoRetry) {
                console.log('[Auto Resume] Timeout detected, auto-resuming in 2 seconds...');
                toast({
                  title: "🔄 Auto-Resuming...",
                  description: (
                    <div className="space-y-1">
                      <p>Sync timeout - automatically resuming...</p>
                      <p className="text-sm">Progress: {data.inserted} new, {data.updated} updated</p>
                    </div>
                  ),
                  duration: 3000
                });

                // Wait 2 seconds then auto-resume
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Recursive call to resume automatically
                await handleSync(true, true);
                return; // Exit this iteration
              } else {
                toast({
                  title: "⚠️ Sync Interrupted",
                  description: (
                    <div className="space-y-2">
                      <p>{data.message}</p>
                      <p className="text-sm">Progress: {data.inserted} new, {data.updated} updated</p>
                    </div>
                  ),
                  variant: "destructive",
                  duration: 10000
                });

                if (onSyncComplete) {
                  onSyncComplete();
                }
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: "Sync Cancelled",
          description: "Progress has been saved.",
        });
      } else {
        console.error('[Realtime Sync] Error:', error);
        toast({
          title: "Sync Error",
          description: error instanceof Error ? error.message : "Failed to sync conversations",
          variant: "destructive"
        });
      }
    } finally {
      setIsSyncing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const formatLastSync = (date: string) => {
    const now = new Date();
    const synced = new Date(date);
    const diffMs = now.getTime() - synced.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return synced.toLocaleDateString();
  };

  const progressPercent = progress && progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => handleSync(hasCheckpoint, true)}
          disabled={isSyncing}
          size="sm"
          className={hasCheckpoint && !isSyncing 
            ? "bg-orange-600 hover:bg-orange-700" 
            : "bg-[#1877f2] hover:bg-[#166fe5]"
          }
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              Syncing...
            </>
          ) : hasCheckpoint ? (
            <>
              <Play className="mr-2 w-4 h-4" />
              Resume Sync
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 w-4 h-4" />
              Sync from Facebook
            </>
          )}
        </Button>

        {isSyncing && (
          <Button
            onClick={handleCancel}
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            <Pause className="mr-2 w-4 h-4" />
            Cancel
          </Button>
        )}

        {lastSyncedAt && !isSyncing && (
          <span className="text-xs text-muted-foreground">
            Last synced: {formatLastSync(lastSyncedAt)}
          </span>
        )}
      </div>

      {/* Real-time Progress Display */}
      {showProgress && progress && (
        <Card className={cn(
          "p-4 border-2 transition-all",
          progress.status === 'complete' 
            ? "border-green-300 bg-green-50 dark:bg-green-950" 
            : progress.status === 'error'
            ? "border-red-300 bg-red-50 dark:bg-red-950"
            : "border-blue-300 bg-blue-50 dark:bg-blue-950",
          "animate-in fade-in slide-in-from-bottom-2 duration-300"
        )}>
          <div className="space-y-3">
            {/* Status Header */}
            <div className="flex items-start gap-2">
              {progress.status === 'complete' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              ) : progress.status === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              ) : (
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0 animate-spin" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {progress.status === 'complete' 
                    ? 'Sync Complete!' 
                    : progress.status === 'error'
                    ? 'Sync Interrupted'
                    : progress.status === 'resuming'
                    ? 'Resuming Sync...'
                    : 'Syncing Live from Facebook'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {progress.conversationName || progress.message}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            {progress.total > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress.current} of {progress.total}</span>
                  <span>{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            {/* Live Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-2 bg-white dark:bg-gray-900 rounded-md">
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900 border-green-300 mb-1">
                  <span className="text-green-700 dark:text-green-300 text-xs font-semibold">
                    +{progress.inserted}
                  </span>
                </Badge>
                <span className="text-xs text-muted-foreground">New</span>
              </div>
              
              <div className="flex flex-col items-center p-2 bg-white dark:bg-gray-900 rounded-md">
                <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 border-blue-300 mb-1">
                  <span className="text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    ↻ {progress.updated}
                  </span>
                </Badge>
                <span className="text-xs text-muted-foreground">Updated</span>
              </div>

              <div className="flex flex-col items-center p-2 bg-white dark:bg-gray-900 rounded-md">
                <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 border-purple-300 mb-1">
                  <span className="text-purple-700 dark:text-purple-300 text-xs font-semibold">
                    📊 {progress.eventsCreated}
                  </span>
                </Badge>
                <span className="text-xs text-muted-foreground">Events</span>
              </div>
            </div>

            {/* Current Processing */}
            {progress.status === 'processing' && progress.current > 0 && (
              <div className="text-xs text-center text-muted-foreground pt-1 border-t">
                Processing conversation #{progress.current}... (Auto-resume enabled)
              </div>
            )}
            
            {/* Auto-Resume Indicator */}
            {progress.status === 'resuming' && (
              <div className="text-xs text-center text-orange-600 font-semibold pt-1 border-t">
                🔄 Auto-resuming from conversation #{progress.current}...
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

