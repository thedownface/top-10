'use client';

import { useCallback, useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { C, CORE_TASKS, countdown, errMsg, first, initials, roman } from '@/lib/core';
import { useApp } from './ctx';
import { Bolt, Bubble, Heart } from './Icons';

type Post = {
  id: number;
  user_id: string;
  post_date: string;
  text: string;
  created_at: string;
  author_name: string;
  author_role: string;
  author_seat: number | null;
  author_training: string;
  author_streak: number;
  author_trial_days: number;
  likes: number;
  supports: number;
  comments: number;
  liked: boolean;
  supported: boolean;
  following: boolean;
  day_no: number;
};
type Comment = { id: number; text: string; user_id: string; profiles: { name: string } | null };

const PAGE = 20;

export function Agora({ isAdmin }: { isAdmin: boolean }) {
  const app = useApp();
  const { isAthlete, isQueue, logs, now, flash, refresh } = app;
  const [posts, setPosts] = useState<Post[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlyFollowing, setOnlyFollowing] = useState(false);
  const [eod, setEod] = useState('');
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async (before: string | null) => {
    setLoading(true);
    const { data, error } = await sb().rpc('feed', { p_before: before, p_limit: PAGE, p_following: onlyFollowing });
    setLoading(false);
    if (error) { flash(errMsg(error)); return; }
    const rows = data as Post[];
    setPosts((cur) => (before ? [...cur, ...rows] : rows));
    setMore(rows.length === PAGE);
  }, [flash, onlyFollowing]);

  useEffect(() => { load(null); }, [load]);

  const showComposer = (isAthlete || isQueue) && logs['6']?.status !== 'done';
  const cE = countdown(now, 23, 59, 59);
  const ok = eod.trim().length >= 20;

  const publish = async () => {
    if (!ok) { flash('Write at least one full sentence.'); return; }
    if (publishing) return;
    setPublishing(true);
    const { error } = await sb().rpc('create_post', { p_text: eod.trim() });
    setPublishing(false);
    if (error) { flash(errMsg(error)); return; }
    setEod('');
    flash('Published. Task VI locked.', 'ok');
    await Promise.all([refresh(), load(null)]);
  };

  const patch = (id: number, p: Partial<Post>) => setPosts((cur) => cur.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <div data-screen-label="07 Agora" className="scroll fade-up">
      <div style={{ padding: '4px 24px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="kicker">Agora · public · every evening</span>
        <h1 className="display d52">Learnings</h1>
      </div>

      {showComposer && (
        <div style={{ background: C.P, borderTop: C.DIV, padding: '18px 24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span className="label-strong" style={{ color: C.RT }}>Task VI · your EOD learning</span>
            <span className="tabular" style={{ fontSize: 12, fontWeight: 700 }}>{cE.s}</span>
          </div>
          <textarea
            className="input on-paper"
            value={eod}
            onChange={(e) => setEod(e.target.value.slice(0, 280))}
            rows={4}
            maxLength={280}
            placeholder="What did today teach you? One clear lesson the community can use."
            aria-label="Your learning"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.MUTE }}>{eod.length} / 280</span>
            <button
              onClick={publish}
              disabled={publishing}
              style={{ height: 44, padding: '0 18px', background: C.INK, color: C.P, border: 0, fontSize: 14, fontWeight: 700, opacity: ok && !publishing ? 1 : 0.45 }}
            >
              {publishing ? 'Publishing…' : 'Publish to the Agora'}
            </button>
          </div>
          {!logs['6'] && (
            <button className="link-btn red" style={{ minHeight: 32, padding: 0, fontSize: 14 }} onClick={() => app.openReason(CORE_TASKS[5])}>
              I can’t post today
            </button>
          )}
        </div>
      )}
      {logs['6']?.status === 'review' && (
        <p className="small" style={{ margin: 0, padding: '0 24px 16px' }}>Your reason for today’s post is with the Admin.</p>
      )}

      <div className="seg caps" style={{ gridTemplateColumns: '1fr 1fr', borderLeft: 0, borderRight: 0 }}>
        <button className={!onlyFollowing ? 'on' : ''} onClick={() => setOnlyFollowing(false)} style={{ borderRight: C.DIV }}>Everyone</button>
        <button className={onlyFollowing ? 'on' : ''} onClick={() => setOnlyFollowing(true)}>Following</button>
      </div>

      {posts.map((p) => (
        <PostCard key={p.id} post={p} patch={patch} canRemove={isAdmin || p.user_id === app.uid} onRemoved={() => setPosts((c) => c.filter((x) => x.id !== p.id))} />
      ))}

      {!loading && posts.length === 0 && (
        <p className="empty">{onlyFollowing ? 'Follow an athlete to see their learnings here.' : 'No learnings yet. The first ones land tonight.'}</p>
      )}
      {more && (
        <div style={{ padding: '8px 24px 28px', borderTop: C.DIV }}>
          <button className="outline-btn" disabled={loading} onClick={() => load(posts[posts.length - 1]?.created_at ?? null)}>
            <span>{loading ? 'Loading…' : 'Older learnings'}</span>
          </button>
        </div>
      )}
      <div style={{ height: 12 }} />
    </div>
  );
}

function PostCard({ post: p, patch, canRemove, onRemoved }: { post: Post; patch: (id: number, p: Partial<Post>) => void; canRemove: boolean; onRemoved: () => void }) {
  const { uid, flash } = useApp();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const mine = p.user_id === uid;

  const meta =
    p.author_role === 'athlete' && p.author_seat
      ? `Seat ${roman(p.author_seat)} · ${p.author_training} · ${p.author_streak}-day streak`
      : p.author_role === 'queue'
        ? `Queue · ${p.author_training} · Trial day ${roman(Math.min(p.author_trial_days + 1, 7))}`
        : p.author_training;
  const badge = p.author_role === 'athlete' && p.author_seat ? roman(p.author_seat) : p.author_role === 'queue' ? 'Q' : initials(p.author_name);

  const toggle = async (table: 'post_likes' | 'post_supports', on: boolean, field: 'liked' | 'supported', count: 'likes' | 'supports') => {
    patch(p.id, { [field]: !on, [count]: p[count] + (on ? -1 : 1) } as Partial<Post>);
    const q = on
      ? sb().from(table).delete().eq('post_id', p.id).eq('user_id', uid)
      : sb().from(table).insert({ post_id: p.id, user_id: uid });
    const { error } = await q;
    if (error) { patch(p.id, { [field]: on, [count]: p[count] } as Partial<Post>); flash(errMsg(error)); return; }
    if (table === 'post_supports' && !on) flash(`Strength sent to ${first(p.author_name)}.`, 'ok');
  };

  const follow = async () => {
    const on = p.following;
    patch(p.id, { following: !on });
    const { error } = on
      ? await sb().from('follows').delete().eq('follower', uid).eq('followee', p.user_id)
      : await sb().from('follows').insert({ follower: uid, followee: p.user_id });
    if (error) { patch(p.id, { following: on }); flash(errMsg(error)); }
  };

  const openComments = async () => {
    const next = !open;
    setOpen(next);
    if (next && comments === null) {
      const { data, error } = await sb().from('comments').select('id, text, user_id, profiles(name)').eq('post_id', p.id).order('created_at').limit(100);
      if (error) { flash(errMsg(error)); return; }
      setComments(data as unknown as Comment[]);
    }
  };

  const addComment = async () => {
    const t = draft.trim();
    if (!t) return;
    const { data, error } = await sb().from('comments').insert({ post_id: p.id, user_id: uid, text: t.slice(0, 280) }).select('id, text, user_id, profiles(name)').single();
    if (error) { flash(errMsg(error)); return; }
    setDraft('');
    setComments((c) => [...(c ?? []), data as unknown as Comment]);
    patch(p.id, { comments: p.comments + 1 });
  };

  const remove = async () => {
    if (!window.confirm('Remove this learning from the Agora?')) return;
    const { error } = await sb().from('posts').delete().eq('id', p.id);
    if (error) { flash(errMsg(error)); return; }
    onRemoved();
  };

  return (
    <article className="post">
      <div className="post-head">
        <span className="avatar">{badge}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{p.author_name || 'Member'}</span>
          <span style={{ fontSize: 12, color: C.MUTE, fontWeight: 600 }}>{meta}</span>
        </span>
        {!mine && (
          <button className={'chip-btn' + (p.following ? ' on' : '')} onClick={follow}>{p.following ? 'Following' : 'Follow'}</button>
        )}
      </div>
      <span className="label-strong" style={{ letterSpacing: '.16em', color: C.MUTE }}>Learning · Day {roman(p.day_no)}</span>
      <p className="post-text">{p.text}</p>
      <div className="actions">
        <button onClick={() => toggle('post_likes', p.liked, 'liked', 'likes')} aria-pressed={p.liked} aria-label="Like">
          <Heart filled={p.liked} />{p.likes}
        </button>
        <button className={open ? 'on' : ''} onClick={openComments} aria-expanded={open} aria-label="Comments">
          <Bubble />{p.comments}
        </button>
        <button className={p.supported ? 'on' : ''} onClick={() => toggle('post_supports', p.supported, 'supported', 'supports')} aria-pressed={p.supported} aria-label="Send strength">
          <Bolt />{p.supports}
        </button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp .25s ease both' }}>
          {comments === null && <span className="small">Loading…</span>}
          {comments?.map((c) => (
            <div key={c.id} className="row-rule" style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>{c.profiles?.name || 'Member'}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{c.text}</span>
            </div>
          ))}
          <div className="inline-form">
            <input value={draft} maxLength={280} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addComment(); }} placeholder="Add a comment" aria-label="Comment" />
            <button onClick={addComment}>Post</button>
          </div>
        </div>
      )}
      {canRemove && (
        <button className="link-btn red" style={{ minHeight: 28, padding: 0, fontSize: 13 }} onClick={remove}>Remove</button>
      )}
    </article>
  );
}
