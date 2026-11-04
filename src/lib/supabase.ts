/**
 * Supabase Client Configuration
 *
 * This client uses the Supabase JavaScript SDK for all database and auth operations.
 * Make sure to install: @supabase/supabase-js
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

export function isSupabaseConfigured() {
  return Boolean(import.meta.env?.VITE_SUPABASE_URL && import.meta.env?.VITE_SUPABASE_ANON_KEY);
}

export function getSupabaseClient() {
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-barber-google',
      },
    },
  });
  return client;
}
