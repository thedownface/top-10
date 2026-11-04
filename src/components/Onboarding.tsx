'use client';

import { roman, TRAININGS, type Role } from '@/lib/core';
import { Board, Hero } from './Puzzle';
import { Arrow, Back, Check } from './Icons';

export type Draft = {
  role: Role;
  name: string;
  training: string;
  goal: string;
  o18: boolean;
  oRules: boolean;
  code: string;
};

export const emptyDraft: Draft = { role: 'community', name: '', training: 'Gym', goal: '', o18: false, oRules: false, code: '' };

export function draftReady(d: Draft): boolean {
  if (d.name.trim().length < 2 || !d.training) return false;
  if (d.role === 'community') return true;
  if (d.goal.trim().length < 3 || !d.o18 || !d.oRules) return false;
  return d.role !== 'athlete' || d.code.trim().length >= 6;
}

const LOOP = [
  'The Admin assigns the day’s tasks.',
  'You get reminders, complete them, and log proof.',
  'In the private chat, the Ten share, discuss and push each other.',
  'Miss a task? Post a valid reason with proof, or lose your seat to the next in the queue.',
  'Every evening, each athlete posts one learning to the Agora.',
  'The community reacts, supports, and joins the queue to earn a seat.',
];

const PATHS: { r: Role; role: string; title: string; desc: string }[] = [
  { r: 'community', role: 'Community member', title: 'Follow the Ten', desc: 'Read every learning. Like, comment, send support, follow athletes.' },
  { r: 'queue', role: 'Queue member', title: 'Earn a seat', desc: 'Complete a 7-day self-challenge with the same tasks. First in, first invited.' },
  { r: 'athlete', role: 'Top 10 athlete', title: 'I hold a seat', desc: 'Invited by the Admin with a code. Daily tasks, proof, the private chat.' },
];

type Props = {
  step: number;
  setStep: (n: number) => void;
  draft: Draft;
  setDraft: (d: Draft) => void;
  busy: boolean;
  signedIn: boolean;
  flash: (m: string, tone?: 'ok') => void;
  onFinish: () => void;
  onSignIn: () => void;
};

