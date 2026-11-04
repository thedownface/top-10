import { sb } from './supabase';

export type CoachVerdict = { verdict: 'accept' | 'reject' | 'unsure' | 'skip'; feedback: string | null };

/** Asks the Coach to check today's log for a task. Returns null if the Coach can't be reached; the log then stands. */
export async function coachCheck(task: string): Promise<CoachVerdict | null> {
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch('/api/coach/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ task }),
    });
    return res.ok ? ((await res.json()) as CoachVerdict) : null;
  } catch {
    return null;
  }
}
