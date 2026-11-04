'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sb, supabaseConfigured } from '@/lib/supabase';
import {
  dayNumber, errMsg, first, istClock, istDate, tasksLocked,
  type ExtraTask, type Profile, type Seat, type Settings, type Task, type TaskLog,
} from '@/lib/core';
import { Ctx, type AppCtx, type AppData, type QueueRow, type RankTab, type Tab } from './ctx';
import { Onboarding, emptyDraft, draftReady, type Draft } from './Onboarding';
import { Auth, Recovery } from './Auth';
import { Today } from './Today';
import { TheTen } from './TheTen';
import { Agora } from './Agora';
import { Standing } from './Standing';
import { ProofSheet } from './ProofSheet';
import { ProfileSheet } from './ProfileSheet';
import { Check, Columns, ListNum, Sun, User, Users } from './Icons';

type Phase = 'boot' | 'setup' | 'onb' | 'auth' | 'recovery' | 'app';
type Sheet = { task: Task; mode: 'log' | 'miss' } | null;

const DRAFT_KEY = 't10-draft';

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...emptyDraft, ...JSON.parse(raw) } : emptyDraft;
  } catch {
    return emptyDraft;
  }
}
function saveDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* private mode */ }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraftState] = useState<Draft>(emptyDraft);
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [data, setData] = useState<AppData | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [rankTab, setRankTab] = useState<RankTab>('ten');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const uid = session?.user.id ?? null;
  const today = istDate(now);

  const flash = useCallback((msg: string, tone?: 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok: tone === 'ok' });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const setDraft = useCallback((d: Draft) => { setDraftState(d); saveDraft(d); }, []);

  // ── clock & draft ───────────────────────────────────────────────────
  useEffect(() => {
    setDraftState(loadDraft());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── auth ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseConfigured) { setPhase('setup'); return; }
    const client = sb();
    client.auth.getSession().then(({ data: d }) => setSession(d.session));
    const { data: sub } = client.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setPhase('recovery');
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── data ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!uid) return;
    const client = sb();
    const d = istDate(Date.now());
    const [p, st, ten, logs, ex, q] = await Promise.all([
      client.from('profiles').select('*').eq('id', uid).single(),
      client.from('settings').select('season_name, season_start').eq('id', 1).single(),
      client.rpc('the_ten'),
      client.from('task_logs').select('id, task_key, status').eq('user_id', uid).eq('log_date', d),
      client.from('extra_tasks').select('id, for_date, title, proof, user_id, source').eq('for_date', d).order('id'),
      client.from('profiles').select('id, name, training, trial_days, trial_done_at, trial_start')
        .eq('role', 'queue')
        .order('trial_done_at', { ascending: true, nullsFirst: false })
        .order('trial_days', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(200),
    ]);
    const err = p.error || st.error || ten.error || logs.error || ex.error || q.error;
    if (err) throw err;
    const logMap: Record<string, TaskLog> = {};
    for (const l of logs.data as TaskLog[]) logMap[l.task_key] = l;
    setData({
      profile: p.data as Profile,
      settings: st.data as Settings,
      ten: ten.data as Seat[],
      logs: logMap,
      extras: ex.data as ExtraTask[],
      queue: q.data as QueueRow[],
    });
  }, [uid]);

  const finishOnboarding = useCallback(async (d: Draft) => {
    setBusy(true);
    try {
      const { data: role, error } = await sb().rpc('complete_onboarding', {
        p_name: d.name, p_training: d.training, p_goal: d.goal, p_path: d.role, p_code: d.code || null,
      });
      if (error) throw error;
      saveDraft(null);
      await refresh();
      setTab('today');
      setPhase('app');
      flash(role === 'community' ? `Welcome to the Agora, ${first(d.name)}.` : role === 'queue' ? 'Trial begins. Day I of VII.' : 'Oath taken. Your seat is held.', 'ok');
    } catch (e) {
      flash(errMsg(e));
      setStep(3);
      setPhase('onb');
    } finally {
      setBusy(false);
    }
  }, [refresh, flash]);

  // Session changes decide the phase.
  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setData(null);
      setPhase((ph) => (ph === 'auth' || ph === 'setup' ? ph : 'onb'));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: p, error } = await sb().from('profiles').select('*').eq('id', session.user.id).single();
        if (error) throw error;
        if (cancelled) return;
        const prof = p as Profile;
        if (prof.onboarded) {
          await refresh();
          if (!cancelled) setPhase((ph) => (ph === 'recovery' ? ph : 'app'));
          return;
        }
        const d = loadDraft();
        if (draftReady(d)) { await finishOnboarding(d); return; }
        setDraftState({ ...d, name: d.name || prof.name });
        setStep(0);
        setPhase((ph) => (ph === 'recovery' ? ph : 'onb'));
      } catch (e) {
        if (!cancelled) { flash(errMsg(e)); setPhase('onb'); }
      }
    })();
    return () => { cancelled = true; };
    // Keyed on "pending" / "signed out" / user id so the signed-out case runs too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session === undefined ? 'pending' : session?.user.id ?? 'signed-out']);

  // Refresh when the app comes back, every 90 s while visible, and at midnight IST.
  useEffect(() => {
    if (phase !== 'app') return;
    const onVis = () => { if (document.visibilityState === 'visible') refresh().catch(() => {}); };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(onVis, 90000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(t); };
  }, [phase, refresh]);
  const lastDay = useRef(today);
  useEffect(() => {
    if (lastDay.current !== today) { lastDay.current = today; if (phase === 'app') refresh().catch(() => {}); }
  }, [today, phase, refresh]);

  // ── actions shared with screens ─────────────────────────────────────
  const openTask = useCallback((t: Task) => {
    if (t.kind === 'eod') { setTab('agora'); return; }
    const st = data?.logs[t.key]?.status;
    if (st === 'done') { flash(`${t.title} is already locked.`); return; }
    if (st === 'review') { flash('Your reason is with the Admin. Reply within 24 h.'); return; }
    if (st === 'excused') { flash('Excused by the Admin. Streak paused.'); return; }
    if (st === 'rejected') { flash('Reason rejected · 1 strike.'); return; }
    setSheet({ task: t, mode: tasksLocked(Date.now()) ? 'miss' : 'log' });
  }, [data, flash]);

  const startTrial = useCallback(async () => {
    const { error } = await sb().rpc('start_trial');
    if (error) { flash(errMsg(error)); return; }
    await refresh();
    setTab('today');
    flash('Trial started. Day I of VII.', 'ok');
  }, [refresh, flash]);

  const ctx: AppCtx | null = useMemo(() => {
    if (!data || !uid) return null;
    const role = data.profile.role;
    const queuePos = Math.max(1, data.queue.findIndex((q) => q.id === uid) + 1);
    return {
      ...data, uid, now, today,
      dayNo: dayNumber(today, data.settings.season_start),
      isAthlete: role === 'athlete', isQueue: role === 'queue', isCommunity: role === 'community',
      queuePos, flash, refresh, setTab, setRankTab, openTask, startTrial,
      openReason: (t: Task) => setSheet({ task: t, mode: 'miss' }),
    };
  }, [data, uid, now, today, flash, refresh, openTask, startTrial]);

  const isAdmin = !!data?.profile.is_admin;

  return (
    <div className="stage">
      <div className="phone" data-screen-label="Top 10 phone">
        <header className="statusbar">
          <span className="tabular">{istClock(now)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="brand">TOP 10 · IST</span>
            {phase === 'app' && (
              <button className="icon-btn" style={{ width: 36, height: 36, marginRight: -8 }} aria-label="Your profile" onClick={() => setProfileOpen(true)}>
                <User size={18} />
              </button>
            )}
          </span>
        </header>

        {phase === 'boot' && <div className="screen" aria-busy="true" />}
        {phase === 'setup' && <SetupNeeded />}
        {phase === 'onb' && (
          <Onboarding
            step={step}
            setStep={setStep}
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            flash={flash}
            signedIn={!!session}
            onSignIn={() => { setAuthMode('signin'); setPhase('auth'); }}
            onFinish={() => {
              if (session) finishOnboarding(draft);
              else { setAuthMode('signup'); setPhase('auth'); }
            }}
          />
        )}
        {phase === 'auth' && (
          <Auth
            mode={authMode}
            setMode={setAuthMode}
            draft={draft}
            flash={flash}
            onBack={() => setPhase('onb')}
          />
        )}
        {phase === 'recovery' && (
          <Recovery flash={flash} onDone={() => setPhase(data ? 'app' : 'onb')} />
        )}

        {phase === 'app' && ctx && (
          <Ctx.Provider value={ctx}>
            <div className="screen">
              {tab === 'today' && <Today />}
              {tab === 'ten' && <TheTen isAdmin={isAdmin} />}
              {tab === 'agora' && <Agora isAdmin={isAdmin} />}
              {tab === 'ranks' && <Standing tab={rankTab} />}
            </div>
            <nav className="tabbar" aria-label="Sections">
              {([
                ['today', 'Today', <Sun key="i" />],
                ['ten', 'The Ten', <Users key="i" />],
                ['agora', 'Agora', <Columns key="i" />],
                ['ranks', 'Standing', <ListNum key="i" />],
              ] as const).map(([k, label, icon]) => (
                <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
                  {icon}{label}
                </button>
              ))}
            </nav>
            {sheet && (
              <ProofSheet
                key={sheet.task.key}
                task={sheet.task}
                initialMode={sheet.mode}
                onClose={() => setSheet(null)}
                onLocked={(msg) => { setSheet(null); flash(msg, 'ok'); }}
              />
            )}
            {profileOpen && <ProfileSheet isAdmin={isAdmin} onClose={() => setProfileOpen(false)} />}
          </Ctx.Provider>
        )}

        {toast && (
          <div className="toast" role="status" aria-live="polite">
            <span className="mark">{toast.ok ? <Check size={16} /> : '!'}</span>{toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="screen pad fade-up" style={{ justifyContent: 'flex-end', gap: 16, paddingBottom: 28 }}>
      <span className="kicker">Setup</span>
      <h1 className="display d52">Connect the database.</h1>
      <p className="lede">
        Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, then redeploy. The README walks through it.
      </p>
    </div>
  );
}
