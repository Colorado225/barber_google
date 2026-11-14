/**
 * Supabase Client Configuration
 *
 * This client uses the Supabase JavaScript SDK for all database and auth operations.
 * Make sure to install: @supabase/supabase-js
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
const memoryStorage = new Map<string, string>();

const safeAuthStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return memoryStorage.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    memoryStorage.set(key, value);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Fallback en mémoire si localStorage est restreint dans l'iframe.
    }
  },
  removeItem(key: string): void {
    memoryStorage.delete(key);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignorer si localStorage est indisponible.
    }
  },
};

function readEnvValue(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_PUBLIC_SITE_URL') {
  const value = import.meta.env?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveAuthRedirectUrl(path: string): string {
  const publicSiteUrl = readEnvValue('VITE_PUBLIC_SITE_URL');
  const windowOrigin =
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null' &&
    /^https?:\/\//i.test(window.location.origin)
      ? window.location.origin
      : '';
  const baseUrl = windowOrigin || publicSiteUrl || 'http://localhost:3000';
  return new URL(path, baseUrl).toString();
}

export function isSupabaseConfigured() {
  return Boolean(readEnvValue('VITE_SUPABASE_URL') && readEnvValue('VITE_SUPABASE_ANON_KEY'));
}

export function getSupabaseClient() {
  const url = readEnvValue('VITE_SUPABASE_URL');
  const anonKey = readEnvValue('VITE_SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: safeAuthStorage,
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-barber-google',
      },
    },
  });
  return client;
}
