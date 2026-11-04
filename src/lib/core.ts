export const C = {
  G: '#E8D5B2',
  P: '#F4EAD6',
  INK: '#1E1B18',
  INK2: '#3A342E',
  MUTE: '#5A5046',
  BODY: '#3E372F',
  RED: '#EC3013',
  RT: '#B3220C',
  RULE: 'rgba(30,27,24,.35)',
  DIV: '2px solid #1E1B18',
} as const;

export function roman(n: number): string {
  const m: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let s = '';
  for (const [v, r] of m) while (n >= v) { s += r; n -= v; }
  return s || '0';
}

export const first = (name: string) => (name.trim().split(/\s+/)[0] || 'Athlete');
export const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '··';

// ── IST time ──────────────────────────────────────────────────────────
export function ist(ms: number): Date {
  const d = new Date(ms);
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 330 * 60000);
}
const p2 = (n: number) => String(n).padStart(2, '0');
export function istDate(ms: number): string {
  const t = ist(ms);
  return `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`;
}
export function istClock(ms: number): string {
  const t = ist(ms), h = t.getHours();
  return `${((h + 11) % 12) + 1}:${p2(t.getMinutes())} ${h < 12 ? 'am' : 'pm'}`;
}
/** Seconds left until hh:mm:ss IST today. */
export function secondsUntil(ms: number, h: number, m: number, s = 0): number {
  const t = ist(ms);
  return h * 3600 + m * 60 + s - (t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds());
}
export function countdown(ms: number, h: number, m: number, s = 0) {
  const left = secondsUntil(ms, h, m, s);
  if (left <= 0) return { s: 'Closed', urgent: true, closed: true };
  return {
    s: `${p2(Math.floor(left / 3600))}:${p2(Math.floor(left / 60) % 60)}:${p2(left % 60)}`,
    urgent: left < 3600,
    closed: false,
  };
}
export const tasksLocked = (ms: number) => secondsUntil(ms, 22, 0) <= 0;

export function dayNumber(today: string, seasonStart: string): number {
  const a = Date.parse(today + 'T00:00:00Z'), b = Date.parse(seasonStart + 'T00:00:00Z');
  return Math.max(1, Math.round((a - b) / 86400000) + 1);
}
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

// ── tasks ─────────────────────────────────────────────────────────────
export type TaskKind = 'media' | 'water' | 'help' | 'eod';
export type Task = {
  key: string;
  num: string;
  title: string;
  proof: string;
  kind: TaskKind;
  textLabel?: string;
  ph?: string;
  extra?: boolean;
  maxClip: number;
};

export const CORE_TASKS: Task[] = [
  { key: '1', num: 'I', title: 'Training session', proof: 'Photo or clip up to 15 s, with what was done', kind: 'media', textLabel: 'What was done', ph: 'e.g. 5×5 squats at 80 kg, 20 min zone 2', maxClip: 15 },
  { key: '2', num: 'II', title: 'Eat healthy', proof: 'Photo of one meal', kind: 'media', maxClip: 15 },
  { key: '3', num: 'III', title: 'Drink 8 glasses of water', proof: 'Tick (honor rule)', kind: 'water', maxClip: 0 },
  { key: '4', num: 'IV', title: 'Read 5 pages', proof: 'Page photo + one-line takeaway', kind: 'media', textLabel: 'One-line takeaway', ph: 'The one line you will remember', maxClip: 15 },
  { key: '5', num: 'V', title: 'Help one Top 10 member', proof: 'Name who you helped and how (message, tip, feedback)', kind: 'help', textLabel: 'How you helped', ph: 'e.g. Sent Tara a cue for squat depth', maxClip: 0 },
  { key: '6', num: 'VI', title: 'EOD learning post', proof: 'The Community post itself', kind: 'eod', maxClip: 0 },
];

export const REASONS = ['Illness / injury', 'Family emergency', 'Travel', 'Work / exam emergency', 'Other'];
export const TRAININGS = ['Gym', 'Calisthenics', 'Running', 'Sport'];

export function taskTitle(key: string, extras: ExtraTask[]): string {
  return CORE_TASKS.find((t) => t.key === key)?.title ?? extras.find((e) => 'x' + e.id === key)?.title ?? 'Extra task';
}

// ── rows ──────────────────────────────────────────────────────────────
export type Role = 'community' | 'queue' | 'athlete';
export type Profile = {
  id: string;
  name: string;
  training: string;
  goal: string;
  role: Role;
  seat: number | null;
  is_admin: boolean;
  onboarded: boolean;
  streak: number;
  strikes: number;
  trial_start: string | null;
  trial_days: number;
  trial_done_at: string | null;
  created_at: string;
};
export type Settings = { season_name: string; season_start: string };
export type Seat = {
  seat: number;
  user_id: string;
  name: string;
  training: string;
  streak: number;
  strikes: number;
  done_today: boolean;
};
export type TaskLog = {
  id: number;
  task_key: string;
  status: 'done' | 'review' | 'excused' | 'rejected';
};
export type ExtraTask = { id: number; for_date: string; title: string; proof: string };

export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Try again.';
}
