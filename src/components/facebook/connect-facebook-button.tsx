'use client';

/**
 * Connect Facebook Button Component
 * Initiates Facebook OAuth flow when clicked
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Loader2 } from 'lucide-react';

interface ConnectFacebookButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children?: React.ReactNode;
}

export function ConnectFacebookButton({
  variant = 'default',
  size = 'default',
  className = '',
  children,
}: ConnectFacebookButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Redirect to Facebook OAuth
      window.location.href = '/api/auth/facebook';
    } catch (error) {
      console.error('Failed to connect Facebook:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleConnect}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Facebook className="mr-2 h-4 w-4" />
          {children || 'Connect Facebook'}
        </>
      )}
    </Button>
  );
}

