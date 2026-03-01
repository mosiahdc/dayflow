import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Reflection } from '@/types';

const map = (t: Record<string, unknown>): Reflection => ({
  id:           t.id as string,
  userId:       t.user_id as string,
  date:         t.date as string,
  accomplished: t.accomplished as string,
  carryOver:    t.carry_over as string,
  createdAt:    t.created_at as string,
});

interface ReflectionStore {
  reflections: Reflection[];
  fetchByDate: (date: string) => Promise<Reflection | null>;
  upsert:      (date: string, accomplished: string, carryOver: string) => Promise<void>;
}

export const useReflectionStore = create<ReflectionStore>((set, get) => ({
  reflections: [],

  fetchByDate: async (date) => {
    const { data } = await supabase
      .from('reflections')
      .select('*')
      .eq('date', date)
      .single();
    if (data) {
      const mapped = map(data);
      set((s) => ({
        reflections: [
          ...s.reflections.filter((r) => r.date !== date),
          mapped,
        ],
      }));
      return mapped;
    }
    return null;
  },

  upsert: async (date, accomplished, carryOver) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existing = get().reflections.find((r) => r.date === date);
    if (existing) {
      await supabase
        .from('reflections')
        .update({ accomplished, carry_over: carryOver })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('reflections')
        .insert({ date, accomplished, carry_over: carryOver, user_id: user.id });
    }
    set((s) => ({
      reflections: [
        ...s.reflections.filter((r) => r.date !== date),
        { id: existing?.id ?? '', userId: user.id, date, accomplished, carryOver, createdAt: '' },
      ],
    }));
  },
}));