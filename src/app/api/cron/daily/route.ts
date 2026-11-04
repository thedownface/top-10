import { createClient } from '@supabase/supabase-js';
import { istDate } from '@/lib/core';
import { runCoach } from '@/lib/coach';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const KEEP_PROOF_DAYS = 14;

/**
 * Runs once a day just after midnight IST (vercel.json). Closes the finished day(s) —
 * streaks, removals, trial progress — then lets the Coach fill open seats, rule on waiting
 * reasons and set today's personal tasks, and finally deletes proof files older than two weeks.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: 'supabase env missing' }, { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const closed = await db.rpc('close_pending');
  if (closed.error) return Response.json({ error: closed.error.message }, { status: 500 });

  const coach = await runCoach(db);

  const cutoff = istDate(Date.now() - KEEP_PROOF_DAYS * 86400000);
  let pruned = 0;
  for (let round = 0; round < 20; round++) {
    const { data, error } = await db
      .from('task_logs')
      .select('id, media_path')
      .lt('log_date', cutoff)
      .neq('status', 'review')
      .not('media_path', 'is', null)
      .limit(100);
    if (error) return Response.json({ error: error.message, scored: closed.data, pruned }, { status: 500 });
    if (!data.length) break;
    const rm = await db.storage.from('proofs').remove(data.map((r) => r.media_path as string));
    if (rm.error) return Response.json({ error: rm.error.message, scored: closed.data, pruned }, { status: 500 });
    const up = await db.from('task_logs').update({ media_path: null }).in('id', data.map((r) => r.id));
    if (up.error) return Response.json({ error: up.error.message, scored: closed.data, pruned }, { status: 500 });
    pruned += data.length;
  }

  return Response.json({ ok: true, scored: closed.data, coach, pruned });
}
