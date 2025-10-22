'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Load Facebook SDK globally for dashboard
    if (typeof window !== 'undefined' && !document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      document.body.appendChild(script);

      window.fbAsyncInit = function() {
        window.FB.init({
          appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '',
          cookie: true,
          xfbml: true,
          version: process.env.NEXT_PUBLIC_FACEBOOK_APP_VERSION || 'v18.0'
        });
        console.log('[Facebook SDK] Initialized in dashboard');
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB: any;
    fbAsyncInit: () => void;
  }
}
