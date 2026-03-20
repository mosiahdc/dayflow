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
  differenceInDays,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
  endOfWeek,
  isWithinInterval,
  startOfDay,
} from 'date-fns';
import { usePlannerStore } from '@/store/plannerStore';
import { useHabitStore } from '@/store/habitStore';
import { useTaskStore } from '@/store/taskStore';
import { useFastingStore } from '@/store/fastingStore';
import type { FastingSession } from '@/store/fastingStore';
import type { Habit, HabitEntry } from '@/types';
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
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#4F6EF7', '#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ── CSV / Backup helpers ───────────────────────────────────────────────────
function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = String(r[h] ?? '').replace(/"/g, '""');
          return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
        })
        .join(',')
    ),
  ];
  return lines.join('\n');
}

// ── GitHub-style combined streak calendar ─────────────────────────────────
function StreakCalendar({ habits, allEntries }: { habits: Habit[]; allEntries: HabitEntry[] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  // Show last 6 months
  const months = useMemo(
    () => Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i)),
    []
  );

  // Build date → { completed, total } across ALL habits
  const combinedMap = useMemo(() => {
    const map = new Map<string, { completed: number; total: number }>();
    const completedSet = new Set(
      allEntries.filter((e) => e.completed).map((e) => `${e.habitId}::${e.date}`)
    );
    // Walk every day in range
    const start = startOfMonth(subMonths(new Date(), 5));
    const end = new Date();
    let cur = start;
    while (cur <= end) {
      const dateStr = format(cur, 'yyyy-MM-dd');
      const dow = DAY_KEYS[cur.getDay()];
      const targeted = habits.filter((h) => h.targetDays.includes(dow as any));
      const completed = targeted.filter((h) => completedSet.has(`${h.id}::${dateStr}`)).length;
      if (targeted.length > 0) map.set(dateStr, { completed, total: targeted.length });
      cur = new Date(cur.getTime() + 86400000);
    }
    return map;
  }, [habits, allEntries]);

  function getColor(dateStr: string): string {
    const data = combinedMap.get(dateStr);
    if (!data || data.total === 0) return '#f3f4f6';
    const rate = data.completed / data.total;
    if (rate === 1) return '#10B981';
    if (rate >= 0.75) return '#34d399';
    if (rate >= 0.5) return '#6ee7b7';
    if (rate >= 0.25) return '#a7f3d0';
    return '#d1fae5';
  }

  // Longest current streak (all habits combined — day counts if ≥1 habit done)
  const currentStreak = useMemo(() => {
    let count = 0;
    let cur = new Date();
    cur.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const dateStr = format(cur, 'yyyy-MM-dd');
      const data = combinedMap.get(dateStr);
      if (data && data.completed > 0) {
        count++;
      } else if (dateStr < today) {
        break;
      }
      cur = subDays(cur, 1);
    }
    return count;
  }, [combinedMap, today]);

  const longestStreak = useMemo(() => {
    let best = 0;
    let count = 0;
    const start = startOfMonth(subMonths(new Date(), 5));
    let cur = new Date(start);
    while (cur <= new Date()) {
      const dateStr = format(cur, 'yyyy-MM-dd');
      const data = combinedMap.get(dateStr);
      if (data && data.completed > 0) {
        count++;
        best = Math.max(best, count);
      } else {
        count = 0;
      }
      cur = new Date(cur.getTime() + 86400000);
    }
    return best;
  }, [combinedMap]);

  const totalActiveDays = useMemo(
    () => [...combinedMap.values()].filter((d) => d.completed > 0).length,
    [combinedMap]
  );
  const perfectDays = useMemo(
    () => [...combinedMap.values()].filter((d) => d.completed === d.total && d.total > 0).length,
    [combinedMap]
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-semibold text-sm dark:text-white">🟩 Combined Habit Streak Calendar</h2>
        <div className="flex gap-4 text-xs">
          <span className="text-brand-muted">
            Current streak: <span className="font-bold text-green-500">{currentStreak} 🔥</span>
          </span>
          <span className="text-brand-muted">
            Longest: <span className="font-bold dark:text-white">{longestStreak}</span>
          </span>
          <span className="text-brand-muted">
            Active days: <span className="font-bold dark:text-white">{totalActiveDays}</span>
          </span>
          <span className="text-brand-muted">
            Perfect days: <span className="font-bold text-green-500">{perfectDays} ✨</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-4 min-w-max">
          {months.map((monthDate) => {
            const days = eachDayOfInterval({
              start: startOfMonth(monthDate),
              end: endOfMonth(monthDate),
            });
            const firstDow = days[0]!.getDay();
            return (
              <div key={format(monthDate, 'yyyy-MM')} className="shrink-0">
                <p className="text-[10px] text-brand-muted font-medium mb-1">
                  {format(monthDate, 'MMM yyyy')}
                </p>
                <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                  {DAY_SHORT.map((d, i) => (
                    <div key={i} className="w-4 text-center text-[8px] text-brand-muted">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDow }, (_, i) => (
                    <div key={`pad-${i}`} className="w-4 h-4" />
                  ))}
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const data = combinedMap.get(dateStr);
                    const isFuture = dateStr > today;
                    return (
                      <div
                        key={dateStr}
                        title={
                          data
                            ? `${format(day, 'MMM d')}: ${data.completed}/${data.total} habits`
                            : format(day, 'MMM d')
                        }
                        className="w-4 h-4 rounded-sm"
                        style={{
                          backgroundColor: isFuture ? 'transparent' : getColor(dateStr),
                          opacity: isFuture ? 0.2 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-brand-muted">Less</span>
        {['#f3f4f6', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10B981'].map((c, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span className="text-[10px] text-brand-muted">More</span>
        <span className="text-[10px] text-brand-muted ml-2">(all habits)</span>
      </div>
    </div>
  );
}

// ── Personal Records ───────────────────────────────────────────────────────
function PersonalRecords({
  habits,
  allEntries,
  sessions,
  scheduledTasks,
}: {
  habits: Habit[];
  allEntries: HabitEntry[];
  sessions: FastingSession[];
  scheduledTasks: { date: string; done: boolean; task: { durationMins: number } }[];
}) {
  const records = useMemo(() => {
    // Most tasks done in a day
    const tasksByDay = new Map<string, number>();
    for (const t of scheduledTasks) {
      if (t.done) tasksByDay.set(t.date, (tasksByDay.get(t.date) ?? 0) + 1);
    }
    const mostTasksDay = [...tasksByDay.entries()].sort((a, b) => b[1] - a[1])[0];

    // Most hours planned in a day
    const hoursByDay = new Map<string, number>();
    for (const t of scheduledTasks) {
      hoursByDay.set(t.date, (hoursByDay.get(t.date) ?? 0) + t.task.durationMins);
    }
    const mostHoursDay = [...hoursByDay.entries()].sort((a, b) => b[1] - a[1])[0];

    // Best habit streak ever (across all habits)
    let bestHabitStreak = 0;
    let bestHabitName = '';
    for (const habit of habits) {
      const habitDone = new Set(
        allEntries.filter((e) => e.habitId === habit.id && e.completed).map((e) => e.date)
      );
      let best = 0;
      let count = 0;
      const start = parseISO(habit.createdAt);
      let cur = new Date(start);
      const today = new Date();
      while (cur <= today) {
        const dow = DAY_KEYS[cur.getDay()];
        const dateStr = format(cur, 'yyyy-MM-dd');
        if (habit.targetDays.includes(dow as any)) {
          if (habitDone.has(dateStr)) {
            count++;
            if (count > best) {
              best = count;
            }
          } else if (dateStr < format(today, 'yyyy-MM-dd')) {
            count = 0;
          }
        }
        cur = new Date(cur.getTime() + 86400000);
      }
      if (best > bestHabitStreak) {
        bestHabitStreak = best;
        bestHabitName = habit.title;
      }
    }

    // Best streak week (most habits completed in any 7-day window)
    let bestWeekCount = 0;
    let bestWeekLabel = '';
    if (allEntries.length > 0) {
      const sorted = [...allEntries]
        .filter((e) => e.completed)
        .sort((a, b) => a.date.localeCompare(b.date));
      const firstDate = sorted[0]?.date ?? format(new Date(), 'yyyy-MM-dd');
      let cur = parseISO(firstDate);
      const today = new Date();
      while (cur <= today) {
        const weekEnd = addDays7(cur, 6);
        const weekDates = new Set(
          Array.from({ length: 7 }, (_, i) => format(addDays7(cur, i), 'yyyy-MM-dd'))
        );
        const count = allEntries.filter((e) => e.completed && weekDates.has(e.date)).length;
        if (count > bestWeekCount) {
          bestWeekCount = count;
          bestWeekLabel = `${format(cur, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
        }
        cur = addDays7(cur, 1);
      }
    }

    // Longest fast
    const longestFast = sessions
      .filter((s) => s.endedAt)
      .reduce((max, s) => Math.max(max, sessionDurationHours(s)), 0);
    const longestFastSession = sessions
      .filter((s) => s.endedAt)
      .sort((a, b) => sessionDurationHours(b) - sessionDurationHours(a))[0];

    // Most fasts in a week
    let mostFastsWeek = 0;
    let mostFastsWeekLabel = '';
    if (sessions.length > 0) {
      const sorted = [...sessions]
        .filter((s) => s.endedAt)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      const firstDate = sorted[0]?.startedAt ? parseISO(sorted[0].startedAt) : new Date();
      let cur = new Date(firstDate);
      const today = new Date();
      while (cur <= today) {
        const weekDates = new Set(
          Array.from({ length: 7 }, (_, i) => format(addDays7(cur, i), 'yyyy-MM-dd'))
        );
        const count = sessions.filter(
          (s) => s.endedAt && weekDates.has(format(parseISO(s.startedAt), 'yyyy-MM-dd'))
        ).length;
        if (count > mostFastsWeek) {
          mostFastsWeek = count;
          mostFastsWeekLabel = `${format(cur, 'MMM d')} – ${format(addDays7(cur, 6), 'MMM d')}`;
        }
        cur = addDays7(cur, 7);
      }
    }

    return {
      mostTasksDay,
      mostHoursDay,
      bestHabitStreak,
      bestHabitName,
      bestWeekCount,
      bestWeekLabel,
      longestFast,
      longestFastSession,
      mostFastsWeek,
      mostFastsWeekLabel,
    };
  }, [habits, allEntries, sessions, scheduledTasks]);

  const cards = [
    {
      emoji: '✅',
      label: 'Most Tasks Done in a Day',
      value: records.mostTasksDay ? `${records.mostTasksDay[1]} tasks` : '—',
      sub: records.mostTasksDay ? format(parseISO(records.mostTasksDay[0]), 'MMM d, yyyy') : '',
      color: 'border-brand-accent',
    },
    {
      emoji: '⏱',
      label: 'Most Hours Planned in a Day',
      value: records.mostHoursDay
        ? `${Math.round((records.mostHoursDay[1] / 60) * 10) / 10}h`
        : '—',
      sub: records.mostHoursDay ? format(parseISO(records.mostHoursDay[0]), 'MMM d, yyyy') : '',
      color: 'border-brand-accent2',
    },
    {
      emoji: '🔥',
      label: 'Best Habit Streak Ever',
      value: records.bestHabitStreak > 0 ? `${records.bestHabitStreak} days` : '—',
      sub: records.bestHabitName,
      color: 'border-brand-amber',
    },
    {
      emoji: '🏆',
      label: 'Best Streak Week',
      value: records.bestWeekCount > 0 ? `${records.bestWeekCount} completions` : '—',
      sub: records.bestWeekLabel,
      color: 'border-brand-green',
    },
    {
      emoji: '⚡',
      label: 'Longest Fast Ever',
      value: records.longestFast > 0 ? fmtHours(records.longestFast) : '—',
      sub: records.longestFastSession
        ? format(parseISO(records.longestFastSession.startedAt), 'MMM d, yyyy')
        : '',
      color: 'border-indigo-400',
    },
    {
      emoji: '📅',
      label: 'Most Fasts in a Week',
      value: records.mostFastsWeek > 0 ? `${records.mostFastsWeek} fasts` : '—',
      sub: records.mostFastsWeekLabel,
      color: 'border-purple-400',
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
      <h2 className="font-semibold text-sm dark:text-white mb-4">🏅 Personal Records</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border-l-4 p-3 bg-gray-50 dark:bg-gray-700/50 ${c.color}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{c.emoji}</span>
              <p className="text-xs text-brand-muted leading-tight">{c.label}</p>
            </div>
            <p className="text-xl font-bold dark:text-white">{c.value}</p>
            {c.sub && <p className="text-xs text-brand-muted mt-0.5 truncate">{c.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// helper — date-fns addDays alias to avoid shadowing
function addDays7(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Export / Backup panel ──────────────────────────────────────────────────
function ExportBackupPanel({
  habits,
  allEntries,
  sessions,
  scheduledTasks,
  tasks,
}: {
  habits: Habit[];
  allEntries: HabitEntry[];
  sessions: FastingSession[];
  scheduledTasks: {
    id: string;
    date: string;
    startSlot: number;
    done: boolean;
    task: { title: string; category: string; durationMins: number };
  }[];
  tasks: {
    id: string;
    title: string;
    category: string;
    durationMins: number;
    recurring: unknown;
    createdAt: string;
  }[];
}) {
  const [exporting, setExporting] = useState(false);

  function exportHabitsCSV() {
    const rows = habits.map((h) => {
      const habitDone = allEntries.filter((e) => e.habitId === h.id && e.completed);
      return {
        Title: h.title,
        Category: h.category,
        'Target Days': h.targetDays.join(', '),
        'Total Completions': habitDone.length,
        'Added On': format(parseISO(h.createdAt), 'yyyy-MM-dd'),
      };
    });
    downloadFile(toCSV(rows), `dayflow-habits-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  }

  function exportHabitEntriesCSV() {
    const rows = allEntries.map((e) => ({
      'Habit ID': e.habitId,
      'Habit Title': habits.find((h) => h.id === e.habitId)?.title ?? '',
      Date: e.date,
      Completed: e.completed ? 'Yes' : 'No',
    }));
    downloadFile(
      toCSV(rows),
      `dayflow-habit-entries-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      'text/csv'
    );
  }

  function exportFastingCSV() {
    const rows = sessions
      .filter((s) => s.endedAt)
      .map((s) => {
        const hours = sessionDurationHours(s);
        return {
          'Start Time': s.startedAt,
          'End Time': s.endedAt ?? '',
          'Goal (h)': s.goalHours,
          'Duration (h)': Math.round(hours * 100) / 100,
          'Goal Met': hours >= s.goalHours ? 'Yes' : 'No',
        };
      });
    downloadFile(
      toCSV(rows),
      `dayflow-fasting-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      'text/csv'
    );
  }

  function exportTasksCSV() {
    const rows = scheduledTasks.map((st) => ({
      Date: st.date,
      'Start Slot': st.startSlot,
      'Start Time': `${String(Math.floor(st.startSlot / 2)).padStart(2, '0')}:${st.startSlot % 2 === 0 ? '00' : '30'}`,
      Title: st.task.title,
      Category: st.task.category,
      'Duration (min)': st.task.durationMins,
      Done: st.done ? 'Yes' : 'No',
    }));
    downloadFile(toCSV(rows), `dayflow-tasks-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  }

  function exportFullBackup() {
    setExporting(true);
    const backup = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      habits,
      habitEntries: allEntries,
      fastingSessions: sessions,
      scheduledTasks,
      taskLibrary: tasks,
    };
    downloadFile(
      JSON.stringify(backup, null, 2),
      `dayflow-backup-${format(new Date(), 'yyyy-MM-dd')}.json`,
      'application/json'
    );
    setExporting(false);
  }

  const btnClass =
    'flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all hover:shadow-md active:scale-95 text-left w-full';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
      <h2 className="font-semibold text-sm dark:text-white mb-1">📤 Export & Backup</h2>
      <p className="text-xs text-brand-muted mb-4">
        Download your data as CSV or a full JSON backup.
      </p>

      <div className="mb-4">
        <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">
          CSV Exports
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            {
              label: 'Habits summary',
              sub: `${habits.length} habits`,
              icon: '✅',
              fn: exportHabitsCSV,
              color: 'border-brand-green text-brand-green',
            },
            {
              label: 'Habit entries (all)',
              sub: `${allEntries.length} records`,
              icon: '📋',
              fn: exportHabitEntriesCSV,
              color: 'border-brand-accent text-brand-accent',
            },
            {
              label: 'Fasting sessions',
              sub: `${sessions.filter((s) => s.endedAt).length} sessions`,
              icon: '🕐',
              fn: exportFastingCSV,
              color: 'border-indigo-400 text-indigo-500',
            },
            {
              label: 'Scheduled tasks',
              sub: `${scheduledTasks.length} entries`,
              icon: '📅',
              fn: exportTasksCSV,
              color: 'border-brand-amber text-brand-amber',
            },
          ].map(({ label, sub, icon, fn, color }) => (
            <button
              key={label}
              onClick={fn}
              className={`${btnClass} ${color} bg-gray-50 dark:bg-gray-700/50`}
            >
              <span className="text-lg shrink-0">{icon}</span>
              <div className="min-w-0">
                <p className="font-semibold truncate">{label}</p>
                <p className="text-xs text-brand-muted">{sub}</p>
              </div>
              <span className="text-xs ml-auto shrink-0">↓ CSV</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">
          Full Backup
        </p>
        <button
          onClick={exportFullBackup}
          disabled={exporting}
          className={`${btnClass} border-brand-accent2 text-brand-accent2 bg-gray-50 dark:bg-gray-700/50`}
        >
          <span className="text-lg shrink-0">💾</span>
          <div className="min-w-0">
            <p className="font-semibold">Complete backup</p>
            <p className="text-xs text-brand-muted">All habits, tasks, fasting — JSON snapshot</p>
          </div>
          <span className="text-xs ml-auto shrink-0">{exporting ? '…' : '↓ JSON'}</span>
        </button>
      </div>
    </div>
  );
}

// ── Per-habit heatmap card ─────────────────────────────────────────────────
function HabitHeatmapCard({ habit, allEntries }: { habit: Habit; allEntries: HabitEntry[] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const months = useMemo(
    () => Array.from({ length: 4 }, (_, i) => subMonths(new Date(), 3 - i)),
    []
  );
  const habitEntries = useMemo(
    () =>
      new Set(allEntries.filter((e) => e.habitId === habit.id && e.completed).map((e) => e.date)),
    [allEntries, habit.id]
  );

  const streak = useMemo(() => {
    let count = 0;
    let current = startOfDay(new Date());
    for (let i = 0; i < 365; i++) {
      const dayKey = DAY_KEYS[current.getDay()];
      const dateStr = format(current, 'yyyy-MM-dd');
      if (habit.targetDays.includes(dayKey as any)) {
        if (habitEntries.has(dateStr)) {
          count++;
        } else if (dateStr < today) {
          break;
        }
      }
      current = subDays(current, 1);
    }
    return count;
  }, [habitEntries, habit.targetDays, today]);

  const totalDone = habitEntries.size;

  function getCellBg(dateStr: string): string {
    const dow = DAY_KEYS[parseISO(dateStr).getDay()];
    const isTarget = habit.targetDays.includes(dow as any);
    const isFuture = dateStr > today;
    const isDone = habitEntries.has(dateStr);
    const isToday = dateStr === today;
    if (isFuture) return 'transparent';
    if (!isTarget) return '#f3f4f6';
    if (isDone) return habit.color;
    if (isToday) return `${habit.color}30`;
    return '#fee2e2';
  }

  function getBorder(dateStr: string): string {
    const isToday = dateStr === today;
    const dow = DAY_KEYS[parseISO(dateStr).getDay()];
    const isTarget = habit.targetDays.includes(dow as any);
    if (isToday && isTarget && !habitEntries.has(dateStr)) return `1.5px solid ${habit.color}`;
    return '1px solid transparent';
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
        <p className="text-sm font-semibold dark:text-white flex-1 truncate">{habit.title}</p>
        <span className="text-xs text-brand-muted capitalize">{habit.category}</span>
        {streak > 0 && <span className="text-xs font-bold text-brand-amber">{streak} 🔥</span>}
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full text-white shrink-0"
          style={{ backgroundColor: habit.color }}
        >
          {totalDone}
        </span>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-4 min-w-max">
          {months.map((monthDate) => {
            const days = eachDayOfInterval({
              start: startOfMonth(monthDate),
              end: endOfMonth(monthDate),
            });
            const firstDow = days[0]!.getDay();
            return (
              <div key={format(monthDate, 'yyyy-MM')} className="shrink-0">
                <p className="text-[10px] text-brand-muted font-medium mb-1">
                  {format(monthDate, 'MMM yyyy')}
                </p>
                <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                  {DAY_SHORT.map((d, i) => (
                    <div key={i} className="w-4 text-center text-[8px] text-brand-muted">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDow }, (_, i) => (
                    <div key={`pad-${i}`} className="w-4 h-4" />
                  ))}
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dow = DAY_KEYS[day.getDay()];
                    const isTarget = habit.targetDays.includes(dow as any);
                    const isDone = habitEntries.has(dateStr);
                    return (
                      <div
                        key={dateStr}
                        title={`${format(day, 'MMM d')}${isDone ? ' ✓' : isTarget && dateStr <= today ? ' ✗' : ''}`}
                        className="w-4 h-4 rounded-sm transition-opacity"
                        style={{
                          backgroundColor: getCellBg(dateStr),
                          border: getBorder(dateStr),
                          opacity: !isTarget && dateStr <= today ? 0.35 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: habit.color }} />
          <span className="text-[10px] text-brand-muted">Done</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900/30" />
          <span className="text-[10px] text-brand-muted">Missed</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-700"
            style={{ opacity: 0.35 }}
          />
          <span className="text-[10px] text-brand-muted">Not targeted</span>
        </div>
      </div>
    </div>
  );
}

// ── Fasting heatmap ────────────────────────────────────────────────────────
function FastingHeatmap({ sessions }: { sessions: FastingSession[] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const months = useMemo(
    () => Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i)),
    []
  );

  // Build a map: date → { hours, goalMet }
  const fastingByDate = useMemo(() => {
    const map = new Map<string, { hours: number; goalMet: boolean }>();
    for (const s of sessions) {
      if (!s.endedAt) continue;
      const hours = differenceInSeconds(parseISO(s.endedAt), parseISO(s.startedAt)) / 3600;
      const dateStr = format(parseISO(s.startedAt), 'yyyy-MM-dd');
      const existing = map.get(dateStr);
      const combined = (existing?.hours ?? 0) + hours;
      map.set(dateStr, { hours: combined, goalMet: combined >= s.goalHours });
    }
    return map;
  }, [sessions]);

  function getCellColor(dateStr: string): string {
    const data = fastingByDate.get(dateStr);
    if (!data || data.hours === 0) return '';
    if (data.goalMet) return '#10B981'; // green — goal met
    if (data.hours >= 12) return '#6366f1'; // indigo — good effort
    if (data.hours >= 6) return '#a5b4fc'; // light indigo — partial
    return '#e0e7ff'; // very light — minimal
  }

  const totalFasts = sessions.length;
  const totalHours = sessions.reduce(
    (acc, s) =>
      acc +
      (s.endedAt ? differenceInSeconds(parseISO(s.endedAt), parseISO(s.startedAt)) / 3600 : 0),
    0
  );
  const goalMetCount = sessions.filter(
    (s) =>
      s.endedAt &&
      differenceInSeconds(parseISO(s.endedAt), parseISO(s.startedAt)) / 3600 >= s.goalHours
  ).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm dark:text-white">
          🗓 Fasting Heatmap — Last 6 Months
        </h3>
        <div className="flex gap-3 text-xs text-brand-muted">
          <span>
            <span className="font-bold dark:text-white">{totalFasts}</span> fasts
          </span>
          <span>
            <span className="font-bold dark:text-white">{Math.round(totalHours)}h</span> total
          </span>
          <span>
            <span className="font-bold text-green-500">{goalMetCount}</span> goals met
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-4 min-w-max">
          {months.map((monthDate) => {
            const days = eachDayOfInterval({
              start: startOfMonth(monthDate),
              end: endOfMonth(monthDate),
            });
            const firstDow = days[0]!.getDay();
            return (
              <div key={format(monthDate, 'yyyy-MM')} className="shrink-0">
                <p className="text-[10px] text-brand-muted font-medium mb-1">
                  {format(monthDate, 'MMM yyyy')}
                </p>
                <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                  {DAY_SHORT.map((d, i) => (
                    <div key={i} className="w-4 text-center text-[8px] text-brand-muted">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDow }, (_, i) => (
                    <div key={`pad-${i}`} className="w-4 h-4" />
                  ))}
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const data = fastingByDate.get(dateStr);
                    const isFuture = dateStr > today;
                    const color = getCellColor(dateStr);
                    return (
                      <div
                        key={dateStr}
                        title={
                          data
                            ? `${format(day, 'MMM d')}: ${Math.round(data.hours * 10) / 10}h fasted${data.goalMet ? ' ✅' : ''}`
                            : format(day, 'MMM d')
                        }
                        className="w-4 h-4 rounded-sm"
                        style={{
                          backgroundColor: isFuture
                            ? 'transparent'
                            : color || (dateStr <= today ? '#f3f4f6' : 'transparent'),
                          opacity: isFuture ? 0.2 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-[10px] text-brand-muted">Less</span>
        {[
          { color: '#f3f4f6', label: 'No fast' },
          { color: '#e0e7ff', label: '<6h' },
          { color: '#a5b4fc', label: '6–12h' },
          { color: '#6366f1', label: '12h+' },
          { color: '#10B981', label: 'Goal met ✅' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-brand-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
          const firstDow = days[0]!.getDay();
          return (
            <div key={format(monthDate, 'yyyy-MM')} className="shrink-0">
              <p className="text-xs text-brand-muted mb-1.5 font-medium">
                {format(monthDate, 'MMM yyyy')}
              </p>
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="w-4 text-center text-[9px] text-brand-muted">
                    {d[0]}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
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

// ── Per-Habit Detail Page ──────────────────────────────────────────────────
function HabitDetailPage({
  habit,
  allEntries,
  onBack,
}: {
  habit: Habit;
  allEntries: HabitEntry[];
  onBack: () => void;
}) {
  const habitEntries = allEntries.filter((e) => e.habitId === habit.id && e.completed);
  const createdDate = parseISO(habit.createdAt);
  const today = startOfDay(new Date());
  const daysSinceCreated = differenceInDays(today, createdDate) + 1;

  const last30 = useMemo(
    () => Array.from({ length: 30 }, (_, i) => format(subDays(today, 29 - i), 'yyyy-MM-dd')),
    []
  );

  const dailyData = last30.map((date) => {
    const completed = habitEntries.some((e) => e.date === date) ? 1 : 0;
    return { date: format(parseISO(date), 'MMM d'), completed };
  });

  // Weekly completion rate over last 8 weeks
  const weeklyData = useMemo(() => {
    return Array.from({ length: 8 }, (_, wi) => {
      const weekEnd = subDays(today, wi * 7);
      const weekStart = subDays(weekEnd, 6);
      const weekDates = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((d) =>
        format(d, 'yyyy-MM-dd')
      );
      const targetDaysInWeek = weekDates.filter((d) => {
        const dow = DAY_KEYS[parseISO(d).getDay()];
        return habit.targetDays.includes(dow as (typeof habit.targetDays)[number]);
      });
      const completed = weekDates.filter((d) => habitEntries.some((e) => e.date === d)).length;
      const rate =
        targetDaysInWeek.length > 0 ? Math.round((completed / targetDaysInWeek.length) * 100) : 0;
      return {
        week: `W${8 - wi}`,
        rate,
        label: `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`,
      };
    }).reverse();
  }, [habitEntries]);

  // Current streak
  const streak = (() => {
    let count = 0;
    let current = new Date(today);
    for (let i = 0; i < 365; i++) {
      const dayKey = DAY_KEYS[current.getDay()];
      const dateStr = format(current, 'yyyy-MM-dd');
      if (habit.targetDays.includes(dayKey as (typeof habit.targetDays)[number])) {
        const done = habitEntries.some((e) => e.date === dateStr);
        if (done) {
          count++;
        } else if (dateStr < format(today, 'yyyy-MM-dd')) {
          break;
        }
      }
      current = subDays(current, 1);
    }
    return count;
  })();

  // Best streak ever
  const bestStreak = (() => {
    let best = 0;
    let count = 0;
    let current = new Date(createdDate);
    while (current <= today) {
      const dayKey = DAY_KEYS[current.getDay()];
      const dateStr = format(current, 'yyyy-MM-dd');
      if (habit.targetDays.includes(dayKey as (typeof habit.targetDays)[number])) {
        const done = habitEntries.some((e) => e.date === dateStr);
        if (done) {
          count++;
          best = Math.max(best, count);
        } else if (dateStr < format(today, 'yyyy-MM-dd')) {
          count = 0;
        }
      }
      current = new Date(current.getTime() + 86400000);
    }
    return best;
  })();

  const totalCompleted = habitEntries.length;

  const totalTargetDays = (() => {
    let count = 0;
    let current = new Date(createdDate);
    while (current < today) {
      const dayKey = DAY_KEYS[current.getDay()];
      if (habit.targetDays.includes(dayKey as (typeof habit.targetDays)[number])) count++;
      current = new Date(current.getTime() + 86400000);
    }
    return count;
  })();

  const overallRate =
    totalTargetDays > 0 ? Math.round((totalCompleted / totalTargetDays) * 100) : 0;

  const DAY_LABEL_MAP: Record<string, string> = {
    sun: 'Sun',
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
  };

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-brand-muted hover:text-brand-accent transition-colors"
        >
          ← Back to Habits
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
          <h2 className="text-lg font-bold dark:text-white">{habit.title}</h2>
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-brand-muted px-2 py-0.5 rounded-full capitalize">
            {habit.category}
          </span>
        </div>
      </div>

      {/* Added date + target days */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4 flex flex-wrap gap-6 items-center">
        <div>
          <p className="text-xs text-brand-muted">Added on</p>
          <p className="text-sm font-bold dark:text-white">{format(createdDate, 'MMMM d, yyyy')}</p>
          <p className="text-xs text-brand-muted">{daysSinceCreated} days ago</p>
        </div>
        <div className="h-10 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
        <div>
          <p className="text-xs text-brand-muted mb-1.5">Target days</p>
          <div className="flex gap-1">
            {DAY_KEYS.map((d) => (
              <span
                key={d}
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  habit.targetDays.includes(d)
                    ? 'text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-brand-muted'
                }`}
                style={habit.targetDays.includes(d) ? { backgroundColor: habit.color } : {}}
              >
                {DAY_LABEL_MAP[d]}
              </span>
            ))}
          </div>
        </div>
        <div className="h-10 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
        <div>
          <p className="text-xs text-brand-muted">Frequency</p>
          <p className="text-sm font-bold dark:text-white">{habit.targetDays.length}x / week</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Current Streak', value: `${streak} 🔥`, color: 'bg-brand-amber' },
          { label: 'Best Streak', value: `${bestStreak} 🏆`, color: 'bg-brand-accent' },
          { label: 'Total Completions', value: String(totalCompleted), color: 'bg-brand-green' },
          { label: 'Overall Rate', value: `${overallRate}%`, color: 'bg-brand-accent2' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
            <div className={`w-8 h-8 rounded-lg ${s.color} mb-2`} />
            <p className="text-2xl font-bold dark:text-white">{s.value}</p>
            <p className="text-xs text-brand-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly rate line chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
        <h3 className="font-semibold text-sm dark:text-white mb-3">
          Weekly Completion Rate — Last 8 Weeks (%)
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Completion']}
              labelFormatter={(label: unknown) => {
                const key = String(label);
                const item = weeklyData.find((w) => w.week === key);
                return item ? item.label : key;
              }}
            />
            <ReferenceLine y={80} stroke="#10B981" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="rate"
              stroke={habit.color}
              strokeWidth={2.5}
              dot={{ r: 4, fill: habit.color }}
              name="Completion %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Last 30 days daily bar chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
        <h3 className="font-semibold text-sm dark:text-white mb-3">
          Daily Completions — Last 30 Days
        </h3>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={dailyData} barSize={12}>
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={4} />
            <YAxis hide domain={[0, 1]} />
            <Tooltip
              formatter={(_: unknown, __: unknown, props: { payload?: { date?: string } }) => [
                props.payload?.date ?? '',
                'Completed',
              ]}
            />
            <Bar dataKey="completed" radius={[3, 3, 0, 0]}>
              {dailyData.map((entry, i) => (
                <Cell key={i} fill={entry.completed ? habit.color : '#e5e7eb'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: habit.color }} />
            <span className="text-xs text-brand-muted">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-600" />
            <span className="text-xs text-brand-muted">Missed / Not targeted</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-5xl mb-4 opacity-60">{icon}</div>
      <p className="text-base font-semibold dark:text-white mb-1">{title}</p>
      <p className="text-sm text-brand-muted max-w-xs leading-relaxed">{message}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-4 py-2 bg-brand-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {action}
        </button>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { scheduledTasks, fetchByWeek } = usePlannerStore();
  const { habits, entries, weekEntries, fetchHabits, fetchEntries, fetchAllEntries } =
    useHabitStore();
  const { tasks } = useTaskStore();
  const { sessions, fetchSessions } = useFastingStore();

  const [mainTab, setMainTab] = useState<'productivity' | 'habits' | 'fasting' | 'records'>(
    'productivity'
  );
  const [fastingPeriod, setFastingPeriod] = useState<FastingPeriod>('weekly');
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);

  const last7 = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')),
    []
  );

  const heatmapStart = useMemo(
    () => format(startOfMonth(subMonths(new Date(), 3)), 'yyyy-MM-dd'),
    []
  );
  const heatmapEnd = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    fetchByWeek(heatmapStart, heatmapEnd);
    fetchHabits();
    fetchEntries(last7);
    fetchAllEntries();
    fetchSessions();
  }, []);

  // Reset drill-down when switching away from habits tab
  useEffect(() => {
    if (mainTab !== 'habits') setSelectedHabit(null);
  }, [mainTab]);

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

  void weekEntries;

  return (
    <div className="max-w-screen-xl mx-auto">
      <h1 className="text-xl font-bold dark:text-white mb-4">📊 Analytics</h1>

      {/* Main tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(
          [
            ['productivity', '📋 Productivity'],
            ['habits', '✅ Habits'],
            ['fasting', '🕐 Fasting'],
            ['records', '🏅 Records'],
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
          {totalScheduled === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
              <EmptyState
                icon="📅"
                title="No tasks scheduled yet"
                message="Head to the Day view, drag tasks from the library onto the time grid, and your productivity data will appear here."
                action="Go to Day view"
                onAction={() => {
                  import('@/store/uiStore').then(({ useUIStore }) => {
                    useUIStore.getState().setView('day');
                  });
                }}
              />
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Tasks Scheduled', value: totalScheduled, color: 'bg-brand-accent' },
                  { label: 'Tasks Completed', value: totalDone, color: 'bg-brand-green' },
                  { label: 'Hours Planned', value: `${totalHours}h`, color: 'bg-brand-accent2' },
                  { label: 'Completion Rate', value: `${overallRate}%`, color: 'bg-brand-amber' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4"
                  >
                    <div className={`w-8 h-8 rounded-lg ${s.color} mb-2`} />
                    <p className="text-2xl font-bold dark:text-white">{s.value}</p>
                    <p className="text-xs text-brand-muted">{s.label}</p>
                  </div>
                ))}
              </div>

              <Heatmap tasksByDate={tasksByDate} />
              <DayInsights tasksByDate={tasksByDate} />

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

              <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
                <h2 className="font-semibold text-sm dark:text-white mb-3">
                  Tasks Done vs Scheduled
                </h2>
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
            </div>
          )}
        </div>
      )}

      {/* ── Habits tab ── */}
      {mainTab === 'habits' && (
        <>
          {/* Drill-down: per-habit detail */}
          {selectedHabit ? (
            <HabitDetailPage
              habit={selectedHabit}
              allEntries={entries}
              onBack={() => setSelectedHabit(null)}
            />
          ) : (
            (() => {
              const last30 = Array.from({ length: 30 }, (_, i) =>
                format(subDays(new Date(), 29 - i), 'yyyy-MM-dd')
              );
              const allEntries = entries;

              const habitStats = habits.map((habit) => {
                const habitEntries = allEntries.filter(
                  (e) => e.habitId === habit.id && e.completed
                );
                const last7Done = habitEntries.filter((e) => last7.includes(e.date)).length;
                const last30Done = habitEntries.filter((e) => last30.includes(e.date)).length;
                const last7Target = last7.filter((d) =>
                  habit.targetDays.includes(DAY_KEYS[new Date(d).getDay()] as any)
                ).length;
                const last30Target = last30.filter((d) =>
                  habit.targetDays.includes(DAY_KEYS[new Date(d).getDay()] as any)
                ).length;
                const rate7 = last7Target > 0 ? Math.round((last7Done / last7Target) * 100) : 0;
                const rate30 = last30Target > 0 ? Math.round((last30Done / last30Target) * 100) : 0;

                // streak
                const today = startOfDay(new Date());
                let streak = 0;
                let current = new Date(today);
                for (let i = 0; i < 365; i++) {
                  const dayKey = DAY_KEYS[current.getDay()];
                  const dateStr = format(current, 'yyyy-MM-dd');
                  if (habit.targetDays.includes(dayKey as any)) {
                    const done = habitEntries.some((e) => e.date === dateStr);
                    if (done) {
                      streak++;
                    } else if (dateStr < format(today, 'yyyy-MM-dd')) {
                      break;
                    }
                  }
                  current = subDays(current, 1);
                }

                return {
                  habit,
                  last7Done,
                  last30Done,
                  rate7,
                  rate30,
                  streak,
                };
              });

              const dailyData = last30.map((date) => {
                const done = habits.filter((h) => {
                  const dayKey = DAY_KEYS[new Date(date).getDay()];
                  if (!h.targetDays.includes(dayKey as any)) return false;
                  return allEntries.some(
                    (e) => e.habitId === h.id && e.date === date && e.completed
                  );
                }).length;
                const total = habits.filter((h) => {
                  const dayKey = DAY_KEYS[new Date(date).getDay()];
                  return h.targetDays.includes(dayKey as any);
                }).length;
                return {
                  date: format(new Date(date), 'MMM d'),
                  done,
                  total,
                  rate: total > 0 ? Math.round((done / total) * 100) : 0,
                };
              });

              const totalHabits = habits.length;
              const avgRate7 =
                habitStats.length > 0
                  ? Math.round(habitStats.reduce((a, h) => a + h.rate7, 0) / habitStats.length)
                  : 0;
              const avgRate30 =
                habitStats.length > 0
                  ? Math.round(habitStats.reduce((a, h) => a + h.rate30, 0) / habitStats.length)
                  : 0;
              const bestHabit = [...habitStats].sort((a, b) => b.rate30 - a.rate30)[0];

              if (habits.length === 0)
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
                    <EmptyState
                      icon="✅"
                      title="No habits tracked yet"
                      message="Add habits in the Habits tab and start checking them off daily. Your completion data and streaks will appear here."
                      action="Go to Habits"
                      onAction={() => {
                        import('@/store/uiStore').then(({ useUIStore }) => {
                          useUIStore.getState().setView('habits');
                        });
                      }}
                    />
                  </div>
                );

              return (
                <div>
                  {/* Quick-select habit cards */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">
                      Select a habit to view details
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {habits.map((habit) => (
                        <button
                          key={habit.id}
                          onClick={() => setSelectedHabit(habit)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all hover:shadow-md active:scale-95"
                          style={{
                            borderColor: habit.color,
                            backgroundColor: `${habit.color}18`,
                            color: habit.color,
                          }}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: habit.color }}
                          />
                          {habit.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Combined streak calendar ── */}
                  <StreakCalendar habits={habits} allEntries={entries} />

                  {/* ── Per-habit heatmaps ── */}
                  <div className="mb-5">
                    <h2 className="font-semibold text-sm dark:text-white mb-3">
                      🔥 Habit Heatmaps — Last 4 Months
                    </h2>
                    {habits.map((habit) => (
                      <HabitHeatmapCard key={habit.id} habit={habit} allEntries={entries} />
                    ))}
                  </div>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
                      <p className="text-xs text-brand-muted mb-1">Total Habits</p>
                      <p className="text-2xl font-bold dark:text-white">{totalHabits}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
                      <p className="text-xs text-brand-muted mb-1">Avg Rate (7d)</p>
                      <p className="text-2xl font-bold dark:text-white">{avgRate7}%</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
                      <p className="text-xs text-brand-muted mb-1">Avg Rate (30d)</p>
                      <p className="text-2xl font-bold dark:text-white">{avgRate30}%</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
                      <p className="text-xs text-brand-muted mb-1">Best Habit (30d)</p>
                      <p className="text-lg font-bold dark:text-white truncate">
                        {bestHabit ? bestHabit.habit.title : '—'}
                      </p>
                      <p className="text-xs text-brand-muted">
                        {bestHabit ? `${bestHabit.rate30}%` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Daily completion trend */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
                    <h2 className="font-semibold text-sm dark:text-white mb-3">
                      Daily Habit Completion — Last 30 Days (%)
                    </h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dailyData.filter((_, i) => i % 3 === 0)}>
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number | undefined) => `${v ?? 0}%`} />
                        <ReferenceLine y={80} stroke="#10B981" strokeDasharray="4 4" />
                        <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                          {dailyData
                            .filter((_, i) => i % 3 === 0)
                            .map((d, i) => (
                              <Cell
                                key={i}
                                fill={
                                  d.rate >= 80
                                    ? '#10B981'
                                    : d.rate >= 50
                                      ? '#4F6EF7'
                                      : d.rate > 0
                                        ? '#F59E0B'
                                        : '#E5E7EB'
                                }
                              />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Per-habit 7-day rate — bars are clickable */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-semibold text-sm dark:text-white">
                        Completion Rate per Habit — Last 7 Days
                      </h2>
                      <span className="text-xs text-brand-muted">Click a bar for details</span>
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(160, habits.length * 36)}>
                      <BarChart
                        data={habitStats.map((h) => ({ name: h.habit.title, rate: h.rate7 }))}
                        layout="vertical"
                        style={{ cursor: 'pointer' }}
                      >
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                        <Tooltip formatter={(v: number | undefined) => `${v ?? 0}%`} />
                        <ReferenceLine x={80} stroke="#10B981" strokeDasharray="4 4" />
                        <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                          {habitStats.map((h, i) => (
                            <Cell
                              key={i}
                              fill={
                                h.rate7 >= 80 ? '#10B981' : h.rate7 >= 50 ? '#4F6EF7' : '#F59E0B'
                              }
                              onClick={() => setSelectedHabit(h.habit)}
                              style={{ cursor: 'pointer' }}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Per-habit 30-day rate — bars are clickable */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-semibold text-sm dark:text-white">
                        Completion Rate per Habit — Last 30 Days
                      </h2>
                      <span className="text-xs text-brand-muted">Click a bar for details</span>
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(160, habits.length * 36)}>
                      <BarChart
                        data={habitStats.map((h) => ({ name: h.habit.title, rate: h.rate30 }))}
                        layout="vertical"
                        style={{ cursor: 'pointer' }}
                      >
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                        <Tooltip formatter={(v: number | undefined) => `${v ?? 0}%`} />
                        <ReferenceLine x={80} stroke="#10B981" strokeDasharray="4 4" />
                        <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                          {habitStats.map((h, i) => (
                            <Cell
                              key={i}
                              fill={
                                h.rate30 >= 80 ? '#10B981' : h.rate30 >= 50 ? '#4F6EF7' : '#F59E0B'
                              }
                              onClick={() => setSelectedHabit(h.habit)}
                              style={{ cursor: 'pointer' }}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Habit detail table — clickable rows */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 flex items-center justify-between">
                      <h2 className="font-semibold text-sm dark:text-white">Habit Breakdown</h2>
                      <span className="text-xs text-brand-muted">
                        Click any row for full details →
                      </span>
                    </div>
                    <div className="divide-y dark:divide-gray-700">
                      {habitStats.map(({ habit, last7Done, last30Done, rate7, rate30, streak }) => (
                        <button
                          key={habit.id}
                          onClick={() => setSelectedHabit(habit)}
                          className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
                        >
                          <div
                            className="w-1 h-8 rounded-full shrink-0"
                            style={{ backgroundColor: habit.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium dark:text-white truncate group-hover:text-brand-accent transition-colors">
                              {habit.title}
                            </p>
                            <p className="text-xs text-brand-muted capitalize">
                              {habit.category} · {habit.targetDays.length}d/week · Added{' '}
                              {format(parseISO(habit.createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                          {streak > 0 && (
                            <span className="text-xs font-bold text-brand-amber shrink-0">
                              {streak} 🔥
                            </span>
                          )}
                          <div className="text-center shrink-0 w-16">
                            <p
                              className={`text-sm font-bold ${rate7 >= 80 ? 'text-green-500' : rate7 >= 50 ? 'text-brand-accent' : 'text-amber-500'}`}
                            >
                              {rate7}%
                            </p>
                            <p className="text-xs text-brand-muted">7 days</p>
                          </div>
                          <div className="text-center shrink-0 w-16">
                            <p
                              className={`text-sm font-bold ${rate30 >= 80 ? 'text-green-500' : rate30 >= 50 ? 'text-brand-accent' : 'text-amber-500'}`}
                            >
                              {rate30}%
                            </p>
                            <p className="text-xs text-brand-muted">30 days</p>
                          </div>
                          <span className="text-gray-300 dark:text-gray-600 group-hover:text-brand-accent transition-colors text-sm shrink-0">
                            →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </>
      )}

      {/* ── Fasting tab ── */}
      {mainTab === 'fasting' && (
        <div>
          {completedSessions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border shadow overflow-hidden">
              <EmptyState
                icon="🕐"
                title="No fasting sessions yet"
                message="Start a fast in the Fasting tab. Once you complete your first session, your fasting history and trends will show here."
                action="Go to Fasting"
                onAction={() => {
                  import('@/store/uiStore').then(({ useUIStore }) => {
                    useUIStore.getState().setView('fasting');
                  });
                }}
              />
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <FastingStatCard
                  label="Total Fasts"
                  value={`${completedSessions.length}`}
                  sub="all time"
                />
                <FastingStatCard
                  label="Total Hours"
                  value={fmtHours(allTimeHours)}
                  sub="all time"
                />
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

              {/* Fasting heatmap — always visible */}
              <FastingHeatmap sessions={completedSessions} />

              {fastingPeriod === 'weekly' && <FastingWeekly sessions={completedSessions} />}
              {fastingPeriod === 'monthly' && <FastingMonthly sessions={completedSessions} />}
              {fastingPeriod === 'yearly' && <FastingYearly sessions={completedSessions} />}
            </div>
          )}
        </div>
      )}

      {/* ── Records tab ── */}
      {mainTab === 'records' && (
        <div>
          <PersonalRecords
            habits={habits}
            allEntries={entries}
            sessions={completedSessions}
            scheduledTasks={scheduledTasks}
          />
          <ExportBackupPanel
            habits={habits}
            allEntries={entries}
            sessions={sessions}
            scheduledTasks={scheduledTasks}
            tasks={tasks}
          />
        </div>
      )}
    </div>
  );
}
