import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** The signed-in user behind a request's `Authorization: Bearer <access token>`, or null. */
export async function requestUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return error ? null : data.user;
}
