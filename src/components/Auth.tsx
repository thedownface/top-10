'use client';

import { useState, type FormEvent } from 'react';
import { sb } from '@/lib/supabase';
import { errMsg } from '@/lib/core';
import type { Draft } from './Onboarding';
import { Arrow, Back } from './Icons';

const GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_AUTH === 'true';

type Props = {
  mode: 'signup' | 'signin';
  setMode: (m: 'signup' | 'signin') => void;
  draft: Draft;
  flash: (m: string, tone?: 'ok') => void;
  onBack: () => void;
};

export function Auth({ mode, setMode, draft, flash, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<'' | 'confirm' | 'reset'>('');
  const signup = mode === 'signup';
  const redirect = typeof window !== 'undefined' ? window.location.origin : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { flash('Enter a valid email.'); return; }
    if (password.length < 8) { flash('Passwords are at least 8 characters.'); return; }
    setBusy(true);
    try {
      if (signup) {
        const { data, error } = await sb().auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: draft.name.trim() }, emailRedirectTo: redirect },
        });
        if (error) throw error;
        if (!data.session) setSent('confirm');
      } else {
        const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      flash(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const { error } = await sb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
    if (error) flash(errMsg(error));
  };

  const forgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { flash('Enter your email first.'); return; }
    const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
    if (error) flash(errMsg(error));
    else setSent('reset');
  };

  if (sent) {
    return (
      <div className="screen pad fade-up" style={{ justifyContent: 'flex-end', gap: 16, paddingBottom: 28 }}>
        <span className="kicker">Check your inbox</span>
        <h1 className="display d52">{sent === 'confirm' ? 'Confirm your email.' : 'Reset link sent.'}</h1>
        <p className="lede">
          {sent === 'confirm'
            ? `We sent a link to ${email}. Open it on this device and your oath is saved.`
            : `We sent a reset link to ${email}. Open it on this device to choose a new password.`}
        </p>
        <button className="bar-btn" onClick={() => { setSent(''); setMode('signin'); }}><span>Back to sign in</span><Arrow /></button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 24px 12px', flex: 'none' }}>
        <button className="back-btn" onClick={onBack}><Back />Back</button>
        <span className="kicker">{signup ? 'Last step' : 'Welcome back'}</span>
      </div>
      <form onSubmit={submit} className="scroll fade-up" style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <span className="kicker">Your account</span>
        <h1 className="display d44">{signup ? 'Lock it in.' : 'Take your seat.'}</h1>
        <p className="body">
          {signup ? 'Create an account so your proof, streak and queue position are kept.' : 'Sign in to pick up where you left off.'}
        </p>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </label>
        <button type="submit" className={'bar-btn' + (busy ? ' dim' : '')} disabled={busy}>
          <span>{busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}</span><Arrow />
        </button>
        {GOOGLE && (
          <button type="button" className="outline-btn" onClick={google}><span>Continue with Google</span><Arrow /></button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="link-btn" onClick={() => setMode(signup ? 'signin' : 'signup')}>
            {signup ? 'I already have an account' : 'Create an account'}
          </button>
          {!signup && <button type="button" className="link-btn" onClick={forgot}>Forgot password?</button>}
        </div>
      </form>
    </div>
  );
}

export function Recovery({ flash, onDone }: { flash: (m: string, tone?: 'ok') => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { flash('Passwords are at least 8 characters.'); return; }
    setBusy(true);
    const { error } = await sb().auth.updateUser({ password });
    setBusy(false);
    if (error) { flash(errMsg(error)); return; }
    flash('Password updated.', 'ok');
    onDone();
  };
  return (
    <form onSubmit={submit} className="screen pad fade-up" style={{ justifyContent: 'flex-end', gap: 16, paddingBottom: 28 }}>
      <span className="kicker">Your account</span>
      <h1 className="display d52">New password.</h1>
      <label className="field">
        <span>Password</span>
        <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
      </label>
      <button type="submit" className={'bar-btn' + (busy ? ' dim' : '')} disabled={busy}><span>Save password</span><Arrow /></button>
    </form>
  );
}
