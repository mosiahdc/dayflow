import { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { usePlannerStore } from '@/store/plannerStore';
import {
  calendarMonday,
  getWorkWeekStart,
  getWorkWeekFetchRange,
  dayKeyOf,
  workWeekLabel,
  WEEK_DAY_ORDER,
  WEEK_DAY_LABELS,
  type DayKey,
} from '@/lib/workWeek';
import type { Task } from '@/types';

interface Props {
  date: string; // selected date from the Day view
}

function fmtHrs(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}h`;
}

function minsToHrs(mins: number): number {
  return Math.round((mins / 60) * 10) / 10;
}

const EMPTY_DAY_MAP: Record<DayKey, number> = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

// Progress bar: solid fill = completed hours out of planned hours.
function ProgressBar({ completed, planned }: { completed: number; planned: number }) {
  const max = Math.max(planned, completed, 1);
  const completedPct = Math.min(100, (completed / max) * 100);
  const overComplete = planned > 0 && completed >= planned;

  return (
    <div
      className="relative w-full h-2.5 rounded-full overflow-hidden shrink-0"
      style={{ background: 'var(--df-border)' }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{ width: `${completedPct}%`, background: overComplete ? 'var(--df-green)' : 'var(--df-accent)' }}
      />
    </div>
  );
}

interface TaskHoursRow {
  task: Task;
  plannedHours: number;
  completedHours: number;
  plannedByDay: Record<DayKey, number>;
  completedByDay: Record<DayKey, number>;
}

export default function WorkHoursPanel({ date }: Props) {
  const { tasks, fetchAll: fetchAllTasks } = useTaskStore();
  const { scheduledTasks, fetchByWeek } = usePlannerStore();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const weekStart = useMemo(() => calendarMonday(date), [date]);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  useEffect(() => {
    const { start, end } = getWorkWeekFetchRange(weekStart);
    fetchByWeek(start, end);
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const workTasks = useMemo(() => tasks.filter((t) => t.category === 'work'), [tasks]);

  const rows: TaskHoursRow[] = useMemo(() => {
    return workTasks
      .map((task) => {
        const relevant = scheduledTasks.filter(
          (st) =>
            st.taskId === task.id &&
            !st.id.startsWith('overflow-') &&
            getWorkWeekStart(st.date, st.startSlot) === weekStart
        );

        const plannedByDay = { ...EMPTY_DAY_MAP };
        const completedByDay = { ...EMPTY_DAY_MAP };

        for (const st of relevant) {
          const key = dayKeyOf(st.date);
          plannedByDay[key] += st.task.durationMins;
          if (st.done) completedByDay[key] += st.task.durationMins;
        }

        (Object.keys(plannedByDay) as DayKey[]).forEach((k) => {
          plannedByDay[k] = minsToHrs(plannedByDay[k]);
          completedByDay[k] = minsToHrs(completedByDay[k]);
        });

        const plannedHours = minsToHrs(relevant.reduce((acc, st) => acc + st.task.durationMins, 0));
        const completedHours = minsToHrs(
          relevant.filter((st) => st.done).reduce((acc, st) => acc + st.task.durationMins, 0)
        );

        return { task, plannedHours, completedHours, plannedByDay, completedByDay };
      })
      .filter((r) => r.plannedHours > 0); // only show tasks with something actually scheduled this work-week
  }, [workTasks, scheduledTasks, weekStart]);

  const totalPlanned = rows.reduce((acc, r) => acc + r.plannedHours, 0);
  const totalCompleted = rows.reduce((acc, r) => acc + r.completedHours, 0);
  const overallPct = totalPlanned > 0 ? Math.min(100, Math.round((totalCompleted / totalPlanned) * 100)) : 0;

  if (workTasks.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--df-surface)', border: '1px solid var(--df-border)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex flex-col gap-1.5" style={{ borderBottom: '1px solid var(--df-border)' }}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--df-text)' }}>
            🕐 Work Hours This Week
          </span>
          {totalPlanned > 0 && (
            <span
              className="text-xs font-bold shrink-0"
              style={{ color: overallPct >= 100 ? 'var(--df-green)' : 'var(--df-accent)' }}
            >
              {overallPct}%
            </span>
          )}
        </div>
        <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
          {workWeekLabel(weekStart)}
        </span>
        {totalPlanned > 0 && (
          <>
            <ProgressBar completed={totalCompleted} planned={totalPlanned} />
            <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
              {fmtHrs(totalCompleted)} done of {fmtHrs(totalPlanned)}h planned
            </span>
          </>
        )}
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {rows.length === 0 && (
          <p className="text-xs text-center py-4 px-4" style={{ color: 'var(--df-muted)' }}>
            No work hours scheduled yet this week — drag a work task onto the Day or Week grid to
            start tracking.
          </p>
        )}

        {rows.map((row) => {
          const isExpanded = expandedTaskId === row.task.id;
          const pct =
            row.plannedHours > 0
              ? Math.min(100, Math.round((row.completedHours / row.plannedHours) * 100))
              : 0;
          return (
            <div key={row.task.id} style={{ borderTop: '1px solid var(--df-border)' }}>
              <button
                onClick={() => setExpandedTaskId(isExpanded ? null : row.task.id)}
                className="w-full flex flex-col gap-1.5 px-4 py-3 text-left hover:brightness-110 transition-all"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: row.task.color }} />
                  <p className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--df-text)' }}>
                    {row.task.title}
                  </p>
                  <span
                    className="text-xs font-bold shrink-0"
                    style={{ color: pct >= 100 ? 'var(--df-green)' : 'var(--df-accent)' }}
                  >
                    {pct}%
                  </span>
                  <span className="text-xs shrink-0" style={{ color: 'var(--df-muted)' }}>
                    {isExpanded ? '▲' : '▾'}
                  </span>
                </div>

                <ProgressBar completed={row.completedHours} planned={row.plannedHours} />

                <span className="text-[10px]" style={{ color: 'var(--df-muted)' }}>
                  {fmtHrs(row.completedHours)}h done of {fmtHrs(row.plannedHours)}h planned
                </span>
              </button>

              {/* Read-only per-day breakdown — pulled straight from the calendar, nothing to edit */}
              {isExpanded && (
                <div className="px-4 pb-3 grid grid-cols-7 gap-1">
                  {WEEK_DAY_ORDER.map((key) => (
                    <div
                      key={key}
                      className="flex flex-col items-center gap-0.5 rounded py-1.5"
                      style={{ background: 'var(--df-surface2)' }}
                    >
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--df-muted)' }}>
                        {WEEK_DAY_LABELS[key]}
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: 'var(--df-text)' }}>
                        {row.plannedByDay[key] > 0 ? fmtHrs(row.plannedByDay[key]) : '—'}
                      </span>
                      {row.completedByDay[key] > 0 && (
                        <span className="text-[9px]" style={{ color: 'var(--df-green)' }}>
                          {fmtHrs(row.completedByDay[key])} done
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
