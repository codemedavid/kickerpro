'use client';

/**
 * Facebook Connection Card
 * Displays user's Facebook connection status and pages
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Facebook, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { ConnectFacebookButton } from './connect-facebook-button';

interface FacebookPage {
  id: string;
  name: string;
  category?: string;
  picture?: string;
  followers_count?: number;
}

interface ConnectionStatus {
  isConnected: boolean;
  expiresAt?: string;
  needsRefresh?: boolean;
  pages?: FacebookPage[];
}

export function FacebookConnectionCard() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConnectionStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/facebook/pages');
      const data = await response.json();

      if (response.ok) {
        setStatus({
          isConnected: true,
          pages: data.pages || [],
        });
      } else {
        setStatus({
          isConnected: false,
        });
        
        if (data.error && !data.error.includes('No Facebook token')) {
          setError(data.error);
        }
      }
    } catch (err) {
      console.error('Error checking connection:', err);
      setStatus({
        isConnected: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      const response = await fetch('/api/facebook/refresh-token', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        await checkConnectionStatus();
      } else {
        setError(data.error || 'Failed to refresh token');
        
        if (data.needs_reconnect) {
          setStatus({ isConnected: false });
        }
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
      setError('Failed to refresh token');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Facebook account?')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/facebook/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setStatus({ isConnected: false });
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError('Failed to disconnect Facebook account');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5" />
            Facebook Connection
          </CardTitle>
          <CardDescription>
            Checking connection status...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Facebook className="h-5 w-5" />
            Facebook Connection
          </span>
          
          {status?.isConnected && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {status?.isConnected
            ? 'Your Facebook account is connected. Manage your pages below.'
            : 'Connect your Facebook account to start sending messages.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!status?.isConnected ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="rounded-full bg-muted p-4">
              <Facebook className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">No Facebook Account Connected</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your Facebook account to access your pages and start sending messages
              </p>
            </div>
            <ConnectFacebookButton size="lg" />
          </div>
        ) : (
          <>
            {/* Pages List */}
            {status.pages && status.pages.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Your Facebook Pages ({status.pages.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={checkConnectionStatus}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                <div className="space-y-2">
                  {status.pages.map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      {page.picture && (
                        <img
                          src={page.picture}
                          alt={page.name}
                          className="h-10 w-10 rounded-full"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{page.name}</p>
                        {page.category && (
                          <p className="text-xs text-muted-foreground">{page.category}</p>
                        )}
                      </div>
                      {page.followers_count !== undefined && (
                        <Badge variant="secondary">
                          {page.followers_count.toLocaleString()} followers
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No Facebook Pages found. Make sure you&apos;re an admin of at least one page.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Token
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleDisconnect}
                className="text-destructive hover:text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

