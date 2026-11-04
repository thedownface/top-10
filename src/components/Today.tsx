'use client';

import { C, CORE_TASKS, countdown, first, roman, tasksLocked, type Task } from '@/lib/core';
import { useApp } from './ctx';
import { Board } from './Puzzle';
import { Arrow } from './Icons';

const TAGS: Record<string, [string, string, string, string]> = {
  // label, background, text, border
  done: ['Done', C.INK, C.P, C.INK],
  review: ['In review', 'transparent', C.RT, C.RED],
  excused: ['Excused', 'transparent', C.MUTE, C.MUTE],
  rejected: ['Strike', C.RED, C.INK, C.RED],
  open: ['Log', 'transparent', C.INK, C.INK],
  closed: ['Reason', 'transparent', C.RT, C.RT],
};

export function Today() {
  const app = useApp();
  const { profile, logs, ten, now, dayNo, settings, isAthlete, isQueue, isCommunity, queuePos } = app;

  const tasks: Task[] = [
    ...CORE_TASKS,
    ...(isAthlete
      ? app.extras.map((e) => ({
          key: 'x' + e.id, num: '+', title: e.title, proof: e.proof, kind: 'media' as const, extra: true, maxClip: 30,
          from: e.source === 'coach' ? (e.user_id ? 'From the Coach · just for you' : 'From the Coach · today') : 'From Admin · today',
        }))
      : []),
  ];
  const locked = tasksLocked(now);
  const doneN = CORE_TASKS.filter((t) => logs[t.key]?.status === 'done').length;
  const allDone = tasks.every((t) => logs[t.key]?.status === 'done');
  const cT = countdown(now, 22, 0), cE = countdown(now, 23, 59, 59);
  const trialDay = Math.min(profile.trial_days + 1, 7);
  const trialDone = !!profile.trial_done_at;

  const stats = isQueue
    ? [
        { label: 'Trial', value: trialDone ? '7/7' : `${trialDay}/7` },
        { label: 'Logged', value: `${doneN}/6` },
        { label: 'Queue', value: `#${queuePos}` },
      ]
    : [
        { label: 'Streak', value: String(profile.streak + (allDone ? 1 : 0)) },
        { label: 'Logged', value: `${doneN}/6` },
        { label: 'Strikes', value: String(profile.strikes) },
      ];

  const boardDone = ten.filter((s) => s.done_today).map((s) => s.seat - 1);

  return (
    <div data-screen-label="05 Today" className="scroll fade-up">
      {!isCommunity && (
        <>
          <div style={{ padding: '4px 24px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span className="kicker">
                {isQueue
                  ? trialDone ? 'Trial complete · in the queue' : `Trial · Day ${roman(trialDay)} of VII`
                  : `Day ${roman(dayNo)} · ${settings.season_name}`}
              </span>
              <span style={{ border: C.DIV, padding: '4px 8px', fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {isQueue ? `Queue #${queuePos}` : `Seat ${roman(profile.seat ?? 0)}`}
              </span>
            </div>
            <h1 className="display d52">
              {isQueue ? (trialDone ? 'Stay ready.' : 'Prove you can keep up.') : `${first(profile.name)}, hold your seat.`}
            </h1>
          </div>
          <div className="stat-grid">
            {stats.map((s) => (
              <div key={s.label} className="stat">
                <span className="label">{s.label}</span>
                <span className="v">{s.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: C.DIV }}>
            <div style={{ padding: '12px 16px', borderRight: C.DIV, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="label">Tasks lock · 10:00 pm</span>
              <span className="tabular" style={{ fontSize: 22, fontWeight: 700, color: cT.urgent ? C.RT : C.INK }}>{cT.s}</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="label">EOD post · 11:59 pm</span>
              <span className="tabular" style={{ fontSize: 22, fontWeight: 700 }}>{cE.s}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '22px 24px 8px' }}>
            <h2 className="display d26">Your tasks</h2>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.MUTE }}>{locked ? 'Missed one? Send a reason' : 'Tap to log proof'}</span>
          </div>
          <div className="rule-top">
            {tasks.map((t) => {
              const st = logs[t.key]?.status ?? (locked && t.kind !== 'eod' ? 'closed' : 'open');
              const [tag, bg, fg, border] = TAGS[st];
              return (
                <button key={t.key} className="task-row" onClick={() => app.openTask(t)}>
                  <span className="num" style={{ fontSize: 26 }}>{t.num}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    {t.from && <span className="label" style={{ color: C.RT }}>{t.from}</span>}
                    <span style={{ fontSize: 17, fontWeight: 700 }}>{t.title}</span>
                    <span style={{ fontSize: 13, color: C.MUTE, lineHeight: 1.35, textWrap: 'pretty' }}>{t.proof}</span>
                  </span>
                  <span className="tag" style={{ borderColor: border, background: bg, color: fg }}>{tag}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {isCommunity && (
        <>
          <div style={{ padding: '4px 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="kicker">Following the Ten · Day {roman(dayNo)}</span>
            <h1 className="display d52">Watch the Ten. Then join them.</h1>
          </div>
          <div style={{ background: C.RED, padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: C.DIV, borderBottom: C.DIV }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase' }}>Earn a seat</span>
            <h2 className="display d36">Seven days. Same tasks. Logged in the app.</h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, fontWeight: 600 }}>Queue order is the date you finish. First in, first invited.</p>
            <button className="bar-btn" onClick={app.startTrial}><span>Start the 7-day trial</span><Arrow /></button>
          </div>
          <div style={{ display: 'grid', borderBottom: C.DIV, padding: '14px 24px', gap: 4 }}>
            <span className="label">Tonight’s learnings drop by 11:59 pm</span>
            <span className="tabular" style={{ fontSize: 22, fontWeight: 700 }}>{cE.s}</span>
          </div>
        </>
      )}

      <div style={{ padding: '24px 24px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="display d26">The Figure</h2>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{boardDone.length} of 10 in place</span>
        </div>
        <p className="small" style={{ margin: 0, fontSize: 14 }}>Each seat is one piece. A piece turns dark when its athlete has logged the whole day.</p>
      </div>
      <div style={{ padding: '8px 24px 20px' }}>
        <Board done={boardDone} mine={isAthlete && profile.seat ? profile.seat - 1 : -1} />
      </div>
      <div style={{ margin: '0 24px 28px', paddingTop: 18, borderTop: C.DIV, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45, fontStyle: 'italic', textWrap: 'pretty' }}>“Waste no more time arguing about what a good man should be. Be one.”</p>
        <span className="kicker">Marcus Aurelius · Meditations</span>
      </div>
    </div>
  );
}
