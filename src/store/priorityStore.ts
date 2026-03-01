import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { PriorityItem, Priority } from '@/types';

const map = (t: Record<string, unknown>): PriorityItem => ({
    id: t.id as string,
    userId: t.user_id as string,
    title: t.title as string,
    priority: t.priority as Priority,
    done: t.done as boolean,
    createdAt: t.created_at as string,
    ...(t.due_date ? { dueDate: t.due_date as string } : {}),
});

interface PriorityStore {
    items: PriorityItem[];
    fetchAll: () => Promise<void>;
    addItem: (title: string, priority: Priority, dueDate?: string) => Promise<void>;
    toggleDone: (id: string) => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
}

export const usePriorityStore = create<PriorityStore>((set, get) => ({
    items: [],

    fetchAll: async () => {
        const { data } = await supabase
            .from('priority_items')
            .select('*')
            .order('created_at', { ascending: false });
        set({ items: (data ?? []).map(map) });
    },

    addItem: async (title, priority, dueDate) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from('priority_items')
            .insert({ title, priority, user_id: user.id, done: false, ...(dueDate ? { due_date: dueDate } : {}) })
            .select().single();
        if (data) set((s) => ({ items: [map(data), ...s.items] }));
    },

    toggleDone: async (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        await supabase.from('priority_items').update({ done: !item.done }).eq('id', id);
        set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, done: !i.done } : i) }));
    },

    deleteItem: async (id) => {
        await supabase.from('priority_items').delete().eq('id', id);
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    },
}));