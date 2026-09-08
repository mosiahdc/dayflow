import { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format } from 'date-fns';
import type { Trade } from '@/store/tradeStore';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface DayStats {
  pnl: number;
  wins: number;
  losses: number;
  total: number;
  qty: number;
}

interface Props {
  monthDate: Date;
  trades: Trade[];
}

function StatCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'green' | 'red' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 dark:bg-white/[0.02] px-4 py-3 text-center shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">{label}</p>
      <p className={`mt-2 text-xl font-extrabold ${tone === 'green' ? 'text-green-600 dark:text-green-400' : tone === 'red' ? 'text-red-500 dark:text-red-400' : 'dark:text-white'}`}>
        {value}
      </p>
    </div>
  );
}

function TradeCalendarCell({
  date,
  isCurrentMonth,
  stats,
}: {
  date: string;
  isCurrentMonth: boolean;
  stats: DayStats | null;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const isToday = date === today;
  const dayNum = format(new Date(`${date}T12:00:00`), 'd');
  const hasTrades = Boolean(stats && stats.total > 0);
  const pnlPositive = (stats?.pnl ?? 0) > 0;
  const pnlNegative = (stats?.pnl ?? 0) < 0;

  const cellClass = !isCurrentMonth
    ? 'opacity-30 bg-black/10 dark:bg-white/[0.01]'
    : hasTrades
      ? pnlPositive
        ? 'bg-green-500/10'
        : pnlNegative
          ? 'bg-red-500/10'
          : 'bg-white/[0.02]'
      : 'bg-black/10 dark:bg-white/[0.01]';

  return (
    <div
      className={`min-h-[132px] border-r border-b border-white/10 p-2.5 flex flex-col transition-all ${cellClass} ${isToday ? 'ring-2 ring-inset ring-brand-amber shadow-[0_0_0_1px_rgba(245,158,11,.2)]' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${isToday ? 'bg-brand-amber text-white' : 'bg-white/[0.06] text-white'}`}>
          {dayNum}
        </div>
        {hasTrades && (
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-brand-muted">
            {stats!.total} trade{stats!.total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="mt-4 flex-1">
        {hasTrades ? (
          <>
            <div className={`text-lg font-extrabold tracking-tight ${pnlPositive ? 'text-green-600 dark:text-green-400' : pnlNegative ? 'text-red-500 dark:text-red-400' : 'dark:text-white'}`}>
              {stats!.pnl >= 0 ? '+' : ''}{stats!.pnl.toFixed(2)}
            </div>
            <div className="mt-1 text-[11px] text-brand-muted">PNL</div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-green-500/10 px-2 py-1 text-[10px] font-bold text-green-600 dark:text-green-400">
                {stats!.wins}W
              </span>
              <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-500 dark:text-red-400">
                {stats!.losses}L
              </span>
              <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-brand-muted">
                Qty {stats!.qty.toFixed(2)}
              </span>
            </div>
          </>
        ) : (
          <div className="h-full flex items-end">
            <span className="text-[10px] uppercase tracking-[0.12em] text-brand-muted/70">No trades</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TradeCalendar({ monthDate, trades }: Props) {
  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    const days = [];
    let cur = start;
    while (cur <= end) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    return days;
  }, [monthDate]);

  const monthStr = format(monthDate, 'yyyy-MM');

  const statsByDate = useMemo(() => {
    const map = new Map<string, DayStats>();
    for (const trade of trades) {
      const dateKey = trade.closeTime.slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, { pnl: 0, wins: 0, losses: 0, total: 0, qty: 0 });
      const s = map.get(dateKey)!;
      s.pnl += trade.realizedPnl;
      s.total += 1;
      s.qty += trade.closingQty;
      if (trade.realizedPnl > 0) s.wins += 1;
      else if (trade.realizedPnl < 0) s.losses += 1;
    }
    return map;
  }, [trades]);

  const monthlySummary = useMemo(() => {
    let pnl = 0, wins = 0, losses = 0, total = 0, qty = 0;
    for (const trade of trades) {
      const d = trade.closeTime.slice(0, 7);
      if (d !== monthStr) continue;
      pnl += trade.realizedPnl;
      total += 1;
      qty += trade.closingQty;
      if (trade.realizedPnl > 0) wins += 1;
      else if (trade.realizedPnl < 0) losses += 1;
    }
    return { pnl, wins, losses, total, qty };
  }, [trades, monthStr]);

  const winRate = monthlySummary.total > 0 ? Math.round((monthlySummary.wins / monthlySummary.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Month PNL"
          value={`${monthlySummary.pnl >= 0 ? '+' : ''}${monthlySummary.pnl.toFixed(2)} USD`}
          tone={monthlySummary.pnl >= 0 ? 'green' : 'red'}
        />
        <StatCard label="Total Trades" value={String(monthlySummary.total)} />
        <StatCard label="Win Rate" value={`${winRate}%`} tone={winRate >= 50 ? 'green' : 'red'} />
        <StatCard label="Volume" value={monthlySummary.qty.toFixed(2)} />
      </div>

      <div className="rounded-[24px] border border-white/10 bg-[#0b111b]/90 shadow-[0_20px_50px_rgba(0,0,0,.25)] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-brand-muted py-3 border-r border-white/10 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isCurrentMonth = format(day, 'yyyy-MM') === monthStr;
            const stats = statsByDate.get(dateStr) ?? null;
            return <TradeCalendarCell key={dateStr} date={dateStr} isCurrentMonth={isCurrentMonth} stats={stats} />;
          })}
        </div>
      </div>
    </div>
  );
}
