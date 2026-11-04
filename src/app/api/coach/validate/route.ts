import { CORE_TASKS, istDate } from '@/lib/core';
import { NOTE_TASKS, applyReasonVerdict, coachEnabled, judgeNote, judgeReason, serviceDb } from '@/lib/coach';
import { requestUser } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Called by the app right after a task is logged or a reason is sent.
 * Body: { task: '1'..'6' | 'x<id>' } — today's log for the signed-in user.
 * Returns { verdict: 'accept' | 'reject' | 'unsure' | 'skip', feedback }.
 */
export async function POST(req: Request) {
  const user = await requestUser(req);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { task } = (await req.json().catch(() => ({}))) as { task?: string };
  if (!task || !/^(\d|x\d+)$/.test(task)) return Response.json({ error: 'bad request' }, { status: 400 });
  if (!coachEnabled()) return Response.json({ verdict: 'skip', feedback: null });

  const db = serviceDb();
  const { data: log } = await db.from('task_logs')
    .select('id, task_key, status, note, helped_seat, reason, ai_verdict, ai_note')
    .eq('user_id', user.id).eq('log_date', istDate(Date.now())).eq('task_key', task).maybeSingle();
  if (!log) return Response.json({ error: 'not found' }, { status: 404 });
  if (log.ai_verdict) return Response.json({ verdict: log.ai_verdict, feedback: log.ai_note });

  if (log.status === 'done') {
    if (!NOTE_TASKS.includes(log.task_key)) return Response.json({ verdict: 'skip', feedback: null });
    let helped: string | null = null;
    if (log.helped_seat) {
      const { data } = await db.from('profiles').select('name').eq('seat', log.helped_seat).maybeSingle();
      helped = data?.name ?? null;
    }
    const v = await judgeNote(log.task_key, log.note ?? '', helped);
    if (!v) return Response.json({ verdict: 'skip', feedback: null }); // Coach unavailable: the log stands.
    if (v.verdict === 'reject') {
      // Bounce it so the athlete can log it again properly before 10 pm.
      await db.from('task_logs').delete().eq('id', log.id);
      return Response.json(v);
    }
    await db.from('task_logs').update({ ai_verdict: v.verdict, ai_note: v.feedback }).eq('id', log.id);
    return Response.json(v);
  }

  if (log.status === 'review') {
    let title = CORE_TASKS.find((t) => t.key === log.task_key)?.title ?? 'Extra task';
    if (log.task_key.startsWith('x')) {
      const { data } = await db.from('extra_tasks').select('title').eq('id', Number(log.task_key.slice(1))).maybeSingle();
      title = data?.title ?? title;
    }
    const v = await applyReasonVerdict(db, log.id, await judgeReason(title, log.reason, log.note ?? ''));
    return Response.json(v ?? { verdict: 'skip', feedback: null });
  }

  return Response.json({ verdict: 'skip', feedback: null });
}
