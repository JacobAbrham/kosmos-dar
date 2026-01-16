/**
 * KOSMOS DAR Registration Form Component
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService, RegisterRequest } from '@/services/auth';
import { GlassInput } from '../glass/GlassInput';
import { GlassButton } from '../glass/GlassButton';
import { GlassCard } from '../glass/GlassCard';

export function RegisterForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain an uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain a lowercase letter';
    }
    if (!/\d/.test(pwd)) {
      return 'Password must contain a digit';
    }
    return null;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const data: RegisterRequest = {
        email,
        password,
        full_name: fullName,
        ...(tenantId && { tenant_id: tenantId }),
      };

      await authService.register(data);
      
      // Auto-login after registration
      await authService.login({ email, password, tenant_id: tenantId || undefined });
      
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard className="w-full max-w-md mx-auto p-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-gray-400 text-sm">Sign up for KOSMOS</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-300 mb-2">
              Full Name
            </label>
            <GlassInput
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
              disabled={loading}
            />
          </div>

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
            <p className="mt-1 text-xs text-gray-400">
              Must be at least 8 characters with uppercase, lowercase, and a digit
            </p>
          </div>

          <div>
            <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-300 mb-2">
              Confirm Password
            </label>
            <GlassInput
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            disabled={loading || !email || !password || !fullName || password !== confirmPassword}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </GlassButton>
        </form>
      </div>
    </GlassCard>
  );
}
