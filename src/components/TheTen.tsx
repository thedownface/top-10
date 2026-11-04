'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { sb } from '@/lib/supabase';
import { C, errMsg, first, initials, roman } from '@/lib/core';
import { useApp } from './ctx';
import { Arrow, Lock, Send } from './Icons';

type Msg = { id: number; user_id: string | null; sys: boolean; text: string; created_at: string };
type Who = { name: string; seat: number | null; is_admin: boolean };

export function TheTen({ isAdmin }: { isAdmin: boolean }) {
  const app = useApp();
  if (!app.isAthlete && !isAdmin) {
    return (
      <div data-screen-label="06 Chat locked" className="screen pad fade-up" style={{ justifyContent: 'flex-end', gap: 16, paddingTop: 24, paddingBottom: 28 }}>
        <Lock />
        <span className="kicker">Private room</span>
        <h1 className="display d52">A room for ten.</h1>
        <p className="lede">Only the Top 10 and the Admin can see this chat. Seats open from the queue, in order.</p>
        <button className="bar-btn" onClick={() => { app.setRankTab('queue'); app.setTab('ranks'); }}>
          <span>See the queue</span><Arrow />
        </button>
      </div>
    );
  }
  return <Chat />;
}

function Chat() {
  const { uid, ten, profile, flash } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [people, setPeople] = useState<Record<string, Who>>({});
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const known = useRef(new Set<string>());

  // Names for anyone not in the current ten (the Admin, or a former member).
  const learn = useCallback(async (ids: (string | null)[]) => {
    const missing = [...new Set(ids.filter((x): x is string => !!x && !known.current.has(x)))];
    if (!missing.length) return;
    missing.forEach((id) => known.current.add(id));
    const { data } = await sb().from('profiles').select('id, name, seat, is_admin').in('id', missing);
    if (data) setPeople((p) => ({ ...p, ...Object.fromEntries(data.map((r) => [r.id, r as Who])) }));
  }, []);

  useEffect(() => {
    const seed: Record<string, Who> = {};
    for (const s of ten) { seed[s.user_id] = { name: s.name, seat: s.seat, is_admin: false }; known.current.add(s.user_id); }
    seed[profile.id] = { name: profile.name, seat: profile.seat, is_admin: profile.is_admin };
    known.current.add(profile.id);
    setPeople((p) => ({ ...p, ...seed }));
  }, [ten, profile]);

  useEffect(() => {
    let alive = true;
    const client = sb();
    client.from('messages').select('id, user_id, sys, text, created_at').order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { flash(errMsg(error)); return; }
        const rows = (data as Msg[]).reverse();
        setMsgs(rows);
        learn(rows.map((m) => m.user_id));
      });
    const channel = client
      .channel('the-ten')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Msg;
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m].slice(-200)));
        learn([m.user_id]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const id = (payload.old as { id: number }).id;
        setMsgs((cur) => cur.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => { alive = false; client.removeChannel(channel); };
  }, [flash, learn]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const { data, error } = await sb().from('messages').insert({ user_id: uid, text: text.slice(0, 500) }).select('id, user_id, sys, text, created_at').single();
    setSending(false);
    if (error) { flash(errMsg(error)); return; }
    setDraft('');
    setMsgs((cur) => (cur.some((x) => x.id === data.id) ? cur : [...cur, data as Msg]));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(); };

  const label = (id: string | null) => {
    const w = id ? people[id] : undefined;
    if (!w) return '…';
    if (w.seat) return `${roman(w.seat)} · ${first(w.name)}`;
    return w.is_admin ? `Admin · ${first(w.name)}` : first(w.name);
  };

  const seats = Array.from({ length: 10 }, (_, i) => ten.find((s) => s.seat === i + 1));

  return (
    <div data-screen-label="06 The Ten chat" className="screen fade-up">
      <div style={{ padding: '4px 24px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 'none' }}>
        <span className="kicker">Private · Ten + Admin</span>
        <h1 className="display d44">The Ten</h1>
      </div>
      <div className="members" aria-label="Seats">
        {seats.map((s, i) => {
          const me = s?.user_id === uid;
          const bg = me ? C.RED : s?.done_today ? C.INK : s ? C.P : 'transparent';
          const fg = me ? C.INK : s?.done_today ? C.P : C.INK;
          return (
            <div key={i} className="member" style={{ background: bg, color: fg }} title={s ? `${s.name}${s.done_today ? ' · day locked' : ''}` : 'Open seat'}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em' }}>{roman(i + 1)}</span>
              <span className="num" style={{ fontSize: 20, opacity: s ? 1 : 0.4 }}>{s ? initials(s.name) : '—'}</span>
            </div>
          );
        })}
      </div>
      <div ref={listRef} className="scroll" style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }} aria-live="polite">
        {msgs.length === 0 && <p className="small" style={{ margin: 0 }}>No messages yet. Push someone forward.</p>}
        {msgs.map((m) =>
          m.sys ? (
            <div key={m.id} className="sysmsg">{m.text}</div>
          ) : m.user_id === uid ? (
            <div key={m.id} className="bubble-mine"><span className="who">{label(m.user_id)}</span><div className="txt">{m.text}</div></div>
          ) : (
            <div key={m.id} className="bubble-other"><span className="who">{label(m.user_id)}</span><div className="txt">{m.text}</div></div>
          ),
        )}
      </div>
      <div className="composer">
        <input value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder="Push someone forward…" aria-label="Message" />
        <button onClick={send} aria-label="Send" disabled={sending}><Send /></button>
      </div>
    </div>
  );
}
