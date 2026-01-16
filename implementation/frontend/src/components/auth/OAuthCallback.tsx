/**
 * KOSMOS DAR OAuth Callback Handler
 * 
 * Handles OAuth callback from Zitadel and exchanges code for tokens.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/auth';

export function OAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams?.get('code');
      const state = searchParams?.get('state');
      const errorParam = searchParams?.get('error');

      if (errorParam) {
        setError(`OAuth error: ${errorParam}`);
        setLoading(false);
        return;
      }

      if (!code) {
        setError('No authorization code received');
        setLoading(false);
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/callback`;
        await authService.exchangeOAuthCode(code, redirectUri);

        // Parse redirect from state
        let redirectTo = '/';
        if (state) {
          try {
            const stateData = JSON.parse(atob(state));
            redirectTo = stateData.redirect || '/';
          } catch {
            // Invalid state, use default
          }
        }

        router.push(redirectTo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'OAuth callback failed');
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold text-red-200 mb-2">Authentication Failed</h2>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
