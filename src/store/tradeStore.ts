import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Trade {
  id: string;
  userId: string;
  futures: string;
  openTime: string;
  closeTime: string;
  marginMode: string;
  avgEntryPrice: number;
  avgClosePrice: number;
  direction: 'Long' | 'Short';
  closingQty: number;
  tradingFee: number;
  realizedPnl: number;
  status: string;
  createdAt: string;
}

const parseAmount = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const mapTrade = (t: Record<string, unknown>): Trade => ({
  id: t.id as string,
  userId: t.user_id as string,
  futures: t.futures as string,
  openTime: t.open_time as string,
  closeTime: t.close_time as string,
  marginMode: t.margin_mode as string,
  avgEntryPrice: parseAmount(t.avg_entry_price),
  avgClosePrice: parseAmount(t.avg_close_price),
  direction: t.direction as 'Long' | 'Short',
  closingQty: parseAmount(t.closing_qty),
  tradingFee: parseAmount(t.trading_fee),
  realizedPnl: parseAmount(t.realized_pnl),
  status: t.status as string,
  createdAt: t.created_at as string,
});

// Parse MEXC Excel row format into trade payload
export function parseMexcRow(
  row: Record<string, unknown>
): Omit<Trade, 'id' | 'userId' | 'createdAt'> | null {
  try {
    const futures = (row['Futures'] ?? row['futures'] ?? '') as string;
    if (!futures) return null;

    return {
      futures: futures.trim(),
      openTime: String(row['Open Time'] ?? row['open_time'] ?? ''),
      closeTime: String(row['Close Time'] ?? row['close_time'] ?? ''),
      marginMode: String(row['Margin Mode'] ?? row['margin_mode'] ?? 'Cross'),
      avgEntryPrice: parseAmount(row['Avg Entry Price'] ?? row['avg_entry_price']),
      avgClosePrice: parseAmount(row['Avg Close Price'] ?? row['avg_close_price']),
      direction: String(row['Direction'] ?? row['direction'] ?? 'Long') as 'Long' | 'Short',
      closingQty: parseAmount(row['Closing Qty (Cont.)'] ?? row['closing_qty']),
      tradingFee: parseAmount(row['Trading Fee'] ?? row['trading_fee']),
      realizedPnl: parseAmount(row['Realized PNL'] ?? row['realized_pnl']),
      status: String(row['Status'] ?? row['status'] ?? 'All Closed'),
    };
  } catch {
    return null;
  }
}

interface TradeStore {
  trades: Trade[];
  loading: boolean;
  fetchTrades: () => Promise<void>;
  addTrade: (trade: Omit<Trade, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  addTrades: (trades: Omit<Trade, 'id' | 'userId' | 'createdAt'>[]) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  trades: [],
  loading: false,

  fetchTrades: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('trades')
      .select('*')
      .order('close_time', { ascending: false });
    set({ trades: (data ?? []).map(mapTrade), loading: false });
  },

  addTrade: async (trade) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('trades')
      .insert({
        user_id: user.id,
        futures: trade.futures,
        open_time: trade.openTime,
        close_time: trade.closeTime,
        margin_mode: trade.marginMode,
        avg_entry_price: trade.avgEntryPrice,
        avg_close_price: trade.avgClosePrice,
        direction: trade.direction,
        closing_qty: trade.closingQty,
        trading_fee: trade.tradingFee,
        realized_pnl: trade.realizedPnl,
        status: trade.status,
      })
      .select()
      .single();
    if (data) set((s) => ({ trades: [mapTrade(data), ...s.trades] }));
  },

  addTrades: async (trades) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const rows = trades.map((trade) => ({
      user_id: user.id,
      futures: trade.futures,
      open_time: trade.openTime,
      close_time: trade.closeTime,
      margin_mode: trade.marginMode,
      avg_entry_price: trade.avgEntryPrice,
      avg_close_price: trade.avgClosePrice,
      direction: trade.direction,
      closing_qty: trade.closingQty,
      trading_fee: trade.tradingFee,
      realized_pnl: trade.realizedPnl,
      status: trade.status,
    }));
    const { data } = await supabase.from('trades').insert(rows).select();
    if (data) {
      set((s) => ({ trades: [...data.map(mapTrade), ...s.trades] }));
    }
  },

  deleteTrade: async (id) => {
    await supabase.from('trades').delete().eq('id', id);
    set((s) => ({ trades: s.trades.filter((t) => t.id !== id) }));
  },
}));
