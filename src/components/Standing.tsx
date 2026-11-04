'use client';

import { C, roman, shortDate } from '@/lib/core';
import { useApp, type RankTab } from './ctx';
import { Arrow } from './Icons';

const PRINCIPLES: [string, string][] = [
  ['Discipline is shown, not claimed:', 'every task and every excuse needs proof.'],
  ['Grow together:', 'each member is responsible for helping others in the 10 grow.'],
  ['Value to the community every day:', 'the EOD post is the product.'],
  ['Fair and transparent:', 'the rules and queue order are public.'],
];

export function Standing({ tab }: { tab: RankTab }) {
  const app = useApp();
  const { ten, queue, profile, uid, isAthlete, isQueue, isCommunity, logs } = app;

  const allDoneToday = isAthlete && ['1', '2', '3', '4', '5', '6'].every((k) => logs[k]?.status === 'done');
  const leaders = [...ten]
    .map((s) => ({ ...s, streak: s.streak + (s.user_id === uid && allDoneToday ? 1 : 0) }))
    .sort((a, b) => b.streak - a.streak || a.seat - b.seat);
  const openSeats = 10 - ten.length;
  const trialDay = Math.min(profile.trial_days + 1, 7);

  return (
    <div data-screen-label="08 Standing" className="scroll fade-up">
      <div style={{ padding: '4px 24px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="kicker">Fair and transparent</span>
        <h1 className="display d52">Standing</h1>
      </div>
      <div className="seg caps" style={{ gridTemplateColumns: 'repeat(3,1fr)', borderLeft: 0, borderRight: 0 }}>
        {([['ten', 'The Ten'], ['queue', 'Queue'], ['rules', 'Rules']] as const).map(([k, l], i) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => app.setRankTab(k)} style={{ borderRight: i < 2 ? C.DIV : 0 }}>{l}</button>
        ))}
      </div>

      {tab === 'ten' && (
        <>
          {leaders.map((r, k) => (
            <div key={r.seat} className="leader" style={{ background: r.user_id === uid ? C.P : 'transparent' }}>
              <span className="num" style={{ fontSize: 22 }}>{k + 1}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{r.name}{r.user_id === uid ? ' (you)' : ''}</span>
                <span style={{ fontSize: 12, color: C.MUTE, fontWeight: 600 }}>Seat {roman(r.seat)} · {r.training}</span>
              </span>
              <span className="strikes" aria-label={`${r.strikes} strikes`}>
                {[0, 1, 2].map((i) => <span key={i} className={r.strikes > i ? 'on' : ''} />)}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 3, minWidth: 52, justifyContent: 'flex-end' }}>
                <span className="num" style={{ fontSize: 28 }}>{r.streak}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.MUTE }}>d</span>
              </span>
            </div>
          ))}
          {openSeats > 0 && (
            <div className="leader">
              <span className="num" style={{ fontSize: 22, opacity: 0.4 }}>—</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.MUTE }}>{openSeats} open {openSeats === 1 ? 'seat' : 'seats'} · invited from the queue</span>
            </div>
          )}
          <p className="small" style={{ margin: 0, padding: '14px 24px 28px' }}>Ranked by current streak. Squares show strikes from rejected reasons. Three strikes lose the seat.</p>
        </>
      )}

      {tab === 'queue' && (
        <>
          {isQueue && !profile.trial_done_at && (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: C.DIV, background: C.P }}>
              <span className="label-strong" style={{ color: C.RT }}>Your 7-day self-challenge</span>
              <span className="display" style={{ fontSize: 34, lineHeight: 0.95 }}>Day {roman(trialDay)} of VII</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const bg = i < profile.trial_days ? C.INK : i === profile.trial_days ? C.RED : 'transparent';
                  return (
                    <span key={i} style={{ height: 34, border: C.DIV, background: bg, color: i < profile.trial_days ? C.P : C.INK, display: 'flex', alignItems: 'flex-end', padding: '3px 5px', fontSize: 10, fontWeight: 800 }}>
                      {roman(i + 1)}
                    </span>
                  );
                })}
              </div>
              <span style={{ fontSize: 14, lineHeight: 1.4 }}>Finish all seven days in a row to take your place in the queue. A missed day restarts the count.</span>
            </div>
          )}
          {isCommunity && (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: C.DIV, background: C.RED }}>
              <span style={{ fontSize: 15, lineHeight: 1.4, fontWeight: 700 }}>Complete a 7-day self-challenge to join the queue.</span>
              <button className="bar-btn sm" onClick={app.startTrial}><span>Start the trial</span><Arrow /></button>
            </div>
          )}
          <div style={{ padding: '18px 24px 8px' }}>
            <span className="small">Order = date the 7-day challenge was completed. First in, first invited.</span>
          </div>
          {queue.length === 0 && <p className="empty">The queue is empty. Be first.</p>}
          {queue.map((q, i) => (
            <div key={q.id} className="queue-row" style={{ background: q.id === uid ? C.P : 'transparent' }}>
              <span className="num" style={{ fontSize: 28 }}>{i + 1}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{q.name}{q.id === uid ? ' (you)' : ''}</span>
                <span style={{ fontSize: 12, color: C.MUTE, fontWeight: 600 }}>{q.training}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right' }}>
                {q.trial_done_at ? `Completed ${shortDate(q.trial_done_at)}` : `Trial day ${Math.min(q.trial_days + 1, 7)} of 7`}
              </span>
            </div>
          ))}
          <div style={{ height: 28 }} />
        </>
      )}

      {tab === 'rules' && (
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ margin: 0, fontStretch: '80%', fontSize: 22, lineHeight: 1.3, fontWeight: 700, textWrap: 'pretty' }}>
            Every day each athlete must either complete all assigned tasks with proof, or post a valid reason with proof by the deadline; anything else removes them from the Top 10.
          </p>
          <div className="rule-top" style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="label-strong" style={{ color: C.MUTE, padding: '12px 0 6px' }}>Deadlines · IST</span>
            <div className="kv"><span>Tasks 1–5</span><span style={{ fontWeight: 800 }}>10:00 pm</span></div>
            <div className="kv"><span>EOD learning post</span><span style={{ fontWeight: 800 }}>11:59 pm</span></div>
            <div className="kv"><span>Missed-task reason</span><span style={{ fontWeight: 800 }}>11:59 pm</span></div>
          </div>
          <div className="rule-top" style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="label-strong" style={{ color: C.MUTE, padding: '12px 0 6px' }}>Outcomes</span>
            <div className="kv2"><span>All tasks done with proof</span><span style={{ fontWeight: 800 }}>Day counted, streak continues</span></div>
            <div className="kv2"><span>Reason accepted</span><span style={{ fontWeight: 800 }}>Day excused, streak paused (not broken)</span></div>
            <div className="kv2"><span>Reason rejected</span><span style={{ fontWeight: 800, color: C.RT }}>1 strike, streak reset</span></div>
            <div className="kv2"><span>Three strikes, or a miss with no reason</span><span style={{ fontWeight: 800, color: C.RT }}>Seat goes to the queue</span></div>
          </div>
          <div className="rule-top" style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="label-strong" style={{ color: C.MUTE, padding: '12px 0 6px' }}>Principles</span>
            {PRINCIPLES.map(([h, t], i) => (
              <div key={i} className="numbered row-rule" style={{ gridTemplateColumns: '36px minmax(0,1fr)' }}>
                <span className="n">{roman(i + 1)}</span>
                <span style={{ fontSize: 15, lineHeight: 1.4 }}><strong>{h}</strong> {t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
