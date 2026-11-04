'use client';

import { createContext, useContext } from 'react';
import type { ExtraTask, Profile, Seat, Settings, Task, TaskLog } from '@/lib/core';

export type Tab = 'today' | 'ten' | 'agora' | 'ranks';
export type RankTab = 'ten' | 'queue' | 'rules';

export type QueueRow = {
  id: string;
  name: string;
  training: string;
  trial_days: number;
  trial_done_at: string | null;
  trial_start: string | null;
};

export type AppData = {
  profile: Profile;
  settings: Settings;
  ten: Seat[];
  logs: Record<string, TaskLog>;
  extras: ExtraTask[];
  queue: QueueRow[];
};

export type AppCtx = AppData & {
  uid: string;
  now: number;
  today: string;
  dayNo: number;
  isAthlete: boolean;
  isQueue: boolean;
  isCommunity: boolean;
  queuePos: number;
  flash: (msg: string, tone?: 'ok') => void;
  refresh: () => Promise<void>;
  setTab: (t: Tab) => void;
  setRankTab: (t: RankTab) => void;
  openTask: (t: Task) => void;
  openReason: (t: Task) => void;
  startTrial: () => Promise<void>;
};

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}
