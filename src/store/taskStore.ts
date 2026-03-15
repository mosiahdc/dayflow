import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Task, Category } from '@/types';

// Map raw Supabase row → Task (snake_case → camelCase)
const mapTask = (t: Record<string, unknown>): Task => ({
  id: t.id as string,
  userId: t.user_id as string,
  title: t.title as string,
  color: t.color as string,
  category: t.category as Category,
  durationMins: t.duration_mins as number,
  notes: t.notes as string | undefined,
  recurring: t.recurring as Task['recurring'],
  createdAt: t.created_at as string,
});

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
    set({ tasks: (data ?? []).map(mapTask), loading: false });
  },

  addTask: async (task) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('tasks')
      .insert({
        title: task.title,
        color: task.color,
        category: task.category, // ✅ saved correctly
        duration_mins: task.durationMins, // ✅ snake_case for DB
        notes: task.notes ?? null,
        recurring: task.recurring,
        user_id: user.id,
      })
      .select()
      .single();
    if (data) set((s) => ({ tasks: [mapTask(data), ...s.tasks] })); // ✅ mapped back
  },

  updateTask: async (id, updates) => {
    // Build a proper snake_case update object for Supabase
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.category !== undefined) dbUpdates.category = updates.category; // ✅ saved
    if (updates.durationMins !== undefined) dbUpdates.duration_mins = updates.durationMins; // ✅ snake_case
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.recurring !== undefined) dbUpdates.recurring = updates.recurring;

    await supabase.from('tasks').update(dbUpdates).eq('id', id);

    // Update local store with camelCase
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  deleteTask: async (id) => {
    await supabase.from('tasks').delete().eq('id', id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },
}));
