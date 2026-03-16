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
  entries: HabitEntry[]; // all entries (for streak)
  weekEntries: HabitEntry[]; // current week entries (for checkboxes)
  fetchHabits: () => Promise<void>;
  fetchEntries: (dates: string[]) => Promise<void>; // week view
  fetchAllEntries: () => Promise<void>; // for streak
  toggleEntry: (habitId: string, date: string) => Promise<void>;
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
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

  // Fetch entries for the current week (used for checkbox display)
  fetchEntries: async (dates) => {
    const { data } = await supabase.from('habit_entries').select('*').in('date', dates);
    set({ weekEntries: (data ?? []).map(mapEntry) });
  },

  // Fetch ALL entries for streak calculation
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
        // Also update in all-entries for streak accuracy
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
        user_id: user.id,
      })
      .select()
      .single();
    if (error) console.error('addHabit error:', error);
    if (data) set((s) => ({ habits: [...s.habits, mapHabit(data)] }));
  },

  deleteHabit: async (id) => {
    await supabase.from('habits').delete().eq('id', id);
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
  },
}));
