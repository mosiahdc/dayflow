import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { usePlannerStore } from './plannerStore';
import type { DayTemplate } from '@/types';

const map = (t: Record<string, unknown>): DayTemplate => ({
  id:             t.id as string,
  userId:         t.user_id as string,
  name:           t.name as string,
  scheduledTasks: (t.scheduled_tasks ?? []) as DayTemplate['scheduledTasks'],
  createdAt:      t.created_at as string,
});

interface TemplateStore {
  templates:      DayTemplate[];
  fetchAll:       () => Promise<void>;
  saveTemplate:   (name: string, date: string) => Promise<void>;
  applyTemplate:  (templateId: string, date: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],

  fetchAll: async () => {
    const { data } = await supabase
      .from('day_templates')
      .select('*')
      .order('created_at', { ascending: false });
    set({ templates: (data ?? []).map(map) });
  },

  saveTemplate: async (name, date) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Grab current day's scheduled tasks
    const tasks = usePlannerStore.getState().scheduledTasks
      .filter((t) => t.date === date)
      .map((t) => ({ taskId: t.taskId, startSlot: t.startSlot, task: t.task }));

    if (!tasks.length) return;

    const { data } = await supabase
      .from('day_templates')
      .insert({ name, scheduled_tasks: tasks, user_id: user.id })
      .select()
      .single();

    if (data) set((s) => ({ templates: [map(data), ...s.templates] }));
  },

  applyTemplate: async (templateId, date) => {
    const template = get().templates.find((t) => t.id === templateId);
    if (!template) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const st of template.scheduledTasks) {
      await usePlannerStore.getState().addTask(
        (st as unknown as Record<string, string>)['taskId'] ?? '',
        date,
        (st as unknown as Record<string, number>)['startSlot'] ?? 0,
      );
    }
  },

  deleteTemplate: async (id) => {
    await supabase.from('day_templates').delete().eq('id', id);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },
}));