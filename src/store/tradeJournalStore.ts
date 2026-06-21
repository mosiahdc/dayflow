import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type MentalState =
  | 'Calm'
  | 'Bored'
  | 'Rushed'
  | 'Confident'
  | 'Hyped'
  | 'Neutral'
  | 'Ecstatic'
  | 'Impatient';
export type SessionGrade = 'A' | 'F' | null;

export interface JournalEntry {
  id: string;
  userId: string;
  date: string; // 'yyyy-MM-dd' in UTC+8
  tradeNumber: 1 | 2 | 3;
  emaSetup: boolean | null;
  roePercent: number | null;
  pnlAmount: number | null;
  mentalState: MentalState | null;
  rulesMaintained: boolean | null;
  createdAt: string;
}

export interface SessionAssessment {
  id: string;
  userId: string;
  date: string; // 'yyyy-MM-dd' in UTC+8
  lossOccurred: boolean;
  circuitBreakerExecuted: boolean | null;
  chasingOccurred: boolean;
  grade: SessionGrade;
  notes: string;
  createdAt: string;
}

const mapEntry = (r: Record<string, unknown>): JournalEntry => ({
  id: r.id as string,
  userId: r.user_id as string,
  date: r.date as string,
  tradeNumber: r.trade_number as 1 | 2 | 3,
  emaSetup: r.ema_setup as boolean | null,
  roePercent: r.roe_percent as number | null,
  pnlAmount: r.pnl_amount as number | null,
  mentalState: r.mental_state as MentalState | null,
  rulesMaintained: r.rules_maintained as boolean | null,
  createdAt: r.created_at as string,
});

const mapAssessment = (r: Record<string, unknown>): SessionAssessment => ({
  id: r.id as string,
  userId: r.user_id as string,
  date: r.date as string,
  lossOccurred: r.loss_occurred as boolean,
  circuitBreakerExecuted: r.circuit_breaker_executed as boolean | null,
  chasingOccurred: r.chasing_occurred as boolean,
  grade: r.grade as SessionGrade,
  notes: (r.notes as string) ?? '',
  createdAt: r.created_at as string,
});

interface TradeJournalStore {
  entries: JournalEntry[];
  assessments: SessionAssessment[];
  loading: boolean;
  fetchJournal: () => Promise<void>;
  upsertEntry: (entry: Omit<JournalEntry, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  upsertAssessment: (a: Omit<SessionAssessment, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useTradeJournalStore = create<TradeJournalStore>((set, get) => ({
  entries: [],
  assessments: [],
  loading: false,

  fetchJournal: async () => {
    set({ loading: true });
    const [{ data: eData }, { data: aData }] = await Promise.all([
      supabase.from('trade_journal_entries').select('*').order('date', { ascending: false }),
      supabase.from('trade_journal_assessments').select('*').order('date', { ascending: false }),
    ]);
    set({
      entries: (eData ?? []).map(mapEntry),
      assessments: (aData ?? []).map(mapAssessment),
      loading: false,
    });
  },

  upsertEntry: async (entry) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('trade_journal_entries')
      .upsert(
        {
          user_id: user.id,
          date: entry.date,
          trade_number: entry.tradeNumber,
          ema_setup: entry.emaSetup,
          roe_percent: entry.roePercent,
          pnl_amount: entry.pnlAmount,
          mental_state: entry.mentalState,
          rules_maintained: entry.rulesMaintained,
        },
        { onConflict: 'user_id,date,trade_number' }
      )
      .select()
      .single();
    if (data) {
      const mapped = mapEntry(data);
      set((s) => ({
        entries: s.entries.some((e) => e.id === mapped.id)
          ? s.entries.map((e) => (e.id === mapped.id ? mapped : e))
          : [mapped, ...s.entries],
      }));
    }
  },

  upsertAssessment: async (a) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('trade_journal_assessments')
      .upsert(
        {
          user_id: user.id,
          date: a.date,
          loss_occurred: a.lossOccurred,
          circuit_breaker_executed: a.circuitBreakerExecuted,
          chasing_occurred: a.chasingOccurred,
          grade: a.grade,
          notes: a.notes,
        },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single();
    if (data) {
      const mapped = mapAssessment(data);
      set((s) => ({
        assessments: s.assessments.some((x) => x.id === mapped.id)
          ? s.assessments.map((x) => (x.id === mapped.id ? mapped : x))
          : [mapped, ...s.assessments],
      }));
    }
  },

  deleteEntry: async (id) => {
    await supabase.from('trade_journal_entries').delete().eq('id', id);
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
  },
}));