export function Onboarding({ step, setStep, draft, setDraft, busy, signedIn, flash, onFinish, onSignIn }: Props) {
  const isCommunity = draft.role === 'community';
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p });
  const nextOk = step !== 3 || draftReady(draft);

  const next = () => {
    if (busy) return;
    if (!nextOk) {
      flash(isCommunity ? 'Add your name to continue.' : draft.role === 'athlete' && draft.code.trim().length < 6 && draft.goal && draft.o18 && draft.oRules ? 'Add the invite code from the Admin.' : 'Complete your profile and take the oath.');
      return;
    }
    if (step < 3) setStep(step + 1);
    else onFinish();
  };

  if (step === 0) {
    return (
      <div data-screen-label="01 Welcome" className="screen fade-in">
        <div style={{ flex: 1, minHeight: 0, position: 'relative', borderBottom: '2px solid var(--ink)' }}><Hero /></div>
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 'none' }}>
          <span className="kicker">Season I · Ten seats</span>
          <h1 className="display d56">Ten seats.<br />One standard.</h1>
          <p className="lede">Ten athletes build discipline in public. Every task needs proof. Every evening, one learning for everyone watching.</p>
          <div className="progress"><span className="on" /><span /><span /><span /></div>
          <button className="bar-btn" onClick={next}><span>Begin</span><Arrow /></button>
          {!signedIn && (
            <button className="link-btn" style={{ minHeight: 32, padding: 0, fontSize: 14 }} onClick={onSignIn}>
              I already have an account
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 24px 12px', flex: 'none' }}>
        <button className="back-btn" onClick={() => setStep(Math.max(0, step - 1))}><Back />Back</button>
        <span className="kicker">{roman(step + 1)} / IV</span>
      </div>

      {step === 1 && (
        <div data-screen-label="02 The loop" className="scroll fade-up" style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span className="kicker">How the day turns</span>
          <h1 className="display d44">Discipline is shown, not claimed.</h1>
          <div style={{ padding: '8px 0' }}><Board done={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]} mine={6} assemble /></div>
          <div className="rule-top">
            {LOOP.map((t, i) => (
              <div key={i} className="numbered row-rule">
                <span className="n">{roman(i + 1)}</span>
                <span style={{ fontSize: 15, lineHeight: 1.4, textWrap: 'pretty' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div data-screen-label="03 Choose path" className="scroll fade-up" style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span className="kicker">Choose your path</span>
          <h1 className="display d44">Where do you stand?</h1>
          <p className="body">The rules and the queue order are public. You can change paths later.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} role="radiogroup" aria-label="Path">
            {PATHS.map((p) => {
              const on = draft.role === p.r;
              return (
                <button
                  key={p.r}
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ role: p.r })}
                  style={{
                    display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 28px', gap: 12, alignItems: 'start', width: '100%',
                    padding: 18, textAlign: 'left', border: '2px solid var(--ink)',
                    background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--p)' : 'var(--ink)',
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.8 }}>{p.role}</span>
                    <span className="display" style={{ fontSize: 30, lineHeight: 0.95 }}>{p.title}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.4 }}>{p.desc}</span>
                  </span>
                  <span style={{ width: 28, height: 28, border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {on && <Check />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div data-screen-label="04 Oath" className="scroll fade-up" style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span className="kicker">{isCommunity ? 'Your profile' : 'The oath'}</span>
          <h1 className="display d44">{isCommunity ? 'Who is watching?' : 'Say what you will be.'}</h1>
          <label className="field">
            <span>Name</span>
            <input className="input" value={draft.name} maxLength={60} autoComplete="name" onChange={(e) => set({ name: e.target.value })} placeholder="Your full name" />
          </label>
          <div className="field">
            <span>Training</span>
            <div className="seg" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
              {TRAININGS.map((t, i) => (
                <button
                  key={t}
                  className={draft.training === t ? 'on' : ''}
                  aria-pressed={draft.training === t}
                  onClick={() => set({ training: t })}
                  style={{ borderRight: i % 2 === 0 ? '2px solid var(--ink)' : 0, borderBottom: i < 2 ? '2px solid var(--ink)' : 0 }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {!isCommunity && (
            <>
              <label className="field">
                <span>Goal for this season</span>
                <input className="input" value={draft.goal} maxLength={140} onChange={(e) => set({ goal: e.target.value })} placeholder="e.g. 15 strict pull-ups by March" />
              </label>
              {draft.role === 'athlete' && (
                <label className="field">
                  <span>Invite code from the Admin</span>
                  <input
                    className="input"
                    value={draft.code}
                    maxLength={12}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                    placeholder="8 characters"
                    style={{ letterSpacing: '.12em', fontWeight: 700 }}
                  />
                </label>
              )}
              <div className="rule-top">
                {([
                  ['o18', 'I am 18 or older.'],
                  ['oRules', 'I agree to the daily standard and the group rules: every task with proof, every excuse with proof.'],
                ] as const).map(([k, t]) => (
                  <button
                    key={k}
                    role="checkbox"
                    aria-checked={draft[k]}
                    onClick={() => set({ [k]: !draft[k] })}
                    className="row-rule"
                    style={{
                      display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 14, alignItems: 'start', width: '100%',
                      padding: '14px 0', background: 'transparent', border: 0, borderBottom: '2px solid var(--rule)', textAlign: 'left', color: 'var(--ink)',
                    }}
                  >
                    <span className={'check' + (draft[k] ? ' on' : '')}>{draft[k] && <Check />}</span>
                    <span style={{ fontSize: 15, lineHeight: 1.4 }}>{t}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="quote">“First say to yourself what you would be; and then do what you have to do.” — Epictetus</p>
        </div>
      )}

      <div style={{ padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12, flex: 'none', borderTop: '2px solid var(--ink)' }}>
        <div className="progress">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
        <button className={'bar-btn' + (nextOk && !busy ? '' : ' dim')} onClick={next} aria-disabled={!nextOk || busy}>
          <span>{busy ? 'Saving…' : step === 3 ? (isCommunity ? 'Enter the Agora' : 'Take the oath') : 'Continue'}</span>
          <Arrow />
        </button>
      </div>
    </div>
  );
}
