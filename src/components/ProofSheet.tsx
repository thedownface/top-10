'use client';

import { useEffect, useRef, useState } from 'react';
import { sb } from '@/lib/supabase';
import { C, CORE_TASKS, errMsg, first, REASONS, roman, type Task } from '@/lib/core';
import { checkProof, uploadProof } from '@/lib/media';
import { useApp } from './ctx';
import { Camera, Check, Close, Send } from './Icons';

type Props = {
  task: Task;
  initialMode: 'log' | 'miss';
  onClose: () => void;
  onLocked: (msg: string) => void;
};

export function ProofSheet({ task, initialMode, onClose, onLocked }: Props) {
  const { uid, today, ten, logs, refresh, flash } = useApp();
  const [mode, setMode] = useState(initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [helped, setHelped] = useState<number | null>(null);
  const [reason, setReason] = useState<number | null>(null);
  const [adminOnly, setAdminOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [water, setWater] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const waterKey = `t10-water-${today}`;
  const log = mode === 'log';

  useEffect(() => {
    try { setWater(Number(localStorage.getItem(waterKey)) || 0); } catch { /* private mode */ }
  }, [waterKey]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tapGlass = (i: number) => {
    const n = i + 1 === water ? i : i + 1;
    setWater(n);
    try { localStorage.setItem(waterKey, String(n)); } catch { /* private mode */ }
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const problem = await checkProof(f, log ? task.maxClip : 0);
    if (problem) { flash(problem); return; }
    setFile(f);
  };

  const switchMode = (m: 'log' | 'miss') => { setMode(m); setFile(null); setText(''); };

  const okLog =
    task.kind === 'water' ? water >= 8
      : task.kind === 'help' ? helped !== null && !!text.trim()
        : !!file && (!task.textLabel || !!text.trim());
  const okMiss = reason !== null && !!text.trim() && !!file;

  const submitLog = async () => {
    if (!okLog) { flash(task.kind === 'water' ? 'Eight glasses first.' : 'Add the proof first.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      const media = file ? await uploadProof(uid, today, task.key, file) : null;
      const { error } = await sb().rpc('log_task', {
        p_task: task.key,
        p_note: text.trim() || null,
        p_media: media,
        p_helped: helped,
        p_water: task.kind === 'water' ? water : null,
      });
      if (error) throw error;
      const n = CORE_TASKS.filter((t) => t.key === task.key || logs[t.key]?.status === 'done').length;
      await refresh();
      onLocked(task.extra ? 'Extra task locked.' : n === 6 ? 'All six locked. Your piece is in the Figure.' : `Piece locked. ${n} of 6 today.`);
    } catch (e) {
      flash(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const submitMiss = async () => {
    if (!okMiss) { flash('Pick a reason, explain, and add proof.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      const media = await uploadProof(uid, today, `${task.key}-reason`, file!);
      const { error } = await sb().rpc('submit_reason', {
        p_task: task.key, p_reason: reason, p_note: text.trim(), p_media: media, p_admin_only: adminOnly,
      });
      if (error) throw error;
      await refresh();
      onLocked('Sent to the Admin. Reply within 24 hours.');
    } catch (e) {
      flash(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const helpers = ten.filter((s) => s.user_id !== uid);
  const accept = log ? (task.maxClip ? 'image/*,video/*' : 'image/*') : 'image/*,application/pdf';

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div data-screen-label="09 Log proof sheet" className="sheet" role="dialog" aria-modal="true" aria-label={task.title}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="label-strong" style={{ color: C.MUTE }}>
            {task.extra ? 'From Admin · ' : `Task ${roman(Number(task.key))} · `}{log ? 'log by 10:00 pm' : 'reason by 11:59 pm'}
          </span>
          <button className="icon-btn" style={{ marginRight: -10 }} aria-label="Close" onClick={onClose}><Close /></button>
        </div>
        <h2 className="display d38" style={{ marginTop: -8 }}>{log ? task.title : 'I couldn’t complete this'}</h2>
        <input ref={input} type="file" accept={accept} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />

        {log ? (
          <>
            <p className="body" style={{ lineHeight: 1.4 }}>Proof: {task.proof}</p>
            {task.kind === 'media' && (
              <button
                onClick={() => input.current?.click()}
                style={{
                  height: 112, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between',
                  padding: '14px 16px', border: C.DIV, background: file ? C.INK : C.P, color: file ? C.P : C.INK, textAlign: 'left',
                }}
              >
                <Camera size={26} />
                <span style={{ fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {file ? `${file.name} · added. Tap to replace.` : task.maxClip ? 'Add photo or clip' : 'Add photo'}
                </span>
              </button>
            )}
            {task.kind === 'water' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6 }}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <button
                      key={i}
                      aria-label={`Glass ${i + 1}`}
                      aria-pressed={i < water}
                      onClick={() => tapGlass(i)}
                      style={{ height: 52, border: C.DIV, background: i < water ? C.INK : C.P, color: i < water ? C.P : C.INK, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'flex-end', padding: 4 }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{water} of 8 glasses · honor rule</span>
              </>
            )}
            {task.kind === 'help' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {helpers.length === 0 && <span className="small">No one else holds a seat yet.</span>}
                {helpers.map((s) => (
                  <button
                    key={s.seat}
                    onClick={() => setHelped(s.seat)}
                    aria-pressed={helped === s.seat}
                    style={{ height: 40, padding: '0 12px', border: C.DIV, background: helped === s.seat ? C.INK : C.P, color: helped === s.seat ? C.P : C.INK, fontSize: 13, fontWeight: 700 }}
                  >
                    {roman(s.seat)} · {first(s.name)}
                  </button>
                ))}
              </div>
            )}
            {task.textLabel && (
              <label className="field">
                <span>{task.textLabel}</span>
                <input className="input" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={task.ph} />
              </label>
            )}
            <button className={'bar-btn' + (okLog && !busy ? '' : ' dim')} onClick={submitLog} aria-disabled={!okLog || busy}>
              <span>{busy ? 'Locking…' : 'Lock this piece'}</span><Check size={20} />
            </button>
            <button className="link-btn red" onClick={() => switchMode('miss')}>I couldn’t complete this</button>
          </>
        ) : (
          <>
            <div className="rule-top" role="radiogroup" aria-label="Reason">
              {REASONS.map((r, i) => (
                <button
                  key={r}
                  role="radio"
                  aria-checked={reason === i}
                  onClick={() => setReason(i)}
                  style={{
                    display: 'grid', gridTemplateColumns: '22px minmax(0,1fr)', gap: 12, alignItems: 'center', minHeight: 46, width: '100%',
                    padding: '8px 0', background: 'transparent', border: 0, borderBottom: '2px solid var(--rule)', textAlign: 'left', fontSize: 15, fontWeight: 600, color: C.INK,
                  }}
                >
                  <span style={{ width: 22, height: 22, border: C.DIV, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 10, height: 10, background: reason === i ? C.INK : 'transparent' }} />
                  </span>
                  {r}
                </button>
              ))}
            </div>
            <textarea className="input" rows={3} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Short explanation" aria-label="Explanation" />
            <button
              onClick={() => input.current?.click()}
              style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', border: C.DIV, background: file ? C.INK : C.P, color: file ? C.P : C.INK, textAlign: 'left', fontSize: 15, fontWeight: 700 }}
            >
              <Camera />{file ? 'Proof attached · tap to replace' : 'Add proof · photo, doctor note, ticket, screenshot'}
            </button>
            <button
              role="switch"
              aria-checked={adminOnly}
              onClick={() => setAdminOnly(!adminOnly)}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px', gap: 12, alignItems: 'center', padding: '4px 0', background: 'transparent', border: 0, textAlign: 'left', color: C.INK }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Admin only</span>
                <span style={{ fontSize: 13, color: C.MUTE }}>Proof is never shown to the group. Turn off to tell the Ten why.</span>
              </span>
              <span style={{ width: 52, height: 28, border: C.DIV, background: adminOnly ? C.INK : 'transparent', display: 'flex', justifyContent: adminOnly ? 'flex-end' : 'flex-start', padding: 2 }}>
                <span style={{ width: 20, height: 20, background: adminOnly ? C.RED : C.INK }} />
              </span>
            </button>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: C.BODY }}>Admin reviews within 24 hours. Accepted: day excused, streak paused. Rejected: 1 strike.</p>
            <button className={'bar-btn' + (okMiss && !busy ? '' : ' dim')} onClick={submitMiss} aria-disabled={!okMiss || busy}>
              <span>{busy ? 'Sending…' : 'Send for review'}</span><Send />
            </button>
            {initialMode === 'log' && <button className="link-btn" onClick={() => switchMode('log')}>Back to logging</button>}
          </>
        )}
      </div>
    </>
  );
}
