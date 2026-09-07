import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface TradeOrderDetail {
  id: string;
  referenceOrderId?: string | undefined;
  openTime: string;
  closeTime: string;
  direction: 'Long' | 'Short';
  avgEntryPrice: number;
  avgClosePrice: number;
  closingQty: number;
  tradingFee: number;
  realizedPnl: number;
  status: string;
}

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

  // Exness position/order reference. This is kept so later exits from the same
  // opening batch can still be tied back to the original positions.
  referenceOrderId?: string | undefined;

  // Logical-trade metadata. Raw database rows stay untouched; these fields are
  // added in memory when several Exness orders are consolidated into one trade.
  sourceIds?: string[];
  referenceOrderIds?: string[];
  orderCount?: number;
  orders?: TradeOrderDetail[];
}

type TradeInput = Omit<
  Trade,
  'id' | 'userId' | 'createdAt' | 'sourceIds' | 'referenceOrderIds' | 'orderCount' | 'orders'
>;

// ── Parsers ───────────────────────────────────────────────────────────────────

const parseNum = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const parseText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return undefined;
};


const normalizeHeader = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');

function getRowValue(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
  }
  const wanted = new Set(names.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizeHeader(key))) return value;
  }
  return undefined;
}

function exnessUtcToPHT(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // ISO timestamps that already carry UTC/offset information.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    return utcToPHT(raw);
  }

  // yyyy-mm-dd hh:mm:ss, treated as UTC because Exness export times are UTC.
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (match) {
    const [, y, mo, d, h, mi, sec = '0'] = match;
    const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec));
    const pht = new Date(utc + 8 * 60 * 60 * 1000);
    return pht.toISOString().replace('T', ' ').slice(0, 19);
  }

  // dd-mm-yyyy / dd.mm.yyyy hh:mm:ss.
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (match) {
    const [, d, mo, y, h, mi, sec = '0'] = match;
    const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec));
    const pht = new Date(utc + 8 * 60 * 60 * 1000);
    return pht.toISOString().replace('T', ' ').slice(0, 19);
  }

  // dd MMM yyyy hh:mm:ss (e.g. 04 Sep 2026 15:30:59).
  match = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})[, ]+\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (match) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const [, d, mon, y, h, mi, sec = '0'] = match;
    const mo = months.indexOf(mon!.slice(0, 3).toLowerCase());
    if (mo >= 0) {
      const utc = Date.UTC(Number(y), mo, Number(d), Number(h), Number(mi), Number(sec));
      const pht = new Date(utc + 8 * 60 * 60 * 1000);
      return pht.toISOString().replace('T', ' ').slice(0, 19);
    }
  }

  // Final fallback for other browser-parseable UTC values.
  const parsed = new Date(raw.endsWith('Z') ? raw : `${raw} UTC`);
  return Number.isNaN(parsed.getTime()) ? '' : utcToPHT(parsed.toISOString());
}

// Convert UTC ISO timestamp → PHT (UTC+8) string 'yyyy-MM-dd HH:mm:ss'
function utcToPHT(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return pht.toISOString().replace('T', ' ').slice(0, 19);
}

