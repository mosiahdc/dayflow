import { useEffect, useMemo } from 'react';
import { format, subDays, eachDayOfInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { usePlannerStore } from '@/store/plannerStore';
import { useHabitStore } from '@/store/habitStore';
import { useTaskStore } from '@/store/taskStore';
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
} from 'recharts';

const COLORS = ['#4F6EF7', '#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
        <BarChart data={dayStats.sort((a, b) => a.dow - b.dow)}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number | undefined) => `${v ?? 0}%`} />
          <Bar dataKey="avg" name="Avg Completion" radius={[4, 4, 0, 0]}>
            {dayStats
              .sort((a, b) => a.dow - b.dow)
              .map((entry) => (
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

  void tasks;

  return (
    <div className="max-w-screen-xl mx-auto">
      <h1 className="text-xl font-bold dark:text-white mb-4">📊 Analytics</h1>

      {/* Summary cards */}
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
          <h2 className="font-semibold text-sm dark:text-white mb-3">Time by Category (hours)</h2>
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
  );
}
