import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return browserClient;
}

export function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl;
  if (!url) return null;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    supabaseServiceRoleKey ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    supabaseAnonKey;
  if (!key) return null;
  if (!serverClient) {
    serverClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return serverClient;
}
