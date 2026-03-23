import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Habit, HabitEntry, Category } from '@/types';

const mapHabit = (t: Record<string, unknown>): Habit => ({
  id: t.id as string,
  userId: t.user_id as string,
  title: t.title as string,
  category: t.category as Category,
  color: t.color as string,
  targetDays: t.target_days as Habit['targetDays'],
  reminderTime: (t.reminder_time as string | null) ?? undefined,
  createdAt: t.created_at as string,
});

const mapEntry = (t: Record<string, unknown>): HabitEntry => ({
  id: t.id as string,
  habitId: t.habit_id as string,
  userId: t.user_id as string,
  date: t.date as string,
  completed: t.completed as boolean,
  ...(t.completed_at ? { completedAt: t.completed_at as string } : {}),
});

interface HabitStore {
  habits: Habit[];
  entries: HabitEntry[];
  weekEntries: HabitEntry[];
  fetchHabits: () => Promise<void>;
  fetchEntries: (dates: string[]) => Promise<void>;
  fetchAllEntries: () => Promise<void>;
  toggleEntry: (habitId: string, date: string) => Promise<void>;
  markHabitDoneByTitle: (title: string, date: string) => Promise<void>;
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
  updateHabit: (
    id: string,
    updates: Partial<Pick<Habit, 'reminderTime' | 'title' | 'category' | 'color' | 'targetDays'>>
  ) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  entries: [],
  weekEntries: [],

  fetchHabits: async () => {
    const { data } = await supabase.from('habits').select('*').order('created_at');
    set({ habits: (data ?? []).map(mapHabit) });
  },

  fetchEntries: async (dates) => {
    const { data } = await supabase.from('habit_entries').select('*').in('date', dates);
    set({ weekEntries: (data ?? []).map(mapEntry) });
  },

  fetchAllEntries: async () => {
    const { data } = await supabase
      .from('habit_entries')
      .select('*')
      .eq('completed', true)
      .order('date', { ascending: false });
    set({ entries: (data ?? []).map(mapEntry) });
  },

  toggleEntry: async (habitId, date) => {
    const existing = get().weekEntries.find((e) => e.habitId === habitId && e.date === date);
    if (existing) {
      await supabase
        .from('habit_entries')
        .update({ completed: !existing.completed })
        .eq('id', existing.id);
      const updated = { ...existing, completed: !existing.completed };
      set((s) => ({
        weekEntries: s.weekEntries.map((e) => (e.id === existing.id ? updated : e)),
        entries: existing.completed
          ? s.entries.filter((e) => e.id !== existing.id)
          : [...s.entries, updated],
      }));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('habit_entries')
        .insert({ habit_id: habitId, date, user_id: user.id, completed: true })
        .select()
        .single();
      if (data) {
        const mapped = mapEntry(data);
        set((s) => ({
          weekEntries: [...s.weekEntries, mapped],
          entries: [...s.entries, mapped],
        }));
      }
    }
  },

  markHabitDoneByTitle: async (title: string, date: string) => {
    const { habits, weekEntries } = get();
    // Find habit by title (case-insensitive)
    const habit = habits.find(h => h.title.toLowerCase() === title.toLowerCase());
    if (!habit) return;
    // Check if already completed today
    const existing = weekEntries.find(e => e.habitId === habit.id && e.date === date);
    if (existing?.completed) return; // already done, skip
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (existing) {
      // Entry exists but not completed — update it
      await supabase.from('habit_entries').update({ completed: true }).eq('id', existing.id);
      const updated = { ...existing, completed: true };
      set((s) => ({
        weekEntries: s.weekEntries.map(e => e.id === existing.id ? updated : e),
        entries: [...s.entries, updated],
      }));
    } else {
      // No entry yet — insert one
      const { data } = await supabase
        .from('habit_entries')
        .insert({ habit_id: habit.id, date, user_id: user.id, completed: true })
        .select()
        .single();
      if (data) {
        const mapped = mapEntry(data);
        set((s) => ({
          weekEntries: [...s.weekEntries, mapped],
          entries: [...s.entries, mapped],
        }));
      }
    }
  },

  addHabit: async (habit) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('habits')
      .insert({
        title: habit.title,
        category: habit.category,
        color: habit.color,
        target_days: habit.targetDays,
        reminder_time: habit.reminderTime ?? null,
        user_id: user.id,
      })
      .select()
      .single();
    if (error) console.error('addHabit error:', error);
    if (data) set((s) => ({ habits: [...s.habits, mapHabit(data)] }));
  },

  updateHabit: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.targetDays !== undefined) dbUpdates.target_days = updates.targetDays;
    if ('reminderTime' in updates) dbUpdates.reminder_time = updates.reminderTime ?? null;

    await supabase.from('habits').update(dbUpdates).eq('id', id);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    }));
  },

  deleteHabit: async (id) => {
    await supabase.from('habits').delete().eq('id', id);
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
  },
}));
