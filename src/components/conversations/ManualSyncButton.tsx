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
    setSyncStatus({ status: 'syncing', progress: 0 });

    try {
      const response = await fetch('/api/conversations/sync-fixed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          facebookPageId,
          resumeSession
        })
      });

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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Sync failed');
      }

      // Check if partial sync (more data to fetch)
      if (result.hasMore && result.resumeSession) {
        setSyncStatus({
          status: 'partial',
          message: `Synced ${result.synced} conversations`,
          synced: result.synced,
          inserted: result.inserted,
          updated: result.updated,
          hasMore: true,
          resumeSession: result.resumeSession,
          progress: 50 // Indicate partial progress
        });

        toast({
          title: 'Partial Sync Complete',
          description: (
            <div className="space-y-2">
              <p>Synced {result.inserted + result.updated} conversations so far.</p>
              <p className="text-sm text-muted-foreground">
                {result.inserted} new, {result.updated} updated
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSync(result.resumeSession)}
                className="mt-2"
              >
                Continue Sync
              </Button>
            </div>
          ),
          duration: 10000
        });
      } else {
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
        <div className="space-y-1">
          <Progress value={syncStatus.progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Fetching conversations from Facebook...
          </p>
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

