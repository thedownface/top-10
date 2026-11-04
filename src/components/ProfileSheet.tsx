'use client';

import { useState } from 'react';
import { sb } from '@/lib/supabase';
import { C, errMsg, roman, TRAININGS } from '@/lib/core';
import { useApp } from './ctx';
import { Arrow, Close } from './Icons';

export function ProfileSheet({ isAdmin, onClose }: { isAdmin: boolean; onClose: () => void }) {
  const { profile, refresh, flash, startTrial, isAthlete, isQueue, isCommunity } = useApp();
  const [name, setName] = useState(profile.name);
  const [training, setTraining] = useState(profile.training);
  const [goal, setGoal] = useState(profile.goal);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = name !== profile.name || training !== profile.training || goal !== profile.goal;

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { flash(errMsg(e)); } finally { setBusy(false); }
  };

  const save = () => run(async () => {
    if (name.trim().length < 2) throw new Error('Add your name.');
    const { error } = await sb().from('profiles').update({ name: name.trim(), training, goal: goal.trim() }).eq('id', profile.id);
    if (error) throw error;
    await refresh();
    flash('Profile saved.', 'ok');
  });

  const redeem = () => run(async () => {
    const { data, error } = await sb().rpc('redeem_invite', { p_code: code });
    if (error) throw error;
    await refresh();
    onClose();
    flash(`Seat ${roman(Number(data))} is yours.`, 'ok');
  });

  const leave = () => run(async () => {
    const msg = isAthlete
      ? 'Give up your seat? It goes to the next in the queue and your streak resets.'
      : 'Leave the queue? Your trial progress resets.';
    if (!window.confirm(msg)) return;
    const { error } = await sb().rpc('leave_path');
    if (error) throw error;
    await refresh();
    onClose();
    flash(isAthlete ? 'Seat released.' : 'You left the queue.', 'ok');
  });

  const signOut = () => run(async () => {
    await sb().auth.signOut();
    onClose();
  });

  const path = isAthlete ? `Top 10 athlete · Seat ${roman(profile.seat ?? 0)}` : isQueue ? 'Queue member' : 'Community member';

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Your profile">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="label-strong" style={{ color: C.MUTE }}>{path}</span>
          <button className="icon-btn" style={{ marginRight: -10 }} aria-label="Close" onClick={onClose}><Close /></button>
        </div>
        <h2 className="display d38" style={{ marginTop: -8 }}>{profile.name || 'Your profile'}</h2>

        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>Training</span>
          <div className="seg" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            {TRAININGS.map((t, i) => (
              <button key={t} className={training === t ? 'on' : ''} onClick={() => setTraining(t)}
                style={{ borderRight: i % 2 === 0 ? C.DIV : 0, borderBottom: i < 2 ? C.DIV : 0 }}>{t}</button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Goal for this season</span>
          <input className="input" value={goal} maxLength={140} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. 15 strict pull-ups by March" />
        </label>
        {dirty && <button className="bar-btn" onClick={save} disabled={busy}><span>Save profile</span><Arrow /></button>}

        <div className="rule-top" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
          <span className="label-strong" style={{ color: C.MUTE }}>Your path</span>
          {isCommunity && (
            <button className="outline-btn" onClick={() => run(async () => { await startTrial(); onClose(); })}>
              <span>Start the 7-day trial</span><Arrow />
            </button>
          )}
          {!isAthlete && (
            <div className="inline-form">
              <input value={code} maxLength={12} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Invite code from the Admin" aria-label="Invite code" style={{ letterSpacing: '.08em', fontWeight: 700 }} />
              <button onClick={redeem} disabled={busy || code.trim().length < 6}>Take seat</button>
            </div>
          )}
          {(isAthlete || isQueue) && (
            <button className="link-btn red" onClick={leave}>{isAthlete ? 'Give up my seat' : 'Leave the queue'}</button>
          )}
        </div>

        <div className="rule-top" style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
          {isAdmin && <a className="link-btn" href="/admin" style={{ display: 'flex', alignItems: 'center' }}>Open the Admin desk</a>}
          <button className="link-btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </>
  );
}
