import { useQuery } from '@tanstack/react-query';

export interface User {
  id: string;
  facebook_id: string;
  name: string;
  email: string | null;
  profile_picture: string | null;
  role: 'admin' | 'manager' | 'editor' | 'member';
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['current-user'],
    queryFn: async () => {
      try {
        // Check if user is authenticated via our API
        const response = await fetch('/api/auth/me');
        
        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data.user || null;
      } catch (error) {
        console.error('Auth check error:', error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
      window.location.href = '/login';
    }
  };

  return {
    user,
    session: user ? { user } : null,
    isLoading,
    signOut,
  };
}
