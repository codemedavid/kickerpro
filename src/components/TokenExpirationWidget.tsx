'use client';

import { useEffect, useState } from 'react';
import { Clock, RefreshCw, User, Calendar, X, ChevronDown, ChevronUp, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

interface TokenData {
  expiresAt: number;
  userName?: string;
}

export function TokenExpirationWidget() {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const updateTimeRemaining = async () => {
      try {
        // Fetch auth status from the API
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (data.authenticated && data.cookies?.['fb-access-token']) {
          // Token expires in 60 days from when it was set
          // Get the cookie to estimate expiration
          const tokenCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('fb-token-expires='));
          
          let expiresAt: number;
          
          if (tokenCookie) {
            // If we have an explicit expiration cookie, use it
            expiresAt = parseInt(tokenCookie.split('=')[1]);
          } else {
            // Estimate: assume token was set recently and expires in 60 days
            // This is a fallback - we'll add proper tracking
            expiresAt = Date.now() + (60 * 24 * 60 * 60 * 1000);
          }

          setTokenData({
            expiresAt,
            userName: data.user?.name
          });

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
          setTokenData(null);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching token status:', error);
        setTimeRemaining(null);
        setTokenData(null);
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
      // Redirect to re-authenticate
      router.push('/login');
    } catch (error) {
      console.error('Error refreshing token:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Don't show widget if loading or no token
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
    const totalDays = Math.floor(timeRemaining.total / 86400);
    const remainingHours = Math.floor((timeRemaining.total % 86400) / 3600);
    const remainingMinutes = Math.floor((timeRemaining.total % 3600) / 60);
    const remainingSeconds = timeRemaining.total % 60;
    
    const parts = [];
    
    if (totalDays > 0) {
      parts.push(`${totalDays}d`);
    }
    if (remainingHours > 0 || totalDays > 0) {
      parts.push(`${remainingHours}h`);
    }
    parts.push(`${remainingMinutes}m`);
    parts.push(`${remainingSeconds}s`);
    
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
    const totalDays = Math.floor(timeRemaining.total / 86400);
    const remainingHours = Math.floor((timeRemaining.total % 86400) / 3600);
    const remainingMinutes = Math.floor((timeRemaining.total % 3600) / 60);
    const remainingSeconds = timeRemaining.total % 60;
    
    const parts = [];
    
    if (totalDays > 0) {
      parts.push(`${totalDays} day${totalDays > 1 ? 's' : ''}`);
    }
    if (remainingHours > 0 || totalDays > 0) {
      parts.push(`${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`);
    }
    if (remainingMinutes > 0 || remainingHours > 0 || totalDays > 0) {
      parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`);
    }
    parts.push(`${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);
    
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
            {tokenData?.expiresAt && (
              <div className="rounded bg-white/10 p-2">
                <div className="mb-1 flex items-center gap-2 text-white/70">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="font-medium">Expires At</span>
                </div>
                <p className="ml-5 font-mono text-sm">
                  {formatDateTime(Math.floor(tokenData.expiresAt / 1000))}
                </p>
              </div>
            )}

            {/* User Info */}
            {tokenData?.userName && (
              <div className="rounded bg-white/10 p-2">
                <div className="mb-1 flex items-center gap-2 text-white/70">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium">User</span>
                </div>
                <p className="ml-5 truncate font-mono text-sm">
                  {tokenData.userName}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                size="sm"
                variant="secondary"
                className="flex-1 bg-white/20 text-white hover:bg-white/30"
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Re-login
              </Button>
              <Button
                onClick={handleLogout}
                size="sm"
                variant="secondary"
                className="bg-white/20 text-white hover:bg-white/30"
                title="Logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

