import { useEffect, useMemo } from 'react';
import { format, subDays } from 'date-fns';
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

export default function AnalyticsPage() {
  const { scheduledTasks, fetchByWeek } = usePlannerStore();
  const { habits, entries, fetchHabits, fetchEntries } = useHabitStore();
  const { tasks } = useTaskStore();

  const last7 = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')),
    []
  );

  useEffect(() => {
    fetchByWeek(last7[0] ?? '', last7[6] ?? '');
    fetchHabits();
    fetchEntries(last7);
  }, []);

  const completionData = last7.map((date) => {
    const dayTasks = scheduledTasks.filter((t) => t.date === date);
    const done = dayTasks.filter((t) => t.done).length;
    const total = dayTasks.length;
    return {
      date: format(new Date(date), 'EEE'),
      done,
      total,
      rate: total > 0 ? Math.round((done / total) * 100) : 0,
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
      <h1 className="text-xl font-bold dark:text-white mb-4">📊 Analytics — Last 7 Days</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
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

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow p-4">
          <h2 className="font-semibold text-sm dark:text-white mb-3">Daily Completion Rate (%)</h2>
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
                  label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''} ${value ?? 0}h`}
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