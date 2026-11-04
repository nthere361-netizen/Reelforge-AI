import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Service role client - used only for server tasks (storage signed URLs, storage upload)
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Per-request client created with the user's JWT so Row-Level-Security (RLS) is applied natively
export function createUserClient(token: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

