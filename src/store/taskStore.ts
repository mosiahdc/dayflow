import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/types';

interface TaskStore {
    tasks: Task[];
    loading: boolean;
    fetchAll: () => Promise<void>;
    addTask: (task: Omit<Task, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set) => ({
    tasks: [],
    loading: false,

    fetchAll: async () => {
        set({ loading: true });
        const { data } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });

        const tasks = (data ?? []).map((t) => ({
            ...t,
            userId: t.user_id,
            durationMins: t.duration_mins,
            createdAt: t.created_at,
        })) as Task[];

        set({ tasks, loading: false });
    },

    addTask: async (task) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from('tasks')
            .insert({
                title: task.title,
                color: task.color,
                category: task.category,
                duration_mins: task.durationMins,
                notes: task.notes,
                recurring: task.recurring,
                user_id: user.id,
            })
            .select()
            .single();

        if (data) {
            const mapped: Task = {
                ...data,
                userId: data.user_id,
                durationMins: data.duration_mins,
                createdAt: data.created_at,
            };
            // Insert at beginning so tasks[0] is the newest
            set((s) => ({ tasks: [mapped, ...s.tasks] }));
        }
    },

    updateTask: async (id, updates) => {
        await supabase.from('tasks').update(updates).eq('id', id);
        set((s) => ({
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
    },

    deleteTask: async (id) => {
        await supabase.from('tasks').delete().eq('id', id);
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    },
}));