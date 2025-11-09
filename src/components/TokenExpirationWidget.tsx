'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, RefreshCw, User, Calendar, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Session } from '@supabase/supabase-js';

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function TokenExpirationWidget() {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let intervalId: NodeJS.Timeout | null = null;

    const updateTimeRemaining = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        
        if (currentSession?.expires_at) {
          const expiresAt = currentSession.expires_at * 1000; // Convert to milliseconds
          const now = Date.now();
          const diff = expiresAt - now;

          if (diff > 0) {
            const totalSeconds = Math.floor(diff / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            setTimeRemaining({
              hours,
              minutes,
              seconds,
              total: totalSeconds,
            });
          } else {
            setTimeRemaining({
              hours: 0,
              minutes: 0,
              seconds: 0,
              total: 0,
            });
          }
        } else {
          setTimeRemaining(null);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching session:', error);
        setTimeRemaining(null);
        setIsLoading(false);
      }
    };

    // Initial update
    updateTimeRemaining();

    // Update every second
    intervalId = setInterval(updateTimeRemaining, 1000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const supabase = createClient();
      await supabase.auth.refreshSession();
    } catch (error) {
      console.error('Error refreshing session:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Don't show widget if loading or no session
  if (isLoading || !timeRemaining) {
    return null;
  }

  // Determine color based on time remaining
  const getColorClass = () => {
    const totalMinutes = timeRemaining.total / 60;
    
    if (totalMinutes < 5) {
      return 'bg-red-500/95 border-red-600';
    } else if (totalMinutes < 15) {
      return 'bg-orange-500/95 border-orange-600';
    } else if (totalMinutes < 30) {
      return 'bg-yellow-500/95 border-yellow-600';
    } else {
      return 'bg-green-500/95 border-green-600';
    }
  };

  const formatTime = () => {
    const parts = [];
    
    if (timeRemaining.hours > 0) {
      parts.push(`${timeRemaining.hours}h`);
    }
    if (timeRemaining.minutes > 0 || timeRemaining.hours > 0) {
      parts.push(`${timeRemaining.minutes}m`);
    }
    parts.push(`${timeRemaining.seconds}s`);
    
    return parts.join(' ');
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatTimeDetailed = () => {
    const parts = [];
    
    if (timeRemaining.hours > 0) {
      parts.push(`${timeRemaining.hours} hour${timeRemaining.hours > 1 ? 's' : ''}`);
    }
    if (timeRemaining.minutes > 0) {
      parts.push(`${timeRemaining.minutes} minute${timeRemaining.minutes > 1 ? 's' : ''}`);
    }
    parts.push(`${timeRemaining.seconds} second${timeRemaining.seconds > 1 ? 's' : ''}`);
    
    return parts.join(', ');
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-lg border shadow-lg transition-all duration-300 ${getColorClass()} ${
        isExpanded ? 'w-80' : 'w-auto'
      }`}
    >
      {/* Collapsed View */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-white transition-opacity hover:opacity-90"
        title="Click for details"
      >
        <Clock className="h-4 w-4 flex-shrink-0" />
        <div className="flex flex-1 flex-col">
          <span className="text-xs font-medium leading-none">Token Expires</span>
          <span className="mt-1 text-sm font-bold leading-none">{formatTime()}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 flex-shrink-0" />
        )}
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t border-white/20 bg-white/10 p-4 text-white backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Session Details</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {/* Time Remaining Detailed */}
            <div className="rounded bg-white/10 p-2">
              <div className="mb-1 flex items-center gap-2 text-white/70">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-medium">Time Remaining</span>
              </div>
              <p className="ml-5 font-mono text-sm">{formatTimeDetailed()}</p>
            </div>

            {/* Expiration Date/Time */}
            {session?.expires_at && (
              <div className="rounded bg-white/10 p-2">
                <div className="mb-1 flex items-center gap-2 text-white/70">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="font-medium">Expires At</span>
                </div>
                <p className="ml-5 font-mono text-sm">
                  {formatDateTime(session.expires_at)}
                </p>
              </div>
            )}

            {/* User Info */}
            {session?.user && (
              <div className="rounded bg-white/10 p-2">
                <div className="mb-1 flex items-center gap-2 text-white/70">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium">User</span>
                </div>
                <p className="ml-5 truncate font-mono text-sm">
                  {session.user.email || 'N/A'}
                </p>
              </div>
            )}

            {/* Refresh Button */}
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              size="sm"
              variant="secondary"
              className="w-full bg-white/20 text-white hover:bg-white/30"
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Session'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

