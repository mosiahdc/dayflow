import { useEffect, useMemo, useState } from 'react';
import {
  format,
  subDays,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  subMonths,
  parseISO,
  differenceInSeconds,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
  endOfWeek,
  isWithinInterval,
} from 'date-fns';
import { usePlannerStore } from '@/store/plannerStore';
import { useHabitStore } from '@/store/habitStore';
import { useTaskStore } from '@/store/taskStore';
import { useFastingStore } from '@/store/fastingStore';
import type { FastingSession } from '@/store/fastingStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';

const COLORS = ['#4F6EF7', '#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Fasting helpers ────────────────────────────────────────────────────────
function sessionDurationHours(s: FastingSession): number {
  if (!s.endedAt) return 0;
  return differenceInSeconds(parseISO(s.endedAt), parseISO(s.startedAt)) / 3600;
}
function goalMet(s: FastingSession): boolean {
  return sessionDurationHours(s) >= s.goalHours;
}
function fmtHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

type FastingPeriod = 'weekly' | 'monthly' | 'yearly';

function FastingStatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
      <p className="text-xs text-brand-muted mb-1">{label}</p>
      <p className="text-2xl font-bold dark:text-white">{value}</p>
      {sub && <p className="text-xs text-brand-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function FastingWeekly({ sessions }: { sessions: FastingSession[] }) {
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = format(d, 'yyyy-MM-dd');
        const daySessions = sessions.filter((s) => {
          if (!s.endedAt) return false;
          const start = format(parseISO(s.startedAt), 'yyyy-MM-dd');
          const end = format(parseISO(s.endedAt), 'yyyy-MM-dd');
          return start === dateStr || end === dateStr;
        });
        const totalHours = daySessions.reduce((acc, s) => acc + sessionDurationHours(s), 0);
        const goal = daySessions[0]?.goalHours ?? 16;
        return {
          label: format(d, 'EEE'),
          hours: Math.round(totalHours * 10) / 10,
          goal,
          met: totalHours >= goal && daySessions.length > 0,
        };
      }),
    [sessions]
  );

  const completedCount = days.filter((d) => d.met).length;
  const totalHours = days.reduce((acc, d) => acc + d.hours, 0);
  const avgHours = completedCount > 0 ? totalHours / completedCount : 0;

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <FastingStatCard label="Fasts This Week" value={`${completedCount}`} sub="completed" />
        <FastingStatCard label="Total Hours" value={fmtHours(totalHours)} sub="this week" />
        <FastingStatCard
          label="Avg Duration"
          value={completedCount > 0 ? fmtHours(avgHours) : '—'}
          sub="per fast"
        />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
        <h3 className="text-sm font-semibold dark:text-white mb-3">Fasting Hours — Last 7 Days</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={days}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="h" />
            <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}h`, 'Hours fasted']} />
            <ReferenceLine
              y={16}
              stroke="#F59E0B"
              strokeDasharray="4 4"
              label={{ value: '16h goal', fontSize: 10, fill: '#F59E0B' }}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
              {days.map((d, i) => (
                <Cell key={i} fill={d.met ? '#10B981' : d.hours > 0 ? '#4F6EF7' : '#E5E7EB'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span className="text-xs text-brand-muted">Goal met</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-brand-accent" />
            <span className="text-xs text-brand-muted">Partial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gray-200" />
            <span className="text-xs text-brand-muted">No fast</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FastingMonthly({ sessions }: { sessions: FastingSession[] }) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const weeks = useMemo(() => {
    const weekStarts = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 1 }
    );
    return weekStarts.map((ws) => {
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const weekSessions = sessions.filter(
        (s) => s.endedAt && isWithinInterval(parseISO(s.startedAt), { start: ws, end: we })
      );
      const totalHours = weekSessions.reduce((acc, s) => acc + sessionDurationHours(s), 0);
      const metCount = weekSessions.filter(goalMet).length;
      return {
        label: `W${format(ws, 'w')}`,
        sublabel: format(ws, 'MMM d'),
        hours: Math.round(totalHours * 10) / 10,
        fasts: weekSessions.length,
        met: metCount,
      };
    });
  }, [sessions]);

  const monthSessions = sessions.filter(
    (s) =>
      s.endedAt && isWithinInterval(parseISO(s.startedAt), { start: monthStart, end: monthEnd })
  );
  const totalFasts = monthSessions.length;
  const totalHours = monthSessions.reduce((acc, s) => acc + sessionDurationHours(s), 0);
  const goalMetCount = monthSessions.filter(goalMet).length;

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <FastingStatCard label="Fasts This Month" value={`${totalFasts}`} sub="completed" />
        <FastingStatCard label="Total Hours" value={fmtHours(totalHours)} sub="this month" />
        <FastingStatCard label="Goals Met" value={`${goalMetCount}`} sub="sessions at goal" />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
        <h3 className="text-sm font-semibold dark:text-white mb-3">
          Weekly Fasting Hours — {format(now, 'MMMM yyyy')}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeks}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="h" />
            <Tooltip
              formatter={(v: number | undefined) => [`${v ?? 0}h`, 'Total hours']}
              labelFormatter={(l) => {
                const w = weeks.find((x) => x.label === l);
                return w ? `${l} (${w.sublabel})` : l;
              }}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
              {weeks.map((w, i) => (
                <Cell
                  key={i}
                  fill={w.hours >= 80 ? '#10B981' : w.hours > 0 ? '#4F6EF7' : '#E5E7EB'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
        <h3 className="text-sm font-semibold dark:text-white mb-3">Sessions This Month</h3>
        {monthSessions.length === 0 ? (
          <p className="text-xs text-brand-muted text-center py-4">
            No completed fasts this month.
          </p>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {monthSessions.map((s) => {
              const hrs = sessionDurationHours(s);
              const met = goalMet(s);
              return (
                <div key={s.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium dark:text-white">
                      {format(parseISO(s.startedAt), 'MMM d, h:mm a')}
                    </p>
                    <p className="text-xs text-brand-muted">Goal: {s.goalHours}h</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${met ? 'text-green-500' : 'text-brand-accent'}`}
                    >
                      {fmtHours(hrs)}
                    </p>
                    <p className="text-xs text-brand-muted">{met ? '✅ Goal met' : '⏳ Partial'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FastingYearly({ sessions }: { sessions: FastingSession[] }) {
  const months = useMemo(() => {
    const yearStart = startOfYear(new Date());
    const yearEnd = endOfYear(new Date());
    return eachMonthOfInterval({ start: yearStart, end: yearEnd }).map((ms) => {
      const me = endOfMonth(ms);
      const monthSessions = sessions.filter(
        (s) => s.endedAt && isWithinInterval(parseISO(s.startedAt), { start: ms, end: me })
      );
      const totalHours = monthSessions.reduce((acc, s) => acc + sessionDurationHours(s), 0);
      const metCount = monthSessions.filter(goalMet).length;
      return {
        label: format(ms, 'MMM'),
        hours: Math.round(totalHours * 10) / 10,
        fasts: monthSessions.length,
        met: metCount,
        rate: monthSessions.length > 0 ? Math.round((metCount / monthSessions.length) * 100) : 0,
      };
    });
  }, [sessions]);

  const totalFasts = months.reduce((acc, m) => acc + m.fasts, 0);
  const totalHours = months.reduce((acc, m) => acc + m.hours, 0);
  const bestMonth = [...months].sort((a, b) => b.hours - a.hours)[0];

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <FastingStatCard label="Fasts This Year" value={`${totalFasts}`} sub="completed" />
        <FastingStatCard label="Total Hours" value={fmtHours(totalHours)} sub="this year" />
        <FastingStatCard
          label="Best Month"
          value={bestMonth && bestMonth.hours > 0 ? bestMonth.label : '—'}
          sub={bestMonth && bestMonth.hours > 0 ? fmtHours(bestMonth.hours) : 'no data yet'}
        />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
        <h3 className="text-sm font-semibold dark:text-white mb-3">
          Monthly Fasting Hours — {format(new Date(), 'yyyy')}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={months}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="h" />
            <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}h`, 'Total hours']} />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
              {months.map((m, i) => (
                <Cell
                  key={i}
                  fill={
                    bestMonth && m.label === bestMonth.label && m.hours > 0
                      ? '#10B981'
                      : m.hours > 0
                        ? '#4F6EF7'
                        : '#E5E7EB'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
        <h3 className="text-sm font-semibold dark:text-white mb-3">Goal Success Rate by Month</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={months}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Goal rate']} />
            <ReferenceLine y={80} stroke="#10B981" strokeDasharray="4 4" />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
              {months.map((m, i) => (
                <Cell
                  key={i}
                  fill={
                    m.rate >= 80
                      ? '#10B981'
                      : m.rate >= 50
                        ? '#F59E0B'
                        : m.rate > 0
                          ? '#EF4444'
                          : '#E5E7EB'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span className="text-xs text-brand-muted">≥80%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-400" />
            <span className="text-xs text-brand-muted">50–79%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-400" />
            <span className="text-xs text-brand-muted">&lt;50%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Heatmap ────────────────────────────────────────────────────────────────
function Heatmap({ tasksByDate }: { tasksByDate: Map<string, { done: number; total: number }> }) {
  // Show last 4 months
  const today = new Date();
  const months = Array.from({ length: 4 }, (_, i) => subMonths(today, 3 - i));

  function getColor(rate: number, total: number): string {
    if (total === 0) return 'bg-gray-100 dark:bg-gray-700';
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 50) return 'bg-green-300';
    if (rate >= 20) return 'bg-green-200';
    return 'bg-green-100';
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
      <h2 className="font-semibold text-sm dark:text-white mb-3">📅 Productivity Heatmap</h2>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {months.map((monthDate) => {
          const days = eachDayOfInterval({
            start: startOfMonth(monthDate),
            end: endOfMonth(monthDate),
          });
          // Pad to start on correct weekday
          const firstDow = days[0]!.getDay();
          return (
            <div key={format(monthDate, 'yyyy-MM')} className="shrink-0">
              <p className="text-xs text-brand-muted mb-1.5 font-medium">
                {format(monthDate, 'MMM yyyy')}
              </p>
              {/* Day labels */}
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="w-4 text-center text-[9px] text-brand-muted">
                    {d[0]}
                  </div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {/* Empty padding cells */}
                {Array.from({ length: firstDow }, (_, i) => (
                  <div key={`pad-${i}`} className="w-4 h-4" />
                ))}
                {days.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const data = tasksByDate.get(dateStr);
                  const total = data?.total ?? 0;
                  const done = data?.done ?? 0;
                  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
                  const isFuture = day > today;
                  return (
                    <div
                      key={dateStr}
                      title={`${dateStr}: ${done}/${total} tasks (${rate}%)`}
                      className={`w-4 h-4 rounded-sm transition-colors
                        ${isFuture ? 'bg-gray-50 dark:bg-gray-700/30' : getColor(rate, total)}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-brand-muted">Less</span>
        {[
          'bg-gray-100 dark:bg-gray-700',
          'bg-green-100',
          'bg-green-200',
          'bg-green-300',
          'bg-green-500',
        ].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span className="text-xs text-brand-muted">More</span>
      </div>
    </div>
  );
}

