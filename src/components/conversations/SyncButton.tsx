'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SyncButtonProps {
  pageId: string;
  facebookPageId: string;
  pageName: string;
  lastSyncedAt?: string | null;
  onSyncComplete?: () => void;
}

interface SyncStats {
  inserted: number;
  updated: number;
  total: number;
  skipped: number;
  eventsCreated: number;
  duration?: string;
}

export function SyncButton({ 
  pageId, 
  facebookPageId, 
  pageName, 
  lastSyncedAt,
  onSyncComplete 
}: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStats(null);
    setShowStats(false);

    try {
      const response = await fetch('/api/conversations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, facebookPageId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync conversations');
      }

      const stats: SyncStats = {
        inserted: data.inserted || 0,
        updated: data.updated || 0,
        total: data.synced || 0,
        skipped: data.skipped || 0,
        eventsCreated: data.eventsCreated || 0,
        duration: data.duration
      };

      setSyncStats(stats);
      setShowStats(true);

      toast({
        title: "Sync Complete!",
        description: (
          <div className="space-y-1">
            <p className="font-semibold">{pageName}</p>
            <div className="text-sm space-y-0.5">
              <p className="text-green-600">✓ {stats.inserted} new conversations</p>
              <p className="text-blue-600">↻ {stats.updated} updated</p>
              {stats.eventsCreated > 0 && (
                <p className="text-purple-600">📊 {stats.eventsCreated} events tracked</p>
              )}
              {stats.duration && (
                <p className="text-muted-foreground">⏱️ {stats.duration}</p>
              )}
            </div>
          </div>
        ),
        duration: 5000
      });

      // Auto-hide stats after 10 seconds
      setTimeout(() => setShowStats(false), 10000);

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      console.error('[Sync] Error:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync conversations",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSync}
          disabled={isSyncing}
          size="sm"
          className="bg-[#1877f2] hover:bg-[#166fe5]"
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 w-4 h-4" />
              Sync
            </>
          )}
        </Button>

        {lastSyncedAt && !isSyncing && (
          <span className="text-xs text-muted-foreground">
            Last synced: {formatLastSync(lastSyncedAt)}
          </span>
        )}
      </div>

      {/* Sync Stats */}
      {showStats && syncStats && (
        <Card className={cn(
          "p-3 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 transition-all",
          "animate-in fade-in slide-in-from-bottom-2 duration-300"
        )}>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                Sync Successful
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-900 border-green-300">
                    <span className="text-green-700 dark:text-green-300 text-xs">
                      +{syncStats.inserted} New
                    </span>
                  </Badge>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 border-blue-300">
                    <span className="text-blue-700 dark:text-blue-300 text-xs">
                      ↻ {syncStats.updated} Updated
                    </span>
                  </Badge>
                </div>
              </div>

              {syncStats.eventsCreated > 0 && (
                <div className="text-xs text-muted-foreground">
                  📊 {syncStats.eventsCreated} interaction events tracked
                </div>
              )}

              {syncStats.duration && (
                <div className="text-xs text-muted-foreground">
                  ⏱️ Completed in {syncStats.duration}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

