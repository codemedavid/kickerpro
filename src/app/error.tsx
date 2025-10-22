'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <CardTitle>Something went wrong!</CardTitle>
              <CardDescription>
                An error occurred while loading this page
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-mono">
              {error.message || 'Unknown error occurred'}
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Possible causes:</strong>
            </p>
            <ul className="text-sm text-muted-foreground list-disc ml-5 space-y-1">
              <li>Database migration not run (check RUN_THIS_NOW.sql)</li>
              <li>Missing environment variables</li>
              <li>Facebook access token expired</li>
              <li>Network connection issue</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={reset}
              className="flex-1"
            >
              Try Again
            </Button>
            <Button 
              onClick={() => window.location.href = '/dashboard'}
              variant="outline"
              className="flex-1"
            >
              Go to Dashboard
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            <p>Error ID: {error.digest}</p>
            <p className="mt-1">
              If this persists, check browser console (F12) for details
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