// ── Best/Worst Day Insights ────────────────────────────────────────────────
function DayInsights({
  tasksByDate,
}: {
  tasksByDate: Map<string, { done: number; total: number }>;
}) {
  const dayStats = useMemo(() => {
    const stats: Record<number, { totalRate: number; count: number }> = {};
    for (let i = 0; i < 7; i++) stats[i] = { totalRate: 0, count: 0 };

    tasksByDate.forEach(({ done, total }, dateStr) => {
      if (total === 0) return;
      const dow = new Date(dateStr).getDay();
      const rate = (done / total) * 100;
      stats[dow]!.totalRate += rate;
      stats[dow]!.count += 1;
    });

    return Object.entries(stats)
      .map(([dow, { totalRate, count }]) => ({
        dow: parseInt(dow),
        name: DAY_NAMES[parseInt(dow)] ?? '',
        avg: count > 0 ? Math.round(totalRate / count) : 0,
        count,
      }))
      .filter((d) => d.count > 0);
  }, [tasksByDate]);

  if (dayStats.length < 2) return null;

  const sorted = [...dayStats].sort((a, b) => b.avg - a.avg);
  const best = sorted[0]!;
  const worst = sorted[sorted.length - 1]!;
  const byDow = [...dayStats].sort((a, b) => a.dow - b.dow);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
      <h2 className="font-semibold text-sm dark:text-white mb-3">🧠 Day Insights</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
          <p className="text-xs text-brand-muted mb-1">Most productive day</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{best.name}</p>
          <p className="text-xs text-brand-muted">{best.avg}% avg completion</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
          <p className="text-xs text-brand-muted mb-1">Least productive day</p>
          <p className="text-lg font-bold text-red-500 dark:text-red-400">{worst.name}</p>
          <p className="text-xs text-brand-muted">{worst.avg}% avg completion</p>
        </div>
      </div>
      {/* Bar chart per day of week */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={byDow}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number | undefined) => `${v ?? 0}%`} />
          <Bar dataKey="avg" name="Avg Completion" radius={[4, 4, 0, 0]}>
            {byDow.map((entry) => (
              <Cell
                key={entry.dow}
                fill={
                  entry.dow === best.dow
                    ? '#10B981'
                    : entry.dow === worst.dow
                      ? '#EF4444'
                      : '#4F6EF7'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { scheduledTasks, fetchByWeek } = usePlannerStore();
  const { habits, entries, fetchHabits, fetchEntries } = useHabitStore();
  const { tasks } = useTaskStore();
  const { sessions, fetchSessions } = useFastingStore();

  const [mainTab, setMainTab] = useState<'productivity' | 'fasting'>('productivity');
  const [fastingPeriod, setFastingPeriod] = useState<FastingPeriod>('weekly');

  const last7 = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')),
    []
  );

  // For heatmap — last 4 months
  const heatmapStart = useMemo(
    () => format(startOfMonth(subMonths(new Date(), 3)), 'yyyy-MM-dd'),
    []
  );
  const heatmapEnd = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    fetchByWeek(heatmapStart, heatmapEnd);
    fetchHabits();
    fetchEntries(last7);
    fetchSessions();
  }, []);

  // Build date → { done, total } map for heatmap + insights
  const tasksByDate = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of scheduledTasks) {
      const existing = map.get(t.date) ?? { done: 0, total: 0 };
      map.set(t.date, {
        done: existing.done + (t.done ? 1 : 0),
        total: existing.total + 1,
      });
    }
    return map;
  }, [scheduledTasks]);

  const completionData = last7.map((date) => {
    const data = tasksByDate.get(date) ?? { done: 0, total: 0 };
    return {
      date: format(new Date(date), 'EEE'),
      done: data.done,
      total: data.total,
      rate: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
    };
  });

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    scheduledTasks
      .filter((t) => last7.includes(t.date))
      .forEach((t) => {
        const cat = t.task.category;
        map[cat] = (map[cat] ?? 0) + t.task.durationMins;
      });
    return Object.entries(map).map(([name, minutes]) => ({
      name,
      hours: Math.round((minutes / 60) * 10) / 10,
    }));
  }, [scheduledTasks]);

  const habitData = habits.map((habit) => {
    const completed = entries.filter(
      (e) => e.habitId === habit.id && e.completed && last7.includes(e.date)
    ).length;
    return {
      name: habit.title,
      rate: Math.round((completed / 7) * 100),
    };
  });

  const totalScheduled = scheduledTasks.filter((t) => last7.includes(t.date)).length;
  const totalDone = scheduledTasks.filter((t) => last7.includes(t.date) && t.done).length;
  const totalHours = Math.round(
    scheduledTasks
      .filter((t) => last7.includes(t.date))
      .reduce((acc, t) => acc + t.task.durationMins, 0) / 60
  );
  const overallRate = totalScheduled > 0 ? Math.round((totalDone / totalScheduled) * 100) : 0;

  const completedSessions = useMemo(() => sessions.filter((s) => s.endedAt), [sessions]);
  const allTimeHours = completedSessions.reduce((acc, s) => acc + sessionDurationHours(s), 0);
  const allTimeMet = completedSessions.filter(goalMet).length;
  const longestFast = completedSessions.reduce((max, s) => {
    const h = sessionDurationHours(s);
    return h > max ? h : max;
  }, 0);
  const fastSuccessRate =
    completedSessions.length > 0 ? Math.round((allTimeMet / completedSessions.length) * 100) : 0;

  void tasks;

  return (
    <div className="max-w-screen-xl mx-auto">
      <h1 className="text-xl font-bold dark:text-white mb-4">📊 Analytics</h1>

      {/* Main tabs */}
      <div className="flex gap-2 mb-5">
        {(
          [
            ['productivity', '📋 Productivity'],
            ['fasting', '🕐 Fasting'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${mainTab === tab ? 'bg-brand-accent text-white' : 'bg-white dark:bg-gray-800 border dark:border-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Productivity tab ── */}
      {mainTab === 'productivity' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Tasks Scheduled', value: totalScheduled, color: 'bg-brand-accent' },
              { label: 'Tasks Completed', value: totalDone, color: 'bg-brand-green' },
              { label: 'Hours Planned', value: `${totalHours}h`, color: 'bg-brand-accent2' },
              { label: 'Completion Rate', value: `${overallRate}%`, color: 'bg-brand-amber' },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
                <div className={`w-8 h-8 rounded-lg ${s.color} mb-2`} />
                <p className="text-2xl font-bold dark:text-white">{s.value}</p>
                <p className="text-xs text-brand-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Heatmap */}
          <Heatmap tasksByDate={tasksByDate} />

          {/* Best/Worst day insights */}
          <DayInsights tasksByDate={tasksByDate} />

          {/* Daily completion rate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
              <h2 className="font-semibold text-sm dark:text-white mb-3">
                Daily Completion Rate — Last 7 Days (%)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={completionData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => `${v ?? 0}%`} />
                  <Bar dataKey="rate" fill="#4F6EF7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
              <h2 className="font-semibold text-sm dark:text-white mb-3">
                Time by Category (hours)
              </h2>
              {categoryData.length === 0 ? (
                <p className="text-xs text-brand-muted text-center mt-16">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, value }: { name?: string; value?: number }) =>
                        `${name ?? ''} ${value ?? 0}h`
                      }
                    >
                      {categoryData.map((_, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length] ?? '#4F6EF7'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tasks done vs scheduled */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
            <h2 className="font-semibold text-sm dark:text-white mb-3">Tasks Done vs Scheduled</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={completionData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Scheduled" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="done" name="Done" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Habit completion */}
          {habitData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
              <h2 className="font-semibold text-sm dark:text-white mb-3">
                Habit Completion Rate (7 days)
              </h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={habitData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: number | undefined) => `${v ?? 0}%`} />
                  <Bar dataKey="rate" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Fasting tab ── */}
      {mainTab === 'fasting' && (
        <div>
          {/* All-time summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <FastingStatCard
              label="Total Fasts"
              value={`${completedSessions.length}`}
              sub="all time"
            />
            <FastingStatCard label="Total Hours" value={fmtHours(allTimeHours)} sub="all time" />
            <FastingStatCard
              label="Longest Fast"
              value={longestFast > 0 ? fmtHours(longestFast) : '—'}
              sub="single session"
            />
            <FastingStatCard
              label="Goal Success"
              value={`${fastSuccessRate}%`}
              sub="of all fasts"
            />
          </div>

          {/* Period tabs */}
          <div className="flex gap-2 mb-4">
            {(['weekly', 'monthly', 'yearly'] as FastingPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setFastingPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize
                  ${fastingPeriod === p ? 'bg-brand-accent text-white' : 'bg-white dark:bg-gray-800 border dark:border-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                {p}
              </button>
            ))}
          </div>

          {fastingPeriod === 'weekly' && <FastingWeekly sessions={completedSessions} />}
          {fastingPeriod === 'monthly' && <FastingMonthly sessions={completedSessions} />}
          {fastingPeriod === 'yearly' && <FastingYearly sessions={completedSessions} />}
        </div>
      )}
    </div>
  );
}
