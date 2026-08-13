import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './supabase';

/**
 * Server-only Supabase client using the secret (service-role) key, which
 * bypasses row-level security. Used by the cron to read every user's bills and
 * push subscriptions. NEVER import this from client code.
 */

export function haveAdmin(): boolean {
  return !!process.env.SUPABASE_SECRET_KEY;
}

export function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
