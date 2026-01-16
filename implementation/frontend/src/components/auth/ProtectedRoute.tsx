'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

/**
 * Client-side route protection component
 * Checks authentication status and redirects if needed
 */
export function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if token exists and is not expired
        const hasToken = authService.isAuthenticated();
        const isExpired = authService.isTokenExpired();

        if (hasToken && !isExpired) {
          // Try to get current user to validate token
          try {
            await authService.getCurrentUser();
            setIsAuthenticated(true);
          } catch (error) {
            // Token invalid, try refresh
            try {
              await authService.refreshAccessToken();
              setIsAuthenticated(true);
            } catch {
              // Refresh failed, redirect to login
              setIsAuthenticated(false);
              if (requireAuth && pathname) {
                const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`;
                router.push(redirectUrl);
              }
            }
          }
        } else {
          setIsAuthenticated(false);
          if (requireAuth && pathname) {
            const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`;
            router.push(redirectUrl);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        if (requireAuth && pathname) {
          const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`;
          router.push(redirectUrl);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, pathname, requireAuth, redirectTo]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If auth required but not authenticated, don't render children
  // (redirect is handled in useEffect)
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  // Render children if authenticated or auth not required
  return <>{children}</>;
}
