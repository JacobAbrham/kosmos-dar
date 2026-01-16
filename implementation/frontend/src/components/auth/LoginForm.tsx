/**
 * KOSMOS DAR Login Form Component
 * 
 * Supports both email/password and OAuth (Zitadel) authentication.
 */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService, LoginRequest } from '@/services/auth';
import { GlassInput } from '../glass/GlassInput';
import { GlassButton } from '../glass/GlassButton';
import { GlassCard } from '../glass/GlassCard';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useOAuth, setUseOAuth] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credentials: LoginRequest = {
        email,
        password,
        ...(tenantId && { tenant_id: tenantId }),
      };

      await authService.login(credentials);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = () => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const state = btoa(JSON.stringify({ redirect: redirectTo }));
    const authUrl = authService.getZitadelAuthUrl(redirectUri, state);
    window.location.href = authUrl;
  };

  return (
    <GlassCard className="w-full max-w-md mx-auto p-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to KOSMOS</h1>
          <p className="text-gray-400 text-sm">Sign in to continue</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        {useOAuth ? (
          <div className="space-y-4">
            <GlassButton
              onClick={handleOAuthLogin}
              className="w-full"
              disabled={loading}
            >
              Continue with Zitadel
            </GlassButton>
            <button
              onClick={() => setUseOAuth(false)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Use email/password instead
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <GlassInput
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <GlassInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="tenant_id" className="block text-sm font-medium text-gray-300 mb-2">
                Tenant ID (optional)
              </label>
              <GlassInput
                id="tenant_id"
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="default"
                disabled={loading}
              />
            </div>

            <GlassButton
              type="submit"
              className="w-full"
              disabled={loading || !email || !password}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </GlassButton>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">Or</span>
              </div>
            </div>

            <GlassButton
              type="button"
              onClick={handleOAuthLogin}
              className="w-full"
              variant="outline"
              disabled={loading}
            >
              Continue with Zitadel
            </GlassButton>
          </form>
        )}
      </div>
    </GlassCard>
  );
}
