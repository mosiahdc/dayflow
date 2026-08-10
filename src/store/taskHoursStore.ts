import { create } from 'zustand';
import { format, subWeeks } from 'date-fns';
import { supabase } from '@/lib/supabase';

// ── Types ───────────────────────────────────────────────────────────────────
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type WeeklyHours = Record<DayKey, number>;

export const WEEK_DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEK_DAY_LABELS: Record<DayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const EMPTY_WEEKLY_HOURS: WeeklyHours = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

export interface TaskHourTarget {
  id: string;
  userId: string;
  taskId: string;
  weekStart: string; // 'yyyy-MM-dd' — Monday of the target week
  targets: WeeklyHours;
  createdAt: string;
}

const mapRow = (t: Record<string, unknown>): TaskHourTarget => ({
  id: t.id as string,
  userId: t.user_id as string,
  taskId: t.task_id as string,
  weekStart: t.week_start as string,
  targets: { ...EMPTY_WEEKLY_HOURS, ...((t.targets as Partial<WeeklyHours>) ?? {}) },
  createdAt: t.created_at as string,
});

export function sumWeeklyHours(targets: WeeklyHours): number {
  return WEEK_DAY_ORDER.reduce((acc, d) => acc + (targets[d] || 0), 0);
}

// ── Store ───────────────────────────────────────────────────────────────────
interface TaskHoursStore {
  targets: TaskHourTarget[]; // targets for whichever week(s) have been fetched
  loading: boolean;
  fetchForWeek: (weekStart: string) => Promise<void>;
  upsertTargets: (taskId: string, weekStart: string, targets: WeeklyHours) => Promise<void>;
  copyPreviousWeek: (taskId: string, weekStart: string) => Promise<WeeklyHours | null>;
  removeTargets: (taskId: string, weekStart: string) => Promise<void>;
}

export const useTaskHoursStore = create<TaskHoursStore>((set, get) => ({
  targets: [],
  loading: false,

  fetchForWeek: async (weekStart) => {
    set({ loading: true });
    const { data } = await supabase
      .from('task_hour_targets')
      .select('*')
      .eq('week_start', weekStart);

    const fetched = (data ?? []).map(mapRow);

    // Merge: keep targets from other weeks, replace this week's
    set((s) => ({
      loading: false,
      targets: [...s.targets.filter((t) => t.weekStart !== weekStart), ...fetched],
    }));
  },

  upsertTargets: async (taskId, weekStart, targets) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const existing = get().targets.find((t) => t.taskId === taskId && t.weekStart === weekStart);

    if (existing) {
      await supabase.from('task_hour_targets').update({ targets }).eq('id', existing.id);
      set((s) => ({
        targets: s.targets.map((t) => (t.id === existing.id ? { ...t, targets } : t)),
      }));
    } else {
      const { data } = await supabase
        .from('task_hour_targets')
        .insert({ task_id: taskId, week_start: weekStart, targets, user_id: user.id })
        .select()
        .single();
      if (data) set((s) => ({ targets: [...s.targets, mapRow(data)] }));
    }
  },

  // Returns the previous week's targets for this task (from local cache if
  // already fetched, otherwise a fresh lookup). Does NOT save anything —
  // the caller decides whether to apply it via upsertTargets.
  copyPreviousWeek: async (taskId, weekStart) => {
    const prevWeekStart = format(subWeeks(new Date(weekStart), 1), 'yyyy-MM-dd');
    const local = get().targets.find((t) => t.taskId === taskId && t.weekStart === prevWeekStart);
    if (local) return local.targets;

    const { data } = await supabase
      .from('task_hour_targets')
      .select('*')
      .eq('task_id', taskId)
      .eq('week_start', prevWeekStart)
      .maybeSingle();

    return data ? mapRow(data).targets : null;
  },

  removeTargets: async (taskId, weekStart) => {
    const existing = get().targets.find((t) => t.taskId === taskId && t.weekStart === weekStart);
    if (!existing) return;
    await supabase.from('task_hour_targets').delete().eq('id', existing.id);
    set((s) => ({ targets: s.targets.filter((t) => t.id !== existing.id) }));
  },
}));
