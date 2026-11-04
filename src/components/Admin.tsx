'use client';

import { useCallback, useEffect, useState } from 'react';
import { sb, supabaseConfigured } from '@/lib/supabase';
import {
  C, errMsg, first, istDate, REASONS, roman, shortDate, taskTitle,
  type ExtraTask, type Seat, type Settings,
} from '@/lib/core';
import { Arrow, Check } from './Icons';

type Review = {
  id: number;
  log_date: string;
  task_key: string;
  note: string | null;
  reason: number | null;
  media_path: string | null;
  admin_only: boolean;
  created_at: string;
  ai_note: string | null;
  profiles: { name: string; seat: number | null; role: string } | null;
};
type QueueRow = { id: string; name: string; training: string; trial_days: number; trial_done_at: string | null };
type Invite = { code: string; seat: number; created_at: string };

export default function Admin() {
  const [state, setState] = useState<'loading' | 'out' | 'denied' | 'ok'>('loading');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [ten, setTen] = useState<Seat[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [extras, setExtras] = useState<ExtraTask[]>([]);
  const [allExtras, setAllExtras] = useState<ExtraTask[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [xTitle, setXTitle] = useState('');
  const [xProof, setXProof] = useState('Clip up to 30 s');
  const [announce, setAnnounce] = useState('');

  const flash = useCallback((m: string, tone?: 'ok') => { setToast({ msg: m, ok: tone === 'ok' }); setTimeout(() => setToast(null), 3000); }, []);

  const load = useCallback(async () => {
    const client = sb();
    const today = istDate(Date.now());
    const [t, q, inv, rv, ex, st] = await Promise.all([
      client.rpc('the_ten'),
      client.from('profiles').select('id, name, training, trial_days, trial_done_at').eq('role', 'queue')
        .order('trial_done_at', { ascending: true, nullsFirst: false }).order('trial_days', { ascending: false }).order('created_at').limit(200),
      client.from('invites').select('code, seat, created_at').is('used_by', null).is('used_at', null).order('seat'),
      client.from('task_logs').select('id, log_date, task_key, note, reason, media_path, admin_only, created_at, ai_note, profiles(name, seat, role)').eq('status', 'review').order('created_at').limit(100),
      client.from('extra_tasks').select('id, for_date, title, proof, user_id, source').gte('for_date', istDate(Date.now() - 14 * 86400000)).order('id'),
      client.from('settings').select('season_name, season_start').eq('id', 1).single(),
    ]);
    const err = t.error || q.error || inv.error || rv.error || ex.error || st.error;
    if (err) { flash(errMsg(err)); return; }
    setTen(t.data as Seat[]);
    setQueue(q.data as QueueRow[]);
    setInvites(inv.data as Invite[]);
    setReviews(rv.data as unknown as Review[]);
    setAllExtras(ex.data as ExtraTask[]);
    setExtras((ex.data as ExtraTask[]).filter((e) => e.for_date === today));
    setSettings(st.data as Settings);
  }, [flash]);

  useEffect(() => {
    if (!supabaseConfigured) { setState('out'); return; }
    (async () => {
      const { data: { session } } = await sb().auth.getSession();
      if (!session) { setState('out'); return; }
      const { data } = await sb().from('profiles').select('is_admin').eq('id', session.user.id).single();
      if (!data?.is_admin) { setState('denied'); return; }
      setState('ok');
      load();
    })();
  }, [load]);

  const run = async (fn: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const msg = await fn();
      await load();
      if (msg) flash(msg, 'ok');
    } catch (e) {
      flash(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };

  if (state !== 'ok') {
    return (
      <main className="admin">
        <div className="admin-wrap" style={{ minHeight: '100dvh', justifyContent: 'flex-end' }}>
          <span className="kicker">Admin desk</span>
          <h1 className="display d52">{state === 'loading' ? 'One moment.' : state === 'out' ? 'Sign in first.' : 'Admin only.'}</h1>
          {state !== 'loading' && <a className="bar-btn" href="/" style={{ textDecoration: 'none' }}><span>Back to the app</span><Arrow /></a>}
        </div>
      </main>
    );
  }

  const nextInQueue = queue.find((q) => q.trial_done_at);
  const firstOpen = Array.from({ length: 10 }, (_, i) => i + 1).find((n) => !ten.some((s) => s.seat === n));

  return (
    <main className="admin">
      <div className="admin-wrap">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="kicker">Admin desk · {settings?.season_name}</span>
            <h1 className="display d52">Run the room.</h1>
          </div>
          <a href="/" className="link-btn">Back to the app</a>
        </header>

        {/* reviews */}
        <section className="admin-section">
          <h2 className="display d26 rule-bottom" style={{ paddingBottom: 8 }}>Reasons to review · {reviews.length}</h2>
          {reviews.length === 0 && <p className="small" style={{ margin: 0 }}>Nothing waiting. Reviews are due within 24 hours.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="admin-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: '1 1 320px' }}>
                <span className="label-strong" style={{ color: C.RT }}>
                  {r.profiles?.seat ? `Seat ${roman(r.profiles.seat)}` : r.profiles?.role === 'queue' ? 'Queue trial' : 'Member'} · {shortDate(r.log_date)}
                </span>
                <strong style={{ fontSize: 17 }}>{r.profiles?.name} · {taskTitle(r.task_key, allExtras)}</strong>
                <span style={{ fontSize: 14 }}><strong>{REASONS[r.reason ?? 4]}:</strong> {r.note}</span>
                {r.ai_note && <span className="small">Coach passed this to you: {r.ai_note}</span>}
                {r.media_path && (
                  <button className="link-btn" style={{ minHeight: 28, padding: 0, fontSize: 14 }} onClick={async () => {
                    const { data, error } = await sb().storage.from('proofs').createSignedUrl(r.media_path!, 300);
                    if (error) flash(errMsg(error)); else window.open(data.signedUrl, '_blank', 'noopener');
                  }}>View proof</button>
                )}
              </div>
              <div className="admin-actions">
                <button className="chip-btn on" disabled={busy} onClick={() => run(async () => { must(await sb().rpc('admin_review', { p_log: r.id, p_accept: true })); return 'Accepted. Day excused.'; })}>Accept</button>
                <button className="chip-btn" style={{ borderColor: C.RT, color: C.RT }} disabled={busy} onClick={() => run(async () => {
                  if (!window.confirm(`Reject ${first(r.profiles?.name ?? '')}'s reason? This is a strike.`)) return;
                  must(await sb().rpc('admin_review', { p_log: r.id, p_accept: false }));
                  return 'Rejected. Strike recorded.';
                })}>Reject</button>
              </div>
            </div>
          ))}
        </section>

        {/* seats */}
        <section className="admin-section">
          <h2 className="display d26 rule-bottom" style={{ paddingBottom: 8 }}>Seats · {ten.length} of 10</h2>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const s = ten.find((x) => x.seat === n);
            const inv = invites.find((x) => x.seat === n);
            return (
              <div key={n} className="admin-row">
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                  <span className="num" style={{ fontSize: 26, width: 44 }}>{roman(n)}</span>
                  {s ? (
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong>{s.name}</strong>
                      <span className="small">{s.training} · {s.streak}-day streak · {s.strikes} strikes · {s.done_today ? 'day locked' : 'logging'}</span>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <strong style={{ color: C.MUTE }}>Open seat</strong>
                      {inv && <span><span className="code">{inv.code}</span> <span className="small">unused invite</span></span>}
                    </span>
                  )}
                </div>
                <div className="admin-actions">
                  {s ? (
                    <button className="chip-btn" disabled={busy} onClick={() => run(async () => {
                      const why = window.prompt(`Remove ${s.name} from Seat ${roman(n)}? Optional note for the room:`, 'was removed by the Admin');
                      if (why === null) return;
                      must(await sb().rpc('admin_remove', { p_uid: s.user_id, p_why: why }));
                      return `Seat ${roman(n)} is open.`;
                    })}>Remove</button>
                  ) : (
                    <>
                      <button className="chip-btn" disabled={busy} onClick={() => run(async () => {
                        const code = must(await sb().rpc('admin_create_invite', { p_seat: n }));
                        return `Invite for Seat ${roman(n)}: ${code}`;
                      })}>{inv ? 'New code' : 'Invite code'}</button>
                      {nextInQueue && n === firstOpen && (
                        <button className="chip-btn on" disabled={busy} onClick={() => run(async () => {
                          if (!window.confirm(`Give Seat ${roman(n)} to ${nextInQueue.name}, first in the queue?`)) return;
                          must(await sb().rpc('admin_assign_seat', { p_uid: nextInQueue.id, p_seat: n }));
                          return `${first(nextInQueue.name)} takes Seat ${roman(n)}.`;
                        })}>Seat {first(nextInQueue.name)}</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <p className="small" style={{ margin: 0 }}>Invite codes are single-use. Share one privately; the athlete enters it when they choose “I hold a seat”.</p>
        </section>

        {/* extras */}
        <section className="admin-section">
          <h2 className="display d26 rule-bottom" style={{ paddingBottom: 8 }}>Today’s extra tasks</h2>
          {extras.map((e) => (
            <div key={e.id} className="admin-row">
              <span>
                <span className="label-strong" style={{ color: C.RT, display: 'block' }}>
                  {e.source === 'coach' ? 'Coach' : 'Admin'} · {e.user_id ? `for ${first(ten.find((x) => x.user_id === e.user_id)?.name ?? 'one athlete')}` : 'for all of the Ten'}
                </span>
                <strong>{e.title}</strong> <span className="small">· {e.proof}</span>
              </span>
              <button className="chip-btn" disabled={busy} onClick={() => run(async () => {
                if (!window.confirm('Delete this extra task? Proof already logged for it is kept.')) return;
                must(await sb().from('extra_tasks').delete().eq('id', e.id));
                return 'Extra task deleted.';
              })}>Delete</button>
            </div>
          ))}
          <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={(ev) => {
            ev.preventDefault();
            run(async () => {
              if (xTitle.trim().length < 3) throw new Error('Name the task.');
              must(await sb().from('extra_tasks').insert({ title: xTitle.trim(), proof: xProof.trim() || 'Photo or clip up to 30 s' }));
              must(await sb().from('messages').insert({ sys: true, text: `Admin: extra task for everyone · ${xTitle.trim()}` }));
              setXTitle('');
              return 'Extra task assigned to the Ten.';
            });
          }}>
            <input className="input" value={xTitle} maxLength={80} onChange={(e) => setXTitle(e.target.value)} placeholder="e.g. Film a 30 s form tip" aria-label="Task" />
            <input className="input" value={xProof} maxLength={120} onChange={(e) => setXProof(e.target.value)} placeholder="Proof required" aria-label="Proof" />
            <button type="submit" className="bar-btn sm" disabled={busy}><span>Assign to the Ten</span><Arrow /></button>
          </form>
          <p className="small" style={{ margin: 0 }}>Extras are required for athletes and lock at 10:00 pm IST like the core tasks. Assign them early in the day.</p>
        </section>

        {/* announce */}
        <section className="admin-section">
          <h2 className="display d26 rule-bottom" style={{ paddingBottom: 8 }}>Message the room</h2>
          <textarea className="input" rows={3} value={announce} maxLength={500} onChange={(e) => setAnnounce(e.target.value)} placeholder="Shown to the Ten as an Admin notice" aria-label="Announcement" />
          <button className="bar-btn sm" disabled={busy} onClick={() => run(async () => {
            if (!announce.trim()) throw new Error('Write something first.');
            must(await sb().from('messages').insert({ sys: true, text: `Admin: ${announce.trim()}` }));
            setAnnounce('');
            return 'Posted to the room.';
          })}><span>Post notice</span><Arrow /></button>
        </section>

        {/* queue */}
        <section className="admin-section">
          <h2 className="display d26 rule-bottom" style={{ paddingBottom: 8 }}>Queue · {queue.length}</h2>
          {queue.length === 0 && <p className="small" style={{ margin: 0 }}>No one in the queue yet.</p>}
          {queue.map((q, i) => (
            <div key={q.id} className="admin-row">
              <span><strong>{i + 1}. {q.name}</strong> <span className="small">· {q.training}</span></span>
              <span className="small">{q.trial_done_at ? `Completed ${shortDate(q.trial_done_at)}` : `Trial day ${Math.min(q.trial_days + 1, 7)} of 7`}</span>
            </div>
          ))}
        </section>

        {/* season */}
        {settings && (
          <section className="admin-section">
            <h2 className="display d26 rule-bottom" style={{ paddingBottom: 8 }}>Season</h2>
            <label className="field"><span>Name</span>
              <input className="input" value={settings.season_name} maxLength={40} onChange={(e) => setSettings({ ...settings, season_name: e.target.value })} />
            </label>
            <label className="field"><span>Day I (IST date)</span>
              <input className="input" type="date" value={settings.season_start} onChange={(e) => setSettings({ ...settings, season_start: e.target.value })} />
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="chip-btn on" disabled={busy} onClick={() => run(async () => {
                must(await sb().from('settings').update({ season_name: settings.season_name.trim() || 'Season I', season_start: settings.season_start }).eq('id', 1));
                return 'Season saved.';
              })}><Check size={14} /> Save season</button>
              <button className="chip-btn" disabled={busy} onClick={() => run(async () => {
                const n = must(await sb().rpc('close_pending'));
                return Number(n) ? `Closed pending days · ${n} members scored.` : 'Every past day is already closed.';
              })}>Close past days now</button>
              <button className="chip-btn" disabled={busy} onClick={() => run(async () => {
                const { data: { session } } = await sb().auth.getSession();
                const res = await fetch('/api/coach/run', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
                const out = await res.json();
                if (!res.ok) throw new Error(out.error || 'The Coach could not run.');
                return `Coach: ${out.planned} tasks set · ${out.reviewed} reasons ruled · ${out.seated} seats filled.`;
              })}>Run the Coach now</button>
            </div>
            <p className="small" style={{ margin: 0 }}>Days close automatically after midnight IST, then the Coach seats the queue, rules on waiting reasons and sets each athlete’s personal task. The buttons run the same steps now.</p>
          </section>
        )}
      </div>
      {toast && <div className="toast" style={{ position: 'fixed', maxWidth: 520, margin: '0 auto', top: 16 }} role="status"><span className="mark">{toast.ok ? <Check size={16} /> : '!'}</span>{toast.msg}</div>}
    </main>
  );
}
