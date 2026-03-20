import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { ScheduledTask } from '@/types';

const mapTask = (t: Record<string, unknown>): ScheduledTask => ({
  id: t.id as string,
  taskId: t.task_id as string,
  userId: t.user_id as string,
  date: t.date as string,
  startSlot: t.start_slot as number,
  done: t.done as boolean,
  createdAt: t.created_at as string,
  timerStartedAt: t.timer_started_at as string | undefined,
  task: {
    id: (t.task as Record<string, unknown>).id as string,
    userId: (t.task as Record<string, unknown>).user_id as string,
    title: (t.task as Record<string, unknown>).title as string,
    color: (t.task as Record<string, unknown>).color as string,
    category: (t.task as Record<string, unknown>).category as ScheduledTask['task']['category'],
    durationMins: (t.task as Record<string, unknown>).duration_mins as number,
    notes: (t.task as Record<string, unknown>).notes as string | undefined,
    recurring: (t.task as Record<string, unknown>).recurring as ScheduledTask['task']['recurring'],
    createdAt: (t.task as Record<string, unknown>).created_at as string,
  },
});

interface PlannerStore {
  scheduledTasks: ScheduledTask[];
  loading: boolean;
  fetchByDate: (date: string) => Promise<void>;
  fetchByWeek: (start: string, end: string) => Promise<void>;
  addTask: (taskId: string, date: string, startSlot: number) => Promise<void>;
  updateSlot: (id: string, startSlot: number, date?: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
}

export const usePlannerStore = create<PlannerStore>((set, get) => ({
  scheduledTasks: [],
  loading: false,

  fetchByDate: async (date) => {
    set({ loading: true });
    const { data } = await supabase
      .from('scheduled_tasks')
      .select('*, task:tasks(*)')
      .eq('date', date)
      .order('start_slot');

    const fetched = (data ?? []).map(mapTask);

    // Merge: keep tasks from other dates, replace tasks for this date
    set((s) => ({
      loading: false,
      scheduledTasks: [...s.scheduledTasks.filter((t) => t.date !== date), ...fetched],
    }));
  },

  fetchByWeek: async (start, end) => {
    set({ loading: true });
    const { data } = await supabase
      .from('scheduled_tasks')
      .select('*, task:tasks(*)')
      .gte('date', start)
      .lte('date', end)
      .order('start_slot');

    const fetched = (data ?? []).map(mapTask);

    // Merge: keep tasks outside this date range, replace tasks within it
    set((s) => ({
      loading: false,
      scheduledTasks: [
        ...s.scheduledTasks.filter((t) => t.date < start || t.date > end),
        ...fetched,
      ],
    }));
  },

  addTask: async (taskId, date, startSlot) => {
    // Prevent duplicate on same slot
    const exists = get().scheduledTasks.find(
      (t) => t.taskId === taskId && t.date === date && t.startSlot === startSlot
    );
    if (exists) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('scheduled_tasks')
      .insert({ task_id: taskId, date, start_slot: startSlot, user_id: user.id, done: false })
      .select('*, task:tasks(*)')
      .single();
    if (data) set((s) => ({ scheduledTasks: [...s.scheduledTasks, mapTask(data)] }));
  },

  updateSlot: async (id, startSlot, date) => {
    const updates: Record<string, unknown> = { start_slot: startSlot };
    if (date) updates['date'] = date;
    await supabase.from('scheduled_tasks').update(updates).eq('id', id);
    set((s) => ({
      scheduledTasks: s.scheduledTasks.map((t) =>
        t.id === id ? { ...t, startSlot, ...(date ? { date } : {}) } : t
      ),
    }));
  },

  toggleDone: async (id) => {
    const task = get().scheduledTasks.find((t) => t.id === id);
    if (!task) return;
    await supabase.from('scheduled_tasks').update({ done: !task.done }).eq('id', id);
    set((s) => ({
      scheduledTasks: s.scheduledTasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  },

  removeTask: async (id) => {
    await supabase.from('scheduled_tasks').delete().eq('id', id);
    set((s) => ({ scheduledTasks: s.scheduledTasks.filter((t) => t.id !== id) }));
  },
}));
