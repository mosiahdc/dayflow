import { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format } from 'date-fns';
import type { Trade } from '@/store/tradeStore';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface DayStats {
  pnl: number;
  wins: number;
  losses: number;
  total: number;
}

interface Props {
  monthDate: Date;
  trades: Trade[];
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
  const dayNum = format(new Date(date + 'T12:00:00'), 'd');

  const pnlColor =
    !stats || stats.total === 0
      ? ''
      : stats.pnl > 0
        ? 'bg-green-50 dark:bg-green-900/20'
        : stats.pnl < 0
          ? 'bg-red-50 dark:bg-red-900/20'
          : '';

  const pnlTextColor =
    !stats || stats.total === 0
      ? 'text-brand-muted'
      : stats.pnl > 0
        ? 'text-green-600 dark:text-green-400'
        : stats.pnl < 0
          ? 'text-red-500 dark:text-red-400'
          : 'text-brand-muted';

  return (
    <div
      className={`min-h-[96px] border-r border-b dark:border-gray-700 p-1.5 flex flex-col transition-colors
        ${!isCurrentMonth ? 'opacity-30 bg-gray-50 dark:bg-gray-800/50' : `bg-white dark:bg-gray-800 ${pnlColor}`}
        ${isToday ? 'ring-2 ring-inset ring-brand-amber' : ''}`}
    >
      {/* Day number */}
      <div className="flex justify-start mb-1">
        <span
          className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center
            ${isToday ? 'bg-brand-amber text-white' : 'dark:text-gray-300'}`}
        >
          {dayNum}
        </span>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 ? (
        <div className="flex flex-col gap-0.5 text-center flex-1 justify-center">
          {/* PNL */}
          <p className={`text-xs font-bold leading-tight ${pnlTextColor}`}>
            {stats.pnl >= 0 ? '+' : ''}
            {stats.pnl.toFixed(3)}
          </p>
          {/* W/L */}
          <p className="text-[10px] leading-tight text-gray-500 dark:text-gray-400">
            <span className="text-green-600 dark:text-green-400 font-semibold">{stats.wins}W</span>
            {' '}
            <span className="text-red-500 dark:text-red-400 font-semibold">{stats.losses}L</span>
          </p>
          {/* Total trades */}
          <p className="text-[10px] leading-tight text-brand-muted">{stats.total} trade{stats.total !== 1 ? 's' : ''}</p>
        </div>
      ) : null}
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

  // Build stats per date
  const statsByDate = useMemo(() => {
    const map = new Map<string, DayStats>();
    for (const trade of trades) {
      const dateKey = trade.closeTime.slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, { pnl: 0, wins: 0, losses: 0, total: 0 });
      const s = map.get(dateKey)!;
      s.pnl += trade.realizedPnl;
      s.total += 1;
      if (trade.realizedPnl > 0) s.wins += 1;
      else if (trade.realizedPnl < 0) s.losses += 1;
    }
    return map;
  }, [trades]);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    let pnl = 0, wins = 0, losses = 0, total = 0;
    for (const trade of trades) {
      const d = trade.closeTime.slice(0, 7);
      if (d !== monthStr) continue;
      pnl += trade.realizedPnl;
      total += 1;
      if (trade.realizedPnl > 0) wins += 1;
      else if (trade.realizedPnl < 0) losses += 1;
    }
    return { pnl, wins, losses, total };
  }, [trades, monthStr]);

  const winRate = monthlySummary.total > 0
    ? Math.round((monthlySummary.wins / monthlySummary.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Monthly summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-3 text-center">
          <p className="text-xs text-brand-muted mb-1">Month PNL</p>
          <p className={`text-lg font-bold ${monthlySummary.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {monthlySummary.pnl >= 0 ? '+' : ''}{monthlySummary.pnl.toFixed(3)} USDT
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-3 text-center">
          <p className="text-xs text-brand-muted mb-1">Total Trades</p>
          <p className="text-lg font-bold dark:text-white">{monthlySummary.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-3 text-center">
          <p className="text-xs text-brand-muted mb-1">Win Rate</p>
          <p className={`text-lg font-bold ${winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {winRate}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-3 text-center">
          <p className="text-xs text-brand-muted mb-1">W / L</p>
          <p className="text-lg font-bold dark:text-white">
            <span className="text-green-600 dark:text-green-400">{monthlySummary.wins}</span>
            <span className="text-brand-muted mx-1">/</span>
            <span className="text-red-500 dark:text-red-400">{monthlySummary.losses}</span>
          </p>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b dark:border-gray-700">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-brand-muted py-2 border-r dark:border-gray-700 last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {cells.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isCurrentMonth = format(day, 'yyyy-MM') === monthStr;
            const stats = statsByDate.get(dateStr) ?? null;
            return (
              <TradeCalendarCell
                key={dateStr}
                date={dateStr}
                isCurrentMonth={isCurrentMonth}
                stats={stats}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
