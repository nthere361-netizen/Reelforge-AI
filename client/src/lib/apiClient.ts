import { supabase } from './supabase';

const rawApiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const API_BASE_URL = rawApiUrl.endsWith('/api/v1')
  ? rawApiUrl
  : `${rawApiUrl.replace(/\/+$/, '')}/api/v1`;

export interface ApiEnvelope<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: any;
  } | null;
}

export class ApiError extends Error {
  code: string;
  details?: any;
  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    console.error('API Network/Fetch Error:', netErr);
    throw new ApiError(
      `Cannot connect to ReelForge AI backend at ${API_BASE_URL}. Ensure the backend server is running and accessible.`,
      'NETWORK_DISCONNECTED',
      { originalError: netErr.message }
    );
  }

  // Handle direct file downloads
  const contentType = res.headers.get('content-type');
  if (
    contentType &&
    (contentType.includes('audio/') ||
      contentType.includes('application/zip') ||
      contentType.includes('application/pdf') ||
      contentType.includes('text/vtt') ||
      contentType.includes('application/x-subrip') ||
      contentType.includes('text/plain'))
  ) {
    if (!res.ok) {
      throw new ApiError(`Download failed with status ${res.status}`, 'DOWNLOAD_FAILED');
    }
    return (await res.blob()) as unknown as T;
  }

  const json: ApiEnvelope<T> = await res.json().catch(() => ({
    data: null,
    error: { code: 'NETWORK_ERROR', message: 'Failed to parse response' },
  }));

  // Auto-handle expired or invalid session token: clear stale session and redirect to login
  if (
    res.status === 401 &&
    (json.error?.message?.includes('session token') ||
      json.error?.message?.includes('UNAUTHENTICATED') ||
      json.error?.code === 'UNAUTHENTICATED')
  ) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore cleanup error
    }
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?expired=1`;
    }
  }

  if (!res.ok || json.error) {
    const err = json.error || { code: 'UNKNOWN_ERROR', message: `HTTP ${res.status}` };
    throw new ApiError(err.message, err.code, err.details);
  }

  return json.data as T;
}

