'use client';

import { useEffect, useState, useRef } from 'react';
import { Clock, RefreshCw, User, Calendar, X, ChevronDown, ChevronUp, LogOut, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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

interface TokenVerification {
  isValid: boolean;
  expiresAt: number | null;
  expiresIn: number | null;
  hasMismatch: boolean;
  mismatchSeconds: number;
  lastVerified: number;
}

interface TokenRefreshStatus {
  wasRefreshed: boolean;
  refreshedAt: number;
  newExpirationDays: number;
}

export function TokenExpirationWidget() {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [verification, setVerification] = useState<TokenVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<TokenRefreshStatus | null>(null);
  const router = useRouter();
  
  // Refs to track auto-refresh state
  const hasTriggeredAutoRefresh = useRef(false);
  const hasShownWarning = useRef(false);
  const lastKnownExpiresAt = useRef<number | null>(null);

  // Load auto-refresh preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('token-auto-refresh');
    if (saved !== null) {
      setAutoRefresh(saved === 'true');
    }
  }, []);

  // Save auto-refresh preference to localStorage
  const toggleAutoRefresh = async (enabled: boolean) => {
    setAutoRefresh(enabled);
    localStorage.setItem('token-auto-refresh', enabled.toString());
    
    // Request notification permission when enabling auto-refresh
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('[TokenWidget] ✅ Notification permission granted');
          new Notification('Auto-Refresh Enabled', {
            body: 'You will be notified when your token is about to expire.',
            icon: '/favicon.ico',
          });
        } else {
          console.log('[TokenWidget] ⚠️ Notification permission denied');
        }
      } catch (error) {
        console.error('[TokenWidget] Error requesting notification permission:', error);
      }
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let cachedExpiresAt: number | null = null;
    let hasAutoVerified = false; // Track if we've done the initial auto-verification

    const fetchExpirationTime = async () => {
      try {
        // Fetch auth status from the API
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (data.authenticated && data.cookies?.['fb-access-token']) {
          // Get the cookie to check expiration
          const tokenCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('fb-token-expires='));
          
          if (tokenCookie) {
            // If we have an explicit expiration cookie, use it
            cachedExpiresAt = parseInt(tokenCookie.split('=')[1]);
            
            // Check if token was recently refreshed
            if (lastKnownExpiresAt.current && cachedExpiresAt > lastKnownExpiresAt.current) {
              const expiresInDays = Math.floor((cachedExpiresAt - Date.now()) / (1000 * 60 * 60 * 24));
              
              // Token was refreshed! Show confirmation
              setRefreshStatus({
                wasRefreshed: true,
                refreshedAt: Date.now(),
                newExpirationDays: expiresInDays
              });
              
              console.log('[TokenWidget] ✅ Token was refreshed! New expiration:', new Date(cachedExpiresAt).toLocaleString());
              console.log('[TokenWidget] 🎉 Token valid for', expiresInDays, 'more days');
              
              // Show browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('✅ Token Refreshed Successfully!', {
                  body: `Your Facebook token is now valid for ${expiresInDays} more days.`,
                  icon: '/favicon.ico',
                });
              }
              
              // Auto-hide refresh status after 30 seconds
              setTimeout(() => {
                setRefreshStatus(null);
              }, 30000);
            }
            
            // Update last known expiration
            lastKnownExpiresAt.current = cachedExpiresAt;
          } else {
            // Fallback: Set to 60 days from now, but only once
            cachedExpiresAt = Date.now() + (60 * 24 * 60 * 60 * 1000);
          }

          setTokenData({
            expiresAt: cachedExpiresAt,
            userName: data.user?.name
          });
          
          // Auto-verify with Facebook on initial load to ensure accuracy
          if (!hasAutoVerified) {
            hasAutoVerified = true;
            console.log('[TokenWidget] 🔍 Auto-verifying token expiration with Facebook...');
            
            // Delay slightly to let UI render first
            setTimeout(async () => {
              try {
                const verifyResponse = await fetch('/api/auth/verify-token');
                if (verifyResponse.ok) {
                  const verifyData = await verifyResponse.json();
                  
                  if (verifyData.hasMismatch && verifyData.expiresAt) {
                    console.log('[TokenWidget] ⚠️ Auto-verification found mismatch - correcting...');
                    cachedExpiresAt = verifyData.expiresAt;
                    
                    setTokenData({
                      expiresAt: verifyData.expiresAt,
                      userName: data.user?.name
                    });
                    
                    // Update the cookie with correct expiration
                    document.cookie = `fb-token-expires=${verifyData.expiresAt}; path=/; max-age=${verifyData.expiresIn}`;
                    lastKnownExpiresAt.current = verifyData.expiresAt;
                    
                    console.log('[TokenWidget] ✅ Auto-corrected expiration to:', new Date(verifyData.expiresAt).toLocaleString());
                  } else {
                    console.log('[TokenWidget] ✅ Auto-verification passed - countdown is accurate');
                  }
                }
              } catch (error) {
                console.warn('[TokenWidget] Auto-verification failed:', error);
              }
            }, 1000);
          }
        } else {
          cachedExpiresAt = null;
          setTokenData(null);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching token status:', error);
        cachedExpiresAt = null;
        setTokenData(null);
        setIsLoading(false);
      }
    };

    const updateTimeRemaining = () => {
      if (cachedExpiresAt) {
        const now = Date.now();
        const diff = cachedExpiresAt - now;

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
    };

    // Initial fetch to get expiration time
    fetchExpirationTime().then(() => {
      // Start countdown after we have the expiration time
      updateTimeRemaining();
      intervalId = setInterval(updateTimeRemaining, 1000);
    });

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Auto-refresh when token is about to expire
  useEffect(() => {
    if (!autoRefresh || !timeRemaining) return;

    const totalSeconds = timeRemaining.total;
    
    // Show warning at 10 minutes (once)
    if (totalSeconds <= 600 && totalSeconds > 300 && !hasShownWarning.current) {
      hasShownWarning.current = true;
      console.log('[TokenWidget] ⚠️ Token expires in less than 10 minutes. Auto-refresh enabled.');
      
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Token Expiring Soon', {
          body: 'Your Facebook token will expire in less than 10 minutes. Auto-refresh is enabled.',
          icon: '/favicon.ico',
        });
      }
    }
    
    // Trigger auto-refresh at 5 minutes (once only)
    // Allow triggering at 0 or negative seconds to ensure it happens even if countdown reaches zero
    if (totalSeconds <= 300 && !hasTriggeredAutoRefresh.current) {
      hasTriggeredAutoRefresh.current = true;
      console.log('[TokenWidget] 🔄 Auto-refresh triggered at', totalSeconds, 'seconds - redirecting to login in 5 seconds...');
      
      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Auto-Refresh Triggered', {
          body: 'Redirecting to login to refresh your Facebook token...',
          icon: '/favicon.ico',
        });
      }
      
      // Give user 5 seconds to see the notification before redirecting
      setTimeout(() => {
        console.log('[TokenWidget] ➡️ Redirecting to login now...');
        router.push('/login');
      }, 5000);
    }
  }, [autoRefresh, timeRemaining, router]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Reset auto-refresh flags so they can trigger again after re-login
      hasTriggeredAutoRefresh.current = false;
      hasShownWarning.current = false;
      
      console.log('[TokenWidget] Manual refresh initiated - redirecting to login...');
      
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

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch('/api/auth/verify-token');
      if (response.ok) {
        const data = await response.json();
        setVerification({
          isValid: data.isValid,
          expiresAt: data.expiresAt,
          expiresIn: data.expiresIn,
          hasMismatch: data.hasMismatch,
          mismatchSeconds: data.mismatchSeconds,
          lastVerified: Date.now(),
        });
        
        // If there's a mismatch, update the countdown to use the real expiration
        if (data.hasMismatch && data.expiresAt) {
          setTokenData({
            expiresAt: data.expiresAt,
            userName: data.userName
          });
          
          // Update the cookie with the correct expiration
          document.cookie = `fb-token-expires=${data.expiresAt}; path=/; max-age=${data.expiresIn}`;
          
          // Reset auto-refresh flags since we have new expiration data
          hasTriggeredAutoRefresh.current = false;
          hasShownWarning.current = false;
          
          console.log('[TokenWidget] Updated expiration to match Facebook:', new Date(data.expiresAt).toLocaleString());
        }
        
        // If the token has been refreshed (much longer expiration than expected), reset flags
        if (data.expiresIn > 86400) { // More than 1 day
          hasTriggeredAutoRefresh.current = false;
          hasShownWarning.current = false;
          
          const expiresInDays = Math.floor(data.expiresIn / 86400);
          
          // Show refresh confirmation
          setRefreshStatus({
            wasRefreshed: true,
            refreshedAt: Date.now(),
            newExpirationDays: expiresInDays
          });
          
          console.log('[TokenWidget] ✅ Token appears refreshed - reset auto-refresh flags');
          console.log('[TokenWidget] 🎉 Token valid for', expiresInDays, 'more days');
          
          // Show notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('✅ Token Verified & Active!', {
              body: `Your Facebook token is valid for ${expiresInDays} more days.`,
              icon: '/favicon.ico',
            });
          }
          
          // Auto-hide after 30 seconds
          setTimeout(() => {
            setRefreshStatus(null);
          }, 30000);
        }
      } else {
        console.error('[TokenWidget] Failed to verify token:', await response.text());
      }
    } catch (error) {
      console.error('[TokenWidget] Error verifying token:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Don't show widget if loading or no token
  if (isLoading || !timeRemaining) {
    return null;
  }

  // Determine color based on time remaining
  const getColorClass = () => {
    const totalSeconds = timeRemaining.total;
    
    // Add pulsing animation when auto-refresh is about to trigger
    const pulseClass = autoRefresh && totalSeconds <= 300 && totalSeconds > 0 ? 'animate-pulse' : '';
    
    if (totalSeconds < 300) { // < 5 minutes
      return `bg-red-500/95 border-red-600 ${pulseClass}`;
    } else if (totalSeconds < 900) { // < 15 minutes
      return 'bg-orange-500/95 border-orange-600';
    } else if (totalSeconds < 1800) { // < 30 minutes
      return 'bg-yellow-500/95 border-yellow-600';
    } else if (totalSeconds < 3600) { // < 60 minutes
      return 'bg-blue-500/95 border-blue-600';
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
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium leading-none">Token Expires</span>
            {refreshStatus?.wasRefreshed && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-400/20 px-1.5 py-0.5 text-[9px] font-bold text-green-200">
                ✓ Refreshed
              </span>
            )}
          </div>
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

            {/* Auto-Refresh Toggle */}
            <div className="rounded bg-white/10 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-white/70" />
                  <div>
                    <span className="text-xs font-medium text-white">Auto-Refresh</span>
                    <p className="text-[10px] text-white/60">
                      {autoRefresh ? (
                        timeRemaining.total <= 0 ? (
                          <span className="text-red-300 font-semibold animate-pulse">
                            🔄 Triggering now...
                          </span>
                        ) : timeRemaining.total <= 300 ? (
                          <span className="text-yellow-300 font-semibold">
                            🔄 Will trigger in {timeRemaining.total} seconds
                          </span>
                        ) : timeRemaining.total <= 600 ? (
                          <span className="text-orange-300">
                            ⚠️ Will trigger when {'<'} 5 min left
                          </span>
                        ) : (
                          'Auto re-login when {'<'} 5 min left'
                        )
                      ) : (
                        'Disabled - manually re-login required'
                      )}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={toggleAutoRefresh}
                  className="data-[state=checked]:bg-green-400"
                />
              </div>
            </div>

            {/* Token Refresh Confirmation */}
            {refreshStatus?.wasRefreshed && (
              <div className="rounded-lg border border-green-500/40 bg-gradient-to-r from-green-500/30 to-emerald-500/30 p-3 shadow-lg">
                <div className="mb-1.5 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-300 animate-pulse" />
                  <span className="text-sm font-bold text-white">
                    🎉 Token Refreshed Successfully!
                  </span>
                </div>
                <p className="ml-6 text-xs text-white/90">
                  Your Facebook token has been renewed and is now valid for{' '}
                  <span className="font-bold text-green-300">{refreshStatus.newExpirationDays} days</span>!
                  <br />
                  <span className="text-[10px] text-white/60">
                    Refreshed: {new Date(refreshStatus.refreshedAt).toLocaleTimeString()}
                  </span>
                </p>
                <button
                  onClick={() => setRefreshStatus(null)}
                  className="ml-6 mt-2 text-[10px] text-white/70 hover:text-white underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Verification Status */}
            {verification && !refreshStatus?.wasRefreshed && (
              <div className={`rounded p-2 ${
                verification.hasMismatch 
                  ? 'bg-yellow-500/20 border border-yellow-500/40' 
                  : 'bg-green-500/20 border border-green-500/40'
              }`}>
                <div className="mb-1 flex items-center gap-2">
                  {verification.hasMismatch ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-300" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-300" />
                  )}
                  <span className="text-xs font-medium text-white">
                    {verification.hasMismatch ? 'Mismatch Detected' : 'Verified with Facebook'}
                  </span>
                </div>
                <p className="ml-5 text-[10px] text-white/80">
                  {verification.hasMismatch ? (
                    <>
                      Countdown was off by {Math.abs(verification.mismatchSeconds)} seconds.
                      <br />
                      <span className="text-green-300">✓ Auto-corrected to real expiration</span>
                    </>
                  ) : (
                    <>
                      Countdown matches Facebook&apos;s real expiration
                      <br />
                      <span className="text-white/60">Last checked: {new Date(verification.lastVerified).toLocaleTimeString()}</span>
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={handleVerify}
                disabled={isVerifying}
                size="sm"
                variant="secondary"
                className="w-full bg-white/20 text-white hover:bg-white/30"
              >
                <Shield className={`mr-2 h-3.5 w-3.5 ${isVerifying ? 'animate-pulse' : ''}`} />
                {isVerifying ? 'Verifying...' : 'Verify with Facebook'}
              </Button>
              
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
        </div>
      )}
    </div>
  );
}