// Parse Exness CSV row. Header matching is intentionally flexible because
// Exness exports can use either machine-style names or human-readable labels.
export function parseExnessRow(row: Record<string, unknown>): TradeInput | null {
  try {
    const symbol = String(
      getRowValue(row, 'symbol', 'instrument', 'asset', 'market', 'pair') ?? ''
    ).trim();
    if (!symbol) return null;

    const type = String(
      getRowValue(row, 'type', 'side', 'direction', 'order type', 'position type') ?? ''
    ).toLowerCase();
    const direction: 'Long' | 'Short' =
      type.includes('sell') || type.includes('short') ? 'Short' : 'Long';

    const openTime = exnessUtcToPHT(
      getRowValue(
        row,
        'opening_time_utc',
        'open_time_utc',
        'opening time utc',
        'open time utc',
        'opening time',
        'open time'
      )
    );
    const closeTime = exnessUtcToPHT(
      getRowValue(
        row,
        'closing_time_utc',
        'close_time_utc',
        'closing time utc',
        'close time utc',
        'closing time',
        'close time'
      )
    );
    if (!openTime || !closeTime) return null;

    const commission = parseNum(getRowValue(row, 'commission', 'commission usd'));
    const swap = parseNum(getRowValue(row, 'swap', 'swap usd'));

    return {
      futures: symbol,
      openTime,
      closeTime,
      direction,
      avgEntryPrice: parseNum(
        getRowValue(row, 'opening_price', 'open_price', 'opening price', 'open price', 'entry price')
      ),
      avgClosePrice: parseNum(
        getRowValue(row, 'closing_price', 'close_price', 'closing price', 'close price', 'exit price')
      ),
      closingQty: parseNum(
        getRowValue(
          row,
          'lots',
          'lot',
          'volume',
          'volume in lots',
          'original_position_size',
          'original position size',
          'position size',
          'size'
        )
      ),
      tradingFee: commission + swap,
      realizedPnl: parseNum(
        getRowValue(row, 'profit', 'profit usd', 'pnl', 'p/l', 'realized pnl', 'realized profit')
      ),
      marginMode: 'Exness',
      status: String(
        getRowValue(row, 'close_reason', 'close reason', 'closed by', 'status') ?? 'closed'
      ),
      source: 'exness',
      referenceOrderId: parseText(
        getRowValue(
          row,
          'position_id',
          'position id',
          'position',
          'order_id',
          'order id',
          'ticket',
          'deal id'
        )
      ),
    };
  } catch {
    return null;
  }
}

// Parse MEXC Excel row (legacy)
export function parseMexcRow(row: Record<string, unknown>): TradeInput | null {
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
  source:
    (t.source as 'exness' | 'mexc' | 'manual') ??
    (String(t.margin_mode ?? '').toLowerCase() === 'exness' ? 'exness' : 'manual'),
  referenceOrderId: parseText(t.reference_order_id, t.position_id, t.order_id),
  createdAt: t.created_at as string,
  sourceIds: [t.id as string],
  referenceOrderIds: parseText(t.reference_order_id, t.position_id, t.order_id)
    ? [parseText(t.reference_order_id, t.position_id, t.order_id)!]
    : [],
  orderCount: 1,
});

// ── Exness logical-trade consolidation ────────────────────────────────────────

const EXNESS_ENTRY_WINDOW_MS = 2 * 60 * 1000;

function parsePhtMs(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s = '0'] = match;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

