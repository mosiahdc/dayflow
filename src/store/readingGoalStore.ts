import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface ReadingGoal { id: string; year: number; goal: number; }

interface ReadingGoalStore {
  goal: ReadingGoal | null;
  fetchGoal: (year: number) => Promise<void>;
  setGoal: (year: number, goal: number) => Promise<void>;
}

export const useReadingGoalStore = create<ReadingGoalStore>((set) => ({
  goal: null,

  fetchGoal: async (year) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('reading_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', year)
      .single();
    if (data) set({ goal: { id: data.id, year: data.year, goal: data.goal } });
  },

  setGoal: async (year, goal) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('reading_goals')
      .upsert({ user_id: user.id, year, goal }, { onConflict: 'user_id,year' })
      .select()
      .single();
    if (data) set({ goal: { id: data.id, year: data.year, goal: data.goal } });
  },
}));
