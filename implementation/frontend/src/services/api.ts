/**
 * KOSMOS AEOS API Client
 * Base Axios instance with interceptors for auth, error handling, and retries
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// API Configuration
const getServerApiBaseUrl = (): string => {
  return (
    process.env['KOSMOS_INTERNAL_API_URL'] ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://backend:8000'
  );
};

// In the browser we default to same-origin and rely on Next.js rewrites (/api -> backend).
// This avoids issues in port-forwarded dev environments where `localhost:8000` is not reachable.
const API_BASE_URL = typeof window === 'undefined' ? getServerApiBaseUrl() : '';
const API_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Token storage
const TOKEN_KEY = 'kosmos_access_token';
const REFRESH_TOKEN_KEY = 'kosmos_refresh_token';

export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setAccessToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  // Also set cookie for middleware access
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  document.cookie = `access_token=${token}; expires=${expiresAt.toUTCString()}; path=/; SameSite=Lax`;
};

export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setRefreshToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
  // Also set cookie for middleware access
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  document.cookie = `refresh_token=${token}; expires=${expiresAt.toUTCString()}; path=/; SameSite=Lax`;
};

export const clearTokens = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  // Clear cookies
  document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
};

// Create Axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add tenant ID if available
    const tenantId = typeof window !== 'undefined'
      ? localStorage.getItem('kosmos_tenant_id')
      : null;
    if (tenantId && config.headers) {
      config.headers['X-Tenant-ID'] = tenantId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors and token refresh
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for token refresh
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data;
        setAccessToken(access_token);
        setRefreshToken(refresh_token);

        onTokenRefreshed(access_token);
        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        clearTokens();

        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    const apiError: ApiError = {
      code: error.response?.data?.code || 'UNKNOWN_ERROR',
      message: error.response?.data?.message || error.message || 'An unknown error occurred',
      details: error.response?.data?.details,
      status: error.response?.status || 500,
    };

    return Promise.reject(apiError);
  }
);

// Retry logic for failed requests
export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isRetryableError(error)) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

const isRetryableError = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status === 408 || status === 429 || (status !== undefined && status >= 500);
  }
  return false;
};

// API methods
export const apiGet = <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
  return api.get<T>(url, { params }).then((res) => res.data);
};

export const apiPost = <T>(url: string, data?: unknown): Promise<T> => {
  return api.post<T>(url, data).then((res) => res.data);
};

export const apiPut = <T>(url: string, data?: unknown): Promise<T> => {
  return api.put<T>(url, data).then((res) => res.data);
};

export const apiPatch = <T>(url: string, data?: unknown): Promise<T> => {
  return api.patch<T>(url, data).then((res) => res.data);
};

export const apiDelete = <T>(url: string): Promise<T> => {
  return api.delete<T>(url).then((res) => res.data);
};

// File upload
export const apiUpload = <T>(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<T> => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post<T>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  }).then((res) => res.data);
};

// Stream response for SSE
export const apiStream = async (
  url: string,
  onMessage: (data: string) => void,
  options?: { signal?: AbortSignal }
): Promise<void> => {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'text/event-stream',
    },
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Stream failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('No response body');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data !== '[DONE]') {
          onMessage(data);
        }
      }
    }
  }
};

export default api;
