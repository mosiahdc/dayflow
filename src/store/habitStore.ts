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
    entries: HabitEntry[];
    fetchHabits: () => Promise<void>;
    fetchEntries: (dates: string[]) => Promise<void>;
    toggleEntry: (habitId: string, date: string) => Promise<void>;
    addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
    deleteHabit: (id: string) => Promise<void>;
}

export const useHabitStore = create<HabitStore>((set, get) => ({
    habits: [],
    entries: [],

    fetchHabits: async () => {
        const { data } = await supabase
            .from('habits')
            .select('*')
            .order('created_at');
        set({ habits: (data ?? []).map(mapHabit) });
    },

    fetchEntries: async (dates) => {
        const { data } = await supabase
            .from('habit_entries')
            .select('*')
            .in('date', dates);
        set({ entries: (data ?? []).map(mapEntry) });
    },

    toggleEntry: async (habitId, date) => {
        const existing = get().entries.find(
            (e) => e.habitId === habitId && e.date === date
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (existing) {
            await supabase
                .from('habit_entries')
                .update({ completed: !existing.completed })
                .eq('id', existing.id);
            set((s) => ({
                entries: s.entries.map((e) =>
                    e.id === existing.id ? { ...e, completed: !e.completed } : e
                ),
            }));
        } else {
            const { data } = await supabase
                .from('habit_entries')
                .insert({ habit_id: habitId, date, user_id: user.id, completed: true })
                .select().single();
            if (data) set((s) => ({ entries: [...s.entries, mapEntry(data)] }));
        }
    },

    addHabit: async (habit) => {
        const { data: { user } } = await supabase.auth.getUser();
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
            .select().single();
        if (error) console.error('addHabit error:', error);
        if (data) set((s) => ({ habits: [...s.habits, mapHabit(data)] }));
    },

    deleteHabit: async (id) => {
        await supabase.from('habits').delete().eq('id', id);
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
    },
}));