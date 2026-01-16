/**
 * KOSMOS DAR Authentication Service
 * 
 * Handles authentication via Zitadel OIDC/OAuth 2.0 and local JWT tokens.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ZITADEL_DOMAIN = process.env.NEXT_PUBLIC_ZITADEL_DOMAIN || 'http://localhost:8080';
const ZITADEL_CLIENT_ID = process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || '';

export interface LoginRequest {
  email: string;
  password: string;
  tenant_id?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  tenant_id?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  user_id: string;
  email: string;
  full_name: string;
  tenant_id?: string;
  roles: string[];
}

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
      this.refreshToken = localStorage.getItem('refresh_token');
    }
  }

  /**
   * Login with email/password
   */
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(error.detail || 'Login failed');
    }

    const tokens = await response.json();
    this.setTokens(tokens);
    return tokens;
  }

  /**
   * Register new user
   */
  async register(data: RegisterRequest): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(error.detail || 'Registration failed');
    }

    return response.json();
  }

  /**
   * Get Zitadel authorization URL for OAuth flow
   */
  getZitadelAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: ZITADEL_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
    });

    if (state) {
      params.set('state', state);
    }

    return `${ZITADEL_DOMAIN}/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for tokens
   */
  async exchangeOAuthCode(code: string, redirectUri: string): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/zitadel/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'OAuth callback failed' }));
      throw new Error(error.detail || 'OAuth callback failed');
    }

    const tokens = await response.json();
    this.setTokens(tokens);
    return tokens;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<TokenResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      // Refresh failed, clear tokens
      this.clearTokens();
      throw new Error('Token refresh failed');
    }

    const tokens = await response.json();
    this.setTokens(tokens);
    return tokens;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<User> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        try {
          await this.refreshAccessToken();
          return this.getCurrentUser();
        } catch {
          throw new Error('Authentication required');
        }
      }
      throw new Error('Failed to get user info');
    }

    return response.json();
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    if (this.accessToken) {
      try {
        await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        });
      } catch (error) {
        // Ignore errors during logout
        console.error('Logout error:', error);
      }
    }

    this.clearTokens();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Set tokens and store in localStorage and cookies
   */
  private setTokens(tokens: TokenResponse): void {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;

    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
      localStorage.setItem('token_expires_at', String(Date.now() + tokens.expires_in * 1000));
      
      // Also set cookies for middleware access
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      document.cookie = `access_token=${tokens.access_token}; expires=${expiresAt.toUTCString()}; path=/; SameSite=Lax`;
      document.cookie = `refresh_token=${tokens.refresh_token}; expires=${expiresAt.toUTCString()}; path=/; SameSite=Lax`;
    }
  }

  /**
   * Clear tokens from memory, localStorage, and cookies
   */
  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_expires_at');
      
      // Clear cookies
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const expiresAt = localStorage.getItem('token_expires_at');
    if (!expiresAt) {
      return true;
    }

    return Date.now() >= parseInt(expiresAt, 10);
  }
}

export const authService = new AuthService();
