import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface PlantStage {
  name: string;
  days: number;
}

export interface Plant {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  plantedAt: string; // 'yyyy-MM-dd'
  stages: PlantStage[];
  notes?: string;
  archived: boolean;
  createdAt: string;
}

const mapPlant = (t: Record<string, unknown>): Plant => ({
  id: t.id as string,
  userId: t.user_id as string,
  name: t.name as string,
  emoji: (t.emoji as string) ?? '🌱',
  plantedAt: t.planted_at as string,
  stages: (t.stages as PlantStage[]) ?? [],
  ...(t.notes ? { notes: t.notes as string } : {}),
  archived: (t.archived as boolean) ?? false,
  createdAt: t.created_at as string,
});

interface PlantStore {
  plants: Plant[];
  loading: boolean;
  fetchPlants: () => Promise<void>;
  addPlant: (plant: Omit<Plant, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  updatePlant: (id: string, updates: Partial<Plant>) => Promise<void>;
  deletePlant: (id: string) => Promise<void>;
  archivePlant: (id: string) => Promise<void>;
}

export const usePlantStore = create<PlantStore>((set, get) => ({
  plants: [],
  loading: false,

  fetchPlants: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('plants')
      .select('*')
      .order('planted_at', { ascending: false });
    set({ plants: (data ?? []).map(mapPlant), loading: false });
  },

  addPlant: async (plant) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('plants')
      .insert({
        name: plant.name,
        emoji: plant.emoji,
        planted_at: plant.plantedAt,
        stages: plant.stages,
        notes: plant.notes ?? null,
        archived: false,
        user_id: user.id,
      })
      .select()
      .single();
    if (data) set((s) => ({ plants: [mapPlant(data), ...s.plants] }));
  },

  updatePlant: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.plantedAt !== undefined) dbUpdates.planted_at = updates.plantedAt;
    if (updates.stages !== undefined) dbUpdates.stages = updates.stages;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.archived !== undefined) dbUpdates.archived = updates.archived;
    await supabase.from('plants').update(dbUpdates).eq('id', id);
    set((s) => ({
      plants: s.plants.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  },

  deletePlant: async (id) => {
    await supabase.from('plants').delete().eq('id', id);
    set((s) => ({ plants: s.plants.filter((p) => p.id !== id) }));
  },

  archivePlant: async (id) => {
    await supabase.from('plants').update({ archived: true }).eq('id', id);
    set((s) => ({
      plants: s.plants.map((p) => (p.id === id ? { ...p, archived: true } : p)),
    }));
  },
}));
