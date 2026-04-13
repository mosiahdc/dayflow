import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface TradeNote {
  tradeId: string;
  notes: string;
  videoUrl: string;
}

interface TradeNotesStore {
  notes: Record<string, TradeNote>;
  loading: boolean;
  fetchNotes: () => Promise<void>;
  getNote: (tradeId: string) => TradeNote;
  setNote: (tradeId: string, field: 'notes' | 'videoUrl', value: string) => Promise<void>;
}

const empty = (tradeId: string): TradeNote => ({ tradeId, notes: '', videoUrl: '' });

export const useTradeNotesStore = create<TradeNotesStore>((set, get) => ({
  notes: {},
  loading: false,

  fetchNotes: async () => {
    set({ loading: true });
    const { data } = await supabase.from('trade_notes').select('trade_id, notes, video_url');
    if (data) {
      const map: Record<string, TradeNote> = {};
      for (const row of data) {
        map[row.trade_id] = {
          tradeId: row.trade_id,
          notes: row.notes ?? '',
          videoUrl: row.video_url ?? '',
        };
      }
      set({ notes: map });
    }
    set({ loading: false });
  },

  getNote: (tradeId) => get().notes[tradeId] ?? empty(tradeId),

  setNote: async (tradeId, field, value) => {
    const existing = get().notes[tradeId] ?? empty(tradeId);
    const updated: TradeNote = { ...existing, [field]: value };

    // Optimistic update
    set((s) => ({
      notes: { ...s.notes, [tradeId]: updated },
    }));

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('trade_notes').upsert(
      {
        trade_id: tradeId,
        user_id: user.id,
        notes: updated.notes,
        video_url: updated.videoUrl,
      },
      { onConflict: 'trade_id' }
    );
  },
}));
