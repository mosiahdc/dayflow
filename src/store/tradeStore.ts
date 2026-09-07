import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Trade {
  id: string;
  userId: string;
  // Common fields
  futures: string; // symbol e.g. XAUUSDm, SOLUSDT
  openTime: string; // stored as PHT (UTC+8): 'yyyy-MM-dd HH:mm:ss'
  closeTime: string; // stored as PHT (UTC+8): 'yyyy-MM-dd HH:mm:ss'
  direction: 'Long' | 'Short';
  avgEntryPrice: number;
  avgClosePrice: number;
  closingQty: number; // lots (Exness) or contracts (MEXC)
  tradingFee: number;
  realizedPnl: number;
  // Optional fields
  marginMode: string;
  status: string; // close_reason for Exness, status for MEXC
  source: 'exness' | 'mexc' | 'manual'; // track origin
  createdAt: string;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

const parseNum = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

// Convert UTC ISO timestamp → PHT (UTC+8) string 'yyyy-MM-dd HH:mm:ss'
function utcToPHT(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return pht.toISOString().replace('T', ' ').slice(0, 19);
}

// Parse Exness CSV row
export function parseExnessRow(
  row: Record<string, unknown>
): Omit<Trade, 'id' | 'userId' | 'createdAt'> | null {
  try {
    const symbol = String(row['symbol'] ?? '').trim();
    if (!symbol) return null;
    const type = String(row['type'] ?? '').toLowerCase();
    const commission = parseNum(row['commission']);
    const swap = parseNum(row['swap']);
    return {
      futures: symbol,
      openTime: utcToPHT(String(row['opening_time_utc'] ?? '')),
      closeTime: utcToPHT(String(row['closing_time_utc'] ?? '')),
      direction: type === 'sell' ? 'Short' : 'Long',
      avgEntryPrice: parseNum(row['opening_price']),
      avgClosePrice: parseNum(row['closing_price']),
      closingQty: parseNum(row['lots'] ?? row['original_position_size']),
      tradingFee: commission + swap, // combine commission + swap as fee
      realizedPnl: parseNum(row['profit']),
      marginMode: 'Exness',
      status: String(row['close_reason'] ?? 'closed'),
      source: 'exness',
    };
  } catch {
    return null;
  }
}

// Parse MEXC Excel row (legacy)
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
      avgEntryPrice: parseNum(row['Avg Entry Price'] ?? row['avg_entry_price']),
      avgClosePrice: parseNum(row['Avg Close Price'] ?? row['avg_close_price']),
      direction: String(row['Direction'] ?? row['direction'] ?? 'Long') as 'Long' | 'Short',
      closingQty: parseNum(row['Closing Qty (Cont.)'] ?? row['closing_qty']),
      tradingFee: parseNum(row['Trading Fee'] ?? row['trading_fee']),
      realizedPnl: parseNum(row['Realized PNL'] ?? row['realized_pnl']),
      status: String(row['Status'] ?? row['status'] ?? 'All Closed'),
      source: 'mexc',
    };
  } catch {
    return null;
  }
}

// ── DB mapper ─────────────────────────────────────────────────────────────────

const mapTrade = (t: Record<string, unknown>): Trade => ({
  id: t.id as string,
  userId: t.user_id as string,
  futures: t.futures as string,
  openTime: t.open_time as string,
  closeTime: t.close_time as string,
  marginMode: (t.margin_mode as string) ?? '',
  avgEntryPrice: parseNum(t.avg_entry_price),
  avgClosePrice: parseNum(t.avg_close_price),
  direction: t.direction as 'Long' | 'Short',
  closingQty: parseNum(t.closing_qty),
  tradingFee: parseNum(t.trading_fee),
  realizedPnl: parseNum(t.realized_pnl),
  status: (t.status as string) ?? '',
  source: (t.source as 'exness' | 'mexc' | 'manual') ?? 'manual',
  createdAt: t.created_at as string,
});

const CHUNK_SIZE = 500;
const PAGE_SIZE = 1000;

async function fetchAllTrades(): Promise<Trade[]> {
  const all: Trade[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('close_time', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data.map(mapTrade));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface TradeStore {
  trades: Trade[];
  loading: boolean;
  fetchTrades: () => Promise<void>;
  addTrade: (trade: Omit<Trade, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  addTrades: (
    trades: Omit<Trade, 'id' | 'userId' | 'createdAt'>[],
    onProgress?: (done: number, total: number) => void
  ) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
}

export const useTradeStore = create<TradeStore>((set) => ({
  trades: [],
  loading: false,

  fetchTrades: async () => {
    set({ loading: true });
    const all = await fetchAllTrades();
    set({ trades: all, loading: false });
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
        source: trade.source ?? 'manual',
      })
      .select()
      .single();
    if (data) set((s) => ({ trades: [mapTrade(data), ...s.trades] }));
  },

  addTrades: async (trades, onProgress) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const toRow = (t: Omit<Trade, 'id' | 'userId' | 'createdAt'>) => ({
      user_id: user.id,
      futures: t.futures,
      open_time: t.openTime,
      close_time: t.closeTime,
      margin_mode: t.marginMode,
      avg_entry_price: t.avgEntryPrice,
      avg_close_price: t.avgClosePrice,
      direction: t.direction,
      closing_qty: t.closingQty,
      trading_fee: t.tradingFee,
      realized_pnl: t.realizedPnl,
      status: t.status,
      source: t.source ?? 'manual',
    });
    let inserted = 0;
    for (let i = 0; i < trades.length; i += CHUNK_SIZE) {
      const chunk = trades.slice(i, i + CHUNK_SIZE);
      await supabase.from('trades').insert(chunk.map(toRow));
      inserted += chunk.length;
      onProgress?.(inserted, trades.length);
    }
    const all = await fetchAllTrades();
    set({ trades: all });
  },

  deleteTrade: async (id) => {
    await supabase.from('trades').delete().eq('id', id);
    set((s) => ({ trades: s.trades.filter((t) => t.id !== id) }));
  },
}));
