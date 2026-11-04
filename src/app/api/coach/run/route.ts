import { runCoach, serviceDb } from '@/lib/coach';
import { requestUser } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Admin-only: run the Coach's nightly work now (fill seats, rule on reasons, set today's tasks). */
export async function POST(req: Request) {
  const user = await requestUser(req);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const db = serviceDb();
  const { data: me } = await db.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) return Response.json({ error: 'Admin only.' }, { status: 403 });
  return Response.json(await runCoach(db));
}