function isExnessTrade(trade: Trade): boolean {
  return trade.source === 'exness' || trade.marginMode.trim().toLowerCase() === 'exness';
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function weightedAverage(members: Trade[], field: 'avgEntryPrice' | 'avgClosePrice'): number {
  const totalWeight = members.reduce((sum, t) => sum + Math.abs(t.closingQty), 0);
  if (totalWeight > 0) {
    return (
      members.reduce((sum, t) => sum + t[field] * Math.abs(t.closingQty), 0) / totalWeight
    );
  }
  return members.reduce((sum, t) => sum + t[field], 0) / members.length;
}

function stableLeader(members: Trade[]): Trade {
  return [...members].sort((a, b) => {
    const createdCompare = (a.createdAt || '').localeCompare(b.createdAt || '');
    return createdCompare !== 0 ? createdCompare : a.id.localeCompare(b.id);
  })[0]!;
}

function toOrderDetail(trade: Trade): TradeOrderDetail {
  return {
    id: trade.id,
    referenceOrderId: trade.referenceOrderId,
    openTime: trade.openTime,
    closeTime: trade.closeTime,
    direction: trade.direction,
    avgEntryPrice: trade.avgEntryPrice,
    avgClosePrice: trade.avgClosePrice,
    closingQty: trade.closingQty,
    tradingFee: trade.tradingFee,
    realizedPnl: trade.realizedPnl,
    status: trade.status,
  };
}

function consolidateGroup(members: Trade[]): Trade {
  if (members.length === 1) {
    const only = members[0]!;
    return {
      ...only,
      sourceIds: only.sourceIds?.length ? only.sourceIds : [only.id],
      referenceOrderIds: only.referenceOrderId ? [only.referenceOrderId] : [],
      orderCount: 1,
      orders: [toOrderDetail(only)],
    };
  }

  const leader = stableLeader(members);
  const refs = [...new Set(members.flatMap((t) => t.referenceOrderId ? [t.referenceOrderId] : []))];
  const sourceIds = [...new Set(members.flatMap((t) => t.sourceIds?.length ? t.sourceIds : [t.id]))];
  const orders = [...members]
    .sort((a, b) => {
      const openCompare = a.openTime.localeCompare(b.openTime);
      if (openCompare !== 0) return openCompare;
      const closeCompare = a.closeTime.localeCompare(b.closeTime);
      return closeCompare !== 0 ? closeCompare : a.id.localeCompare(b.id);
    })
    .map(toOrderDetail);

  return {
    ...leader,
    // Keep a stable persisted row id as the logical trade id. Notes/video remain
    // attached even when more positions from this opening batch close later.
    id: leader.id,
    openTime: members.reduce((min, t) => (t.openTime < min ? t.openTime : min), members[0]!.openTime),
    // The logical trade stays the same while partial TP exits arrive. Its close
    // time simply extends to the latest child order that has exited so far.
    closeTime: members.reduce((max, t) => (t.closeTime > max ? t.closeTime : max), members[0]!.closeTime),
    avgEntryPrice: weightedAverage(members, 'avgEntryPrice'),
    avgClosePrice: weightedAverage(members, 'avgClosePrice'),
    closingQty: members.reduce((sum, t) => sum + t.closingQty, 0),
    tradingFee: members.reduce((sum, t) => sum + t.tradingFee, 0),
    realizedPnl: members.reduce((sum, t) => sum + t.realizedPnl, 0),
    status: 'All Closed',
    source: 'exness',
    referenceOrderId: leader.referenceOrderId,
    referenceOrderIds: refs,
    sourceIds,
    orderCount: members.length,
    orders,
  };
}

/**
 * Consolidate a burst of Exness positions into one logical trade.
 *
 * Rules:
 * - Exness only; MEXC/manual records remain one row each.
 * - Same symbol + same direction.
 * - Orders opened in the same 2-minute opening batch are one trade.
 * - Close time is NOT used for grouping, so 2 TP exits now and the remaining 13
 *   several minutes later still become the same logical trade once they arrive.
 * - Position/order references are retained on the logical trade.
 */
export function consolidateTrades(rawTrades: Trade[]): Trade[] {
  const untouched: Trade[] = [];
  const exnessByKey = new Map<string, Trade[]>();

  // Drop exact repeated Exness imports when a position/order reference is present.
  // Distinct partial-close rows are retained because their close/qty/PNL differ.
  const exactSeen = new Map<string, Trade>();

  for (const trade of rawTrades) {
    if (!isExnessTrade(trade) || parsePhtMs(trade.openTime) === null) {
      untouched.push({
        ...trade,
        sourceIds: trade.sourceIds?.length ? trade.sourceIds : [trade.id],
        referenceOrderIds: trade.referenceOrderId ? [trade.referenceOrderId] : [],
        orderCount: 1,
        orders: [toOrderDetail(trade)],
      });
      continue;
    }

    let tradeForGrouping = trade;
    if (trade.referenceOrderId) {
      const exactKey = [
        trade.referenceOrderId,
        trade.openTime,
        trade.closeTime,
        trade.closingQty,
        trade.realizedPnl,
      ].join('|');
      const existing = exactSeen.get(exactKey);
      if (existing) {
        existing.sourceIds = [...new Set([...(existing.sourceIds ?? [existing.id]), trade.id])];
        continue;
      }
      tradeForGrouping = {
        ...trade,
        sourceIds: trade.sourceIds?.length ? [...trade.sourceIds] : [trade.id],
      };
      exactSeen.set(exactKey, tradeForGrouping);
    }

    const key = `${normalizeSymbol(tradeForGrouping.futures)}|${tradeForGrouping.direction}`;
    const list = exnessByKey.get(key) ?? [];
    list.push(tradeForGrouping);
    exnessByKey.set(key, list);
  }

  const consolidated: Trade[] = [...untouched];

  for (const groupTrades of exnessByKey.values()) {
    const sorted = [...groupTrades].sort((a, b) => {
      const timeA = parsePhtMs(a.openTime) ?? 0;
      const timeB = parsePhtMs(b.openTime) ?? 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id);
    });

    let batch: Trade[] = [];
    let batchStartMs: number | null = null;

    const flush = () => {
      if (batch.length > 0) consolidated.push(consolidateGroup(batch));
      batch = [];
      batchStartMs = null;
    };

    for (const trade of sorted) {
      const openMs = parsePhtMs(trade.openTime)!;
      if (batchStartMs === null || openMs - batchStartMs <= EXNESS_ENTRY_WINDOW_MS) {
        if (batchStartMs === null) batchStartMs = openMs;
        batch.push(trade);
      } else {
        flush();
        batchStartMs = openMs;
        batch.push(trade);
      }
    }
    flush();
  }

  return consolidated.sort((a, b) => b.closeTime.localeCompare(a.closeTime));
}

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
  return consolidateTrades(all);
}

