import type { Trade, TradeOrderDetail } from '@/store/tradeStore';
import type { TradeTransaction } from '@/store/tradeSettingsStore';

export interface NegativeBalanceReset {
  at: string;
  amount: number;
  orderCount: number;
}

export interface BalanceReconciliation {
  balance: number;
  deposits: number;
  withdrawals: number;
  fundingFees: number;
  tradingPnl: number;
  negativeBalanceProtection: number;
  resets: NegativeBalanceReset[];
}

interface LedgerEvent {
  atMs: number;
  sortOrder: number;
  kind: 'cash' | 'trade';
  amount: number;
  phtTime: string;
  hasStopOut: boolean;
  orderCount: number;
}

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

function parsePhtTimestamp(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, sec = '0'] = match;
  return (
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec)) -
    PHT_OFFSET_MS
  );
}

function isoToPhtString(value: string): string {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return value;
  return new Date(ms + PHT_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19);
}

function orderRows(trades: Trade[]): TradeOrderDetail[] {
  const rows: TradeOrderDetail[] = [];
  for (const trade of trades) {
    if (trade.orders?.length) {
      rows.push(...trade.orders);
      continue;
    }
    rows.push({
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
    });
  }
  return rows;
}

/**
 * Rebuild the Exness account balance chronologically.
 *
 * Exness Negative Balance Protection performs a "null operation" after a
 * stop-out if the trading-account balance has fallen below zero. The CSV trade
 * export does not include that D-null cash adjustment, so a plain
 * `initial + deposits - withdrawals + PNL` total can be too low.
 *
 * We reproduce the broker ledger by applying every cash-flow transaction and
 * every underlying Exness order close in time order. If a stop-out close batch
 * leaves the balance negative, the negative amount is credited back and the
 * running balance is reset to zero.
 */
export function reconcileExnessBalance(
  initialBalance: number,
  trades: Trade[],
  transactions: TradeTransaction[],
  cutoffMs?: number
): BalanceReconciliation {
  const events: LedgerEvent[] = [];

  let deposits = 0;
  let withdrawals = 0;
  let fundingFees = 0;

  for (const tx of transactions) {
    const atMs = new Date(tx.createdAt).getTime();
    if (!Number.isFinite(atMs) || (cutoffMs !== undefined && atMs >= cutoffMs)) continue;

    if (tx.type === 'deposit') deposits += tx.amount;
    if (tx.type === 'withdrawal') withdrawals += tx.amount;
    if (tx.type === 'funding_fee') fundingFees += tx.amount;

    events.push({
      atMs,
      // When timestamps are identical, apply cash flow before trade closes.
      sortOrder: 0,
      kind: 'cash',
      amount: tx.amount,
      phtTime: isoToPhtString(tx.createdAt),
      hasStopOut: false,
      orderCount: 0,
    });
  }

  const groupedCloses = new Map<
    number,
    { phtTime: string; pnl: number; hasStopOut: boolean; orderCount: number }
  >();
  let tradingPnl = 0;

  for (const order of orderRows(trades)) {
    const atMs = parsePhtTimestamp(order.closeTime);
    if (atMs === null || (cutoffMs !== undefined && atMs >= cutoffMs)) continue;

    tradingPnl += order.realizedPnl;
    const current = groupedCloses.get(atMs) ?? {
      phtTime: order.closeTime,
      pnl: 0,
      hasStopOut: false,
      orderCount: 0,
    };
    current.pnl += order.realizedPnl;
    current.hasStopOut ||= order.status.trim().toLowerCase() === 'so';
    current.orderCount += 1;
    groupedCloses.set(atMs, current);
  }

  for (const [atMs, group] of groupedCloses) {
    events.push({
      atMs,
      sortOrder: 1,
      kind: 'trade',
      amount: group.pnl,
      phtTime: group.phtTime,
      hasStopOut: group.hasStopOut,
      orderCount: group.orderCount,
    });
  }

  events.sort((a, b) => a.atMs - b.atMs || a.sortOrder - b.sortOrder);

  let balance = initialBalance;
  let negativeBalanceProtection = 0;
  const resets: NegativeBalanceReset[] = [];

  for (const event of events) {
    balance += event.amount;

    if (event.kind === 'trade' && event.hasStopOut && balance < 0) {
      const resetAmount = -balance;
      negativeBalanceProtection += resetAmount;
      resets.push({
        at: event.phtTime,
        amount: resetAmount,
        orderCount: event.orderCount,
      });
      balance = 0;
    }
  }

  return {
    balance,
    deposits,
    withdrawals,
    fundingFees,
    tradingPnl,
    negativeBalanceProtection,
    resets,
  };
}

export function phtTimestampToUtcMs(value: string): number | null {
  return parsePhtTimestamp(value);
}
