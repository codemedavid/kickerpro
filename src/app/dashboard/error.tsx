'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <Card className="border-red-200">
        <CardContent className="p-8 text-center space-y-4">
          <div className="bg-red-100 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <h2 className="text-2xl font-bold">Oops! Something went wrong</h2>
          
          <p className="text-muted-foreground">
            {error.message || 'An unexpected error occurred'}
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
            <p className="text-sm text-yellow-800">
              <strong>💡 Quick fixes:</strong>
            </p>
            <ul className="text-sm text-yellow-800 list-disc ml-5 mt-2 space-y-1">
              <li>Run <code className="bg-yellow-100 px-1 rounded">RUN_THIS_NOW.sql</code> in Supabase</li>
              <li>Check your internet connection</li>
              <li>Try logging out and logging in again</li>
              <li>Clear browser cache and cookies</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={reset}>
              Try Again
            </Button>
            <Button 
              onClick={() => window.location.href = '/dashboard'}
              variant="outline"
            >
              Refresh Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

