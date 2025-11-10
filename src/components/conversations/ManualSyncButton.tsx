'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Loader2 
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';

interface ManualSyncButtonProps {
  pageId: string;
  facebookPageId: string;
  pageName?: string;
  onSyncComplete?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showProgress?: boolean;
}

interface SyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'error' | 'partial';
  message?: string;
  synced?: number;
  inserted?: number;
  updated?: number;
  hasMore?: boolean;
  resumeSession?: string;
  lastSyncTime?: string;
  progress?: number;
  currentBatch?: number;
  totalBatches?: number;
  realTimeCount?: number; // Real-time counter for live updates
}

export function ManualSyncButton({
  pageId,
  facebookPageId,
  pageName,
  onSyncComplete,
  variant = 'outline',
  size = 'default',
  showProgress = true
}: ManualSyncButtonProps) {
  const { toast } = useToast();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: 'idle' });
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Load last sync time from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`last_sync_${pageId}`);
    if (stored) {
      setLastSync(new Date(stored));
    }
  }, [pageId]);

  const handleSync = async (resumeSession?: string) => {
    setSyncStatus({ 
      status: 'syncing', 
      progress: 0,
      realTimeCount: 0,
      currentBatch: 0
    });

    try {
      // Use streaming endpoint for real-time updates
      const response = await fetch('/api/conversations/sync-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          facebookPageId
        })
      });

      if (!response.ok) {
        if (response.status === 409) {
          // Sync already in progress
          toast({
            title: 'Sync In Progress',
            description: 'A sync is already running for this page. Please wait for it to complete.',
            variant: 'default'
          });
          setSyncStatus({ status: 'idle' });
          return;
        }
        throw new Error('Sync request failed');
      }

      // Read the stream for real-time updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream available');
      }

      let buffer = '';
      let lastResult: any = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        // Decode the chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete messages (split by \n\n)
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim() || !message.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(message.slice(6)); // Remove 'data: ' prefix
            lastResult = data;

            // Update status based on stream message
            if (data.status === 'syncing' || data.status === 'batch_complete') {
              setSyncStatus({
                status: 'syncing',
                realTimeCount: data.total || 0,
                inserted: data.inserted || 0,
                updated: data.updated || 0,
                currentBatch: data.batch || 0,
                progress: Math.min((data.total || 0) / 100 * 10, 90) // Estimate progress
              });
            } else if (data.status === 'complete' || data.status === 'complete_with_errors') {
              // Final result
              break;
            } else if (data.status === 'error') {
              throw new Error(data.error || 'Sync failed');
            }
          } catch (parseError) {
            console.warn('[Sync] Failed to parse message:', message);
          }
        }
      }

      // Use the last result for final status
      const result = lastResult;

      if (!result) {
        throw new Error('No sync result received');
      }

      // Check for completion
      if (result.status === 'complete' || result.status === 'complete_with_errors') {
        // Complete sync
        const now = new Date();
        setLastSync(now);
        localStorage.setItem(`last_sync_${pageId}`, now.toISOString());

        setSyncStatus({
          status: 'success',
          message: `Synced ${result.synced} conversations`,
          synced: result.synced,
          inserted: result.inserted,
          updated: result.updated,
          lastSyncTime: now.toISOString(),
          progress: 100
        });

        toast({
          title: 'Sync Complete!',
          description: (
            <div className="space-y-1">
              <p className="font-medium">{result.synced} conversations synced</p>
              <p className="text-sm text-muted-foreground">
                {result.inserted} new, {result.updated} updated
              </p>
              {result.eventsCreated && (
                <p className="text-xs text-muted-foreground">
                  {result.eventsCreated} events created
                </p>
              )}
            </div>
          )
        });

        // Call callback to refresh data
        if (onSyncComplete) {
          onSyncComplete();
        }

        // Reset to idle after 3 seconds
        setTimeout(() => {
          setSyncStatus({ status: 'idle' });
        }, 3000);
      }
    } catch (error) {
      console.error('Sync error:', error);
      
      setSyncStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Sync failed'
      });

      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync conversations',
        variant: 'destructive'
      });

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setSyncStatus({ status: 'idle' });
      }, 5000);
    }
  };

  const getButtonIcon = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'partial':
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  const getButtonText = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return 'Synced!';
      case 'error':
        return 'Failed';
      case 'partial':
        return 'Continue';
      default:
        return 'Sync';
    }
  };

  const getTooltipContent = () => {
    if (syncStatus.status === 'syncing') {
      return 'Syncing conversations from Facebook...';
    }
    if (syncStatus.status === 'success' && syncStatus.synced) {
      return `Last sync: ${syncStatus.inserted} new, ${syncStatus.updated} updated`;
    }
    if (syncStatus.status === 'error') {
      return syncStatus.message || 'Sync failed';
    }
    if (syncStatus.status === 'partial') {
      return 'Partial sync complete. Click to continue.';
    }
    if (lastSync) {
      return `Last synced ${formatDistanceToNow(lastSync, { addSuffix: true })}`;
    }
    return `Manually sync conversations from ${pageName || 'Facebook'}`;
  };

  const isDisabled = syncStatus.status === 'syncing';

  return (
    <div className="space-y-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={() => handleSync(syncStatus.resumeSession)}
              disabled={isDisabled}
              className="gap-2"
            >
              {getButtonIcon()}
              <span>{getButtonText()}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipContent()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Progress Bar for Syncing State */}
      {showProgress && syncStatus.status === 'syncing' && (
        <div className="space-y-2">
          <Progress value={syncStatus.progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {syncStatus.currentBatch ? `Batch ${syncStatus.currentBatch}` : 'Fetching...'}
            </span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {syncStatus.realTimeCount || 0} conversations
            </span>
          </div>
          {syncStatus.inserted !== undefined && syncStatus.updated !== undefined && (
            <p className="text-xs text-center text-muted-foreground">
              {syncStatus.inserted} new • {syncStatus.updated} updated
            </p>
          )}
        </div>
      )}

      {/* Status Message */}
      {syncStatus.message && syncStatus.status !== 'idle' && (
        <p className={`text-xs text-center ${
          syncStatus.status === 'error' ? 'text-red-600' :
          syncStatus.status === 'success' ? 'text-green-600' :
          syncStatus.status === 'partial' ? 'text-orange-600' :
          'text-muted-foreground'
        }`}>
          {syncStatus.message}
        </p>
      )}
    </div>
  );
}