function toDbRow(userId: string, t: TradeInput): Record<string, unknown> {
  return {
    user_id: userId,
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
    reference_order_id: t.referenceOrderId ?? null,
  };
}

function withoutOptionalColumns(row: Record<string, unknown>, message: string): Record<string, unknown> {
  const next = { ...row };
  if (/reference_order_id/i.test(message)) delete next.reference_order_id;
  if (/\bsource\b/i.test(message)) delete next.source;
  return next;
}

async function insertRowsWithLegacyFallback(rows: Record<string, unknown>[]) {
  let result = await supabase.from('trades').insert(rows);
  if (!result.error) return result;

  const reduced = rows.map((row) => withoutOptionalColumns(row, result.error!.message));
  const changed = reduced.some((row, i) => Object.keys(row).length !== Object.keys(rows[i]!).length);
  if (!changed) return result;

  result = await supabase.from('trades').insert(reduced);
  return result;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface TradeStore {
  trades: Trade[];
  loading: boolean;
  fetchTrades: () => Promise<void>;
  addTrade: (trade: TradeInput) => Promise<void>;
  addTrades: (
    trades: TradeInput[],
    onProgress?: (done: number, total: number) => void
  ) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
}

export const useTradeStore = create<TradeStore>((set, get) => ({
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

    const row = toDbRow(user.id, trade);
    let result = await supabase.from('trades').insert(row).select().single();

    // Backward compatibility for an existing DB that has not run the new
    // reference_order_id/source migration yet.
    if (result.error) {
      const reduced = withoutOptionalColumns(row, result.error.message);
      if (Object.keys(reduced).length !== Object.keys(row).length) {
        result = await supabase.from('trades').insert(reduced).select().single();
      }
    }

    if (!result.error && result.data) {
      const all = await fetchAllTrades();
      set({ trades: all });
    }
  },

  addTrades: async (trades, onProgress) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let inserted = 0;
    for (let i = 0; i < trades.length; i += CHUNK_SIZE) {
      const chunk = trades.slice(i, i + CHUNK_SIZE);
      const result = await insertRowsWithLegacyFallback(chunk.map((t) => toDbRow(user.id, t)));
      if (result.error) throw result.error;
      inserted += chunk.length;
      onProgress?.(inserted, trades.length);
    }
    const all = await fetchAllTrades();
    set({ trades: all });
  },

  deleteTrade: async (id) => {
    const logicalTrade = get().trades.find((t: Trade) => t.id === id);
    const ids = logicalTrade?.sourceIds?.length ? logicalTrade.sourceIds : [id];

    if (ids.length === 1) await supabase.from('trades').delete().eq('id', ids[0]!);
    else await supabase.from('trades').delete().in('id', ids);

    set((s: TradeStore) => ({ trades: s.trades.filter((t: Trade) => t.id !== id) }));
  },
}));
