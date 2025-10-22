'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Facebook, MessageSquare, Users, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';

interface FacebookAuthResponse {
  accessToken: string;
  userID: string;
}

interface FacebookLoginResponse {
  authResponse?: FacebookAuthResponse;
}

interface FacebookUser {
  name: string;
  email?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB: any;
    fbAsyncInit: () => void;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  
  // Check if running on HTTPS (computed value, not state)
  const isHttps = typeof window !== 'undefined' 
    ? window.location.protocol === 'https:' || window.location.hostname === 'localhost'
    : true;

  useEffect(() => {
    // Redirect to dashboard if already logged in
    if (user && !isLoading) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    // Load Facebook SDK
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
      };
    }
  }, []);

  const handleFacebookLogin = () => {
    if (typeof window === 'undefined' || !window.FB) {
      alert('Facebook SDK not loaded. Please refresh the page.');
      return;
    }

    console.log('[Login] Starting Facebook login...');

    window.FB.login((response: FacebookLoginResponse) => {
      console.log('[Login] Facebook login response:', response);
      
      if (response.authResponse) {
        const { accessToken, userID } = response.authResponse;
        console.log('[Login] Got auth response for user:', userID);
        
        // Get user info from Facebook
        window.FB.api('/me', { fields: 'name,picture' }, async (user: FacebookUser) => {
          console.log('[Login] Got user info from Facebook:', user);
          
          try {
            // Call our API to authenticate with Supabase
            console.log('[Login] Calling /api/auth/facebook...');
            const res = await fetch('/api/auth/facebook', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken,
                userID,
                name: user.name,
                email: '', // Email permission removed - not required
                picture: user.picture?.data?.url || ''
              })
            });

            const data = await res.json();
            console.log('[Login] Auth API response:', data);

            if (res.ok && data.success) {
              console.log('[Login] Authentication successful!');
              console.log('[Login] User ID:', data.userId);
              console.log('[Login] Mode:', data.mode);
              console.log('[Login] Redirecting to dashboard...');
              
              // Force reload to refresh auth state
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 500);
            } else {
              console.error('[Login] Authentication failed');
              console.error('[Login] Status:', res.status);
              console.error('[Login] Response:', data);
              
              let errorMsg = 'Authentication failed';
              
              if (data.error) {
                errorMsg += `: ${data.error}`;
              }
              
              if (data.details && typeof data.details === 'string') {
                errorMsg += `\n\nDetails: ${data.details}`;
              }
              
              errorMsg += '\n\n📋 Steps to fix:\n';
              errorMsg += '1. Make sure Supabase is set up (see ENV_SETUP.md)\n';
              errorMsg += '2. Check .env.local has correct credentials\n';
              errorMsg += '3. Verify supabase-schema.sql was run\n';
              errorMsg += '4. Check browser console for detailed logs';
              
              alert(errorMsg);
            }
          } catch (error) {
            console.error('[Login] Error during authentication:', error);
            alert(`An error occurred: ${error}\n\nCheck browser console for details.`);
          }
        });
      } else {
        console.log('[Login] Facebook login was cancelled or failed');
        alert('Facebook login was cancelled. Please try again.');
      }
    }, { 
      scope: 'pages_messaging,pages_read_engagement,pages_show_list,pages_manage_metadata'
    });
  };

  const features = [
    {
      icon: MessageSquare,
      title: 'Bulk Messaging',
      description: 'Send personalized messages to multiple recipients at once'
    },
    {
      icon: Calendar,
      title: 'Smart Scheduling',
      description: 'Schedule messages for optimal engagement times'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Work together with your team on messaging campaigns'
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Insights',
      description: 'Track delivery rates, open rates, and engagement metrics'
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#1877f2]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-[#1877f2] p-4 rounded-2xl shadow-lg">
              <MessageSquare className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Facebook Bulk Messenger
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Send bulk messages to your Facebook page followers with intelligent scheduling, 
            real-time analytics, and team collaboration features.
          </p>
        </div>

        {/* HTTPS Warning for Production */}
        {!isHttps && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && (
          <div className="max-w-2xl mx-auto mb-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>HTTPS Required</AlertTitle>
              <AlertDescription>
                Facebook Login requires HTTPS. Please access this site using https:// instead of http://
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Development Mode Info */}
        {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
          <div className="max-w-2xl mx-auto mb-8">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Development Mode</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="font-medium">Facebook Login requires HTTPS. For local development:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Use a tool like <strong>ngrok</strong> or <strong>localtunnel</strong> to create HTTPS tunnel</li>
                  <li>Or deploy to Vercel/Netlify for testing (free tier available)</li>
                  <li>Or set up local HTTPS with <strong>mkcert</strong></li>
                </ol>
                <p className="text-sm mt-3">
                  <strong>Quick Setup:</strong><br />
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    npx ngrok http 3000
                  </code>
                  <br />
                  Then update your Facebook App&apos;s OAuth redirect URIs with the ngrok URL.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Login Card */}
        <div className="max-w-md mx-auto mb-16">
          <Card className="border-2 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Get Started</CardTitle>
              <CardDescription>
                Connect your Facebook account to start sending messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleFacebookLogin}
                className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white py-6 text-lg"
                size="lg"
                disabled={!isHttps && typeof window !== 'undefined' && window.location.hostname !== 'localhost'}
              >
                <Facebook className="mr-3 w-6 h-6" />
                Continue with Facebook
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-4">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
              
              {/* Development Instructions */}
              {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900 mb-2">📘 For Testing Without Facebook:</p>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• Explore the UI by visiting <strong>/dashboard</strong> directly</li>
                    <li>• Set up Supabase and test with ngrok for full functionality</li>
                    <li>• See <strong>QUICKSTART.md</strong> for complete setup instructions</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Powerful Features for Your Business
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-[#1877f2]" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-sm text-muted-foreground">
          <p>Compliant with Facebook&apos;s messaging policies and terms of service</p>
        </div>
      </div>
    </div>
  );
}
