import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase now calls this the "publishable" key; older projects call it the "anon" key. Either works.
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Browser client. Row level security in supabase/schema.sql decides what each user may do. */
export function sb(): SupabaseClient {
  if (!client) {
    client = createClient(url ?? 'http://localhost:54321', key ?? 'missing', {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}
