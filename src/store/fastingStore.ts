import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface FastingSession {
  id: string;
  userId: string;
  startedAt: string; // ISO string
  endedAt: string | null;
  goalHours: number;
  createdAt: string;
}

const mapSession = (t: Record<string, unknown>): FastingSession => ({
  id: t.id as string,
  userId: t.user_id as string,
  startedAt: t.started_at as string,
  endedAt: t.ended_at as string | null,
  goalHours: t.goal_hours as number,
  createdAt: t.created_at as string,
});

interface FastingStore {
  sessions: FastingSession[];
  active: FastingSession | null; // current in-progress session
  loading: boolean;
  fetchSessions: () => Promise<void>;
  startFast: (startedAt: Date, goalHours: number) => Promise<void>;
  updateStartTime: (id: string, startedAt: Date) => Promise<void>;
  stopFast: (id: string, endedAt: Date) => Promise<void>;
  deletSession: (id: string) => Promise<void>;
}

export const useFastingStore = create<FastingStore>((set, get) => ({
  sessions: [],
  active: null,
  loading: false,

  fetchSessions: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('fasting_sessions')
      .select('*')
      .order('started_at', { ascending: false });

    const all = (data ?? []).map(mapSession);
    const active = all.find((s) => !s.endedAt) ?? null;
    set({ sessions: all, active, loading: false });
  },

  startFast: async (startedAt, goalHours) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // End any existing active session first
    const existing = get().active;
    if (existing) {
      await supabase
        .from('fasting_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', existing.id);
    }

    const { data } = await supabase
      .from('fasting_sessions')
      .insert({
        user_id: user.id,
        started_at: startedAt.toISOString(),
        ended_at: null,
        goal_hours: goalHours,
      })
      .select()
      .single();

    if (data) {
      const session = mapSession(data);
      set((s) => ({
        sessions: [session, ...s.sessions.filter((x) => x.endedAt !== null)],
        active: session,
      }));
    }
  },

  updateStartTime: async (id, startedAt) => {
    await supabase
      .from('fasting_sessions')
      .update({ started_at: startedAt.toISOString() })
      .eq('id', id);
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === id ? { ...x, startedAt: startedAt.toISOString() } : x
      ),
      active: s.active?.id === id ? { ...s.active, startedAt: startedAt.toISOString() } : s.active,
    }));
  },

  stopFast: async (id, endedAt) => {
    await supabase
      .from('fasting_sessions')
      .update({ ended_at: endedAt.toISOString() })
      .eq('id', id);
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, endedAt: endedAt.toISOString() } : x)),
      active: null,
    }));
  },

  deletSession: async (id) => {
    await supabase.from('fasting_sessions').delete().eq('id', id);
    set((s) => ({
      sessions: s.sessions.filter((x) => x.id !== id),
      active: s.active?.id === id ? null : s.active,
    }));
  },
}));
