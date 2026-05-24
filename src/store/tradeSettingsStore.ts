import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface TradeTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'funding_fee';
  amount: number;
  note: string;
  createdAt: string;
}

interface TradeSettingsStore {
  initialBalance: number;
  transactions: TradeTransaction[];
  loading: boolean;
  fetchSettings: () => Promise<void>;
  setInitialBalance: (v: number) => Promise<void>;
  addTransaction: (
    type: 'deposit' | 'withdrawal' | 'funding_fee',
    amount: number,
    note: string
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

const mapTx = (t: Record<string, unknown>): TradeTransaction => ({
  id: t.id as string,
  type: t.type as 'deposit' | 'withdrawal',
  amount: Number(t.amount),
  note: (t.note as string) ?? '',
  createdAt: t.created_at as string,
});

export const useTradeSettingsStore = create<TradeSettingsStore>((set, get) => ({
  initialBalance: 0,
  transactions: [],
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });

    // Fetch initial balance
    const { data: settingsData } = await supabase
      .from('trade_settings')
      .select('initial_balance')
      .single();

    // Fetch transactions
    const { data: txData } = await supabase
      .from('trade_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    set({
      initialBalance: settingsData ? Number(settingsData.initial_balance) : 0,
      transactions: (txData ?? []).map(mapTx),
      loading: false,
    });
  },

  setInitialBalance: async (initialBalance) => {
    // Optimistic
    set({ initialBalance });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('trade_settings')
      .upsert(
        { user_id: user.id, initial_balance: initialBalance, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  },

  addTransaction: async (type, amount, note) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('trade_transactions')
      .insert({ user_id: user.id, type, amount, note })
      .select()
      .single();

    if (data) {
      set((s) => ({ transactions: [mapTx(data), ...s.transactions] }));
    }
  },

  deleteTransaction: async (id) => {
    await supabase.from('trade_transactions').delete().eq('id', id);
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
  },
}));
